import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  compile,
  loadConfig,
  resolveConfigPaths,
  stableStringify,
  hash,
} from "@dsc/compiler";
import {
  matches,
  mayContain,
  validateContract,
  validateEnforcement,
} from "./contract.js";
import { scanSource } from "./scanner.js";
import type {
  EnforcementDiagnostic,
  InspectionOptions,
  InspectionReport,
  Rule,
} from "./types.js";
export * from "./types.js";
export { scanSource, validateContract, validateEnforcement };

export function formatInspection(report: InspectionReport): string {
  const lines = report.diagnostics.map(
    (d) =>
      `${d.source ? `${d.source.file}:${d.source.line}:${d.source.column} ` : ""}${d.code} [${d.severity}] ${d.message}${d.suggestion ? `\n  ${d.suggestion}` : ""}`,
  );
  const errors = report.diagnostics.filter(
    (d) => d.severity === "error",
  ).length;
  const warnings = report.diagnostics.filter(
    (d) => d.severity === "warning",
  ).length;
  lines.push(
    `${report.passed ? "✓" : "✗"} ${report.contractName}: ${errors} error(s), ${warnings} warning(s), ${report.coverage.scanned.length} scanned, ${report.coverage.unsupported.length} unsupported, ${report.suppressed.length} suppressed. Mode: ${report.mode}. Contract: ${report.contractHash || "unavailable"}.`,
  );
  return lines.join("\n");
}
export async function inspectProject(
  options: InspectionOptions = {},
): Promise<InspectionReport> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const report: InspectionReport = {
    schemaVersion: 1,
    contractHash: "",
    contractName: "Design system",
    mode: options.mode ?? "strict",
    ready: false,
    passed: false,
    diagnostics: [],
    suppressed: [],
    coverage: { scanned: [], excluded: [], unsupported: [] },
  };
  try {
    const loaded = await loadConfig(cwd, options.config);
    const enforcement = validateEnforcement(loaded.config.enforcement);
    report.mode = options.mode ?? enforcement.mode ?? "strict";
    if (!["warn", "strict"].includes(report.mode))
      throw new Error("Inspection mode must be warn or strict.");
    const root = path.dirname(loaded.file);
    const contractFile = path.resolve(root, enforcement.contract);
    const contract = validateContract(
      JSON.parse(await readFile(contractFile, "utf8")),
    );
    report.contractName = contract.name;
    const config = resolveConfigPaths(loaded.config, loaded.file);
    for (const directory of [config.themes, config.registry])
      if (directory && !(await stat(directory)).isDirectory())
        throw new Error(
          `Configured baseline directory is not a directory: ${directory}.`,
        );
    const baseline = await compile(config, {
      cwd: root,
      emit: options.emit ?? false,
      cache: false,
    });
    for (const diagnostic of baseline.diagnostics)
      if (diagnostic.severity !== "info")
        report.diagnostics.push({
          ...diagnostic,
          severity: diagnostic.severity,
        });
    if (baseline.diagnostics.some((d) => d.severity === "error")) return report;
    if (!baseline.tokens.size)
      throw new Error("The approved baseline must define at least one token.");
    // Hash the approved semantic contract, not absolute paths or consumer source.
    const implementation: Array<[string, string]> = [];
    const today = (options.now ?? new Date()).toISOString().slice(0, 10);
    for (const exception of contract.exceptions ?? [])
      if (exception.expires < today)
        report.diagnostics.push({
          code: "DS_EXPIRED_EXCEPTION",
          severity: "error",
          message: `Exception expired ${exception.expires}: ${exception.reason}`,
        });
    const exclusions = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/coverage/**",
      ...(enforcement.exclude ?? []),
    ];
    const out = path.resolve(config.outDir!);
    const baselineFiles = new Set(
      [...config.tokens, contractFile, loaded.file].map((f) => path.resolve(f)),
    );
    const all: string[] = [];
    async function walk(directory: string): Promise<void> {
      for (const entry of (
        await readdir(directory, { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(directory, entry.name);
        const relative = path.relative(root, full).split(path.sep).join("/");
        if (entry.isSymbolicLink()) {
          if (matches(relative, contract.implementation ?? []))
            throw new Error(
              `Approved implementation must not use symlink ${relative}.`,
            );
          if (matches(relative, enforcement.include))
            report.coverage.unsupported.push(relative);
          continue;
        }
        if (entry.isDirectory()) {
          if (
            !mayContain(relative, [
              ...enforcement.include,
              ...(contract.implementation ?? []),
            ])
          )
            continue;
          if (
            full === out ||
            (matches(`${relative}/`, exclusions) &&
              !mayContain(relative, contract.implementation ?? [])) ||
            ["node_modules", ".git", "dist", "coverage"].includes(entry.name)
          ) {
            report.coverage.excluded.push(`${relative}/`);
            continue;
          }
          await walk(full);
        } else if (entry.isFile()) {
          if (matches(relative, contract.implementation ?? []))
            implementation.push([relative, await readFile(full, "utf8")]);
          if (!matches(relative, enforcement.include)) continue;
          if (
            baselineFiles.has(full) ||
            (config.themes && full.startsWith(config.themes + path.sep)) ||
            matches(relative, exclusions)
          )
            report.coverage.excluded.push(relative);
          else all.push(relative);
        }
      }
    }
    await walk(root);
    report.contractHash = hash(
      stableStringify({
        contract,
        implementation,
        scope: {
          include: enforcement.include,
          exclude: enforcement.exclude ?? [],
        },
        css: config.css ?? {},
        tokens: baseline.metadata.map((t) => ({
          name: t.name,
          type: t.type,
          value: t.resolvedValue,
          deprecated: t.deprecated ?? false,
        })),
        themes: [...baseline.themes].map(([name, t]) => ({
          name,
          values: [...t.values],
        })),
      }),
    );
    if ((contract.implementation?.length ?? 0) && !implementation.length)
      throw new Error("No files matched approved implementation patterns.");
    for (const file of all.sort()) {
      const scanned = scanSource(
        file,
        await readFile(path.join(root, file), "utf8"),
        contract,
        baseline.metadata,
        config.css?.prefix ?? "ds",
        config.css?.separator ?? "-",
      );
      report.coverage.scanned.push(file);
      if (scanned.unsupported) report.coverage.unsupported.push(file);
      for (const diagnostic of scanned.diagnostics) {
        const exception = contract.exceptions?.find(
          (e) =>
            e.expires >= today &&
            e.rules.includes(diagnostic.code as Rule) &&
            matches(file, e.files),
        );
        if (exception)
          report.suppressed.push({
            ...diagnostic,
            reason: exception.reason,
            expires: exception.expires,
          });
        else report.diagnostics.push(diagnostic);
      }
    }
    for (const file of report.coverage.unsupported.filter(
      (f) => !report.coverage.scanned.includes(f),
    )) {
      const severity = contract.rules?.DS_UNSUPPORTED_SOURCE ?? "warning";
      if (severity === "off") continue;
      report.diagnostics.push({
        code: "DS_UNSUPPORTED_SOURCE",
        severity,
        message:
          "Symlink source is not traversed; configure a real source directory.",
        source: { file, line: 1, column: 1 },
      });
    }
    if (!all.length)
      report.diagnostics.push({
        code: "DS_EMPTY_SCAN",
        severity: "error",
        message:
          "No consumer files matched enforcement.include. Check source paths and exclusions.",
      });
    report.ready = true;
    report.diagnostics.sort(
      (a, b) =>
        (a.source?.file ?? "").localeCompare(b.source?.file ?? "") ||
        (a.source?.line ?? 0) - (b.source?.line ?? 0) ||
        (a.source?.column ?? 0) - (b.source?.column ?? 0) ||
        a.code.localeCompare(b.code),
    );
    report.passed =
      report.mode === "warn" ||
      !report.diagnostics.some(
        (d) =>
          d.severity === "error" ||
          (options.failOnWarnings && d.severity === "warning"),
      );
    // Invalid coverage and expired approvals always fail, including warning mode.
    if (
      report.diagnostics.some((d) =>
        ["DS_EMPTY_SCAN", "DS_EXPIRED_EXCEPTION"].includes(d.code),
      )
    )
      report.passed = false;
  } catch (error) {
    report.ready = false;
    report.passed = false;
    report.diagnostics.push({
      code: "DS_BASELINE_INVALID",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return report;
}
