import type { Diagnostic, DiagnosticCode, SourceLocation } from "./types.js";

export class DiagnosticBag {
  readonly items: Diagnostic[] = [];
  error(code: DiagnosticCode, message: string, options: Partial<Omit<Diagnostic, "code" | "severity" | "message">> = {}): void {
    this.items.push({ code, severity: "error", message, ...options });
  }
  warn(code: DiagnosticCode, message: string, options: Partial<Omit<Diagnostic, "code" | "severity" | "message">> = {}): void {
    this.items.push({ code, severity: "warning", message, ...options });
  }
  info(code: DiagnosticCode, message: string, options: Partial<Omit<Diagnostic, "code" | "severity" | "message">> = {}): void {
    this.items.push({ code, severity: "info", message, ...options });
  }
  hasErrors(): boolean { return this.items.some((item) => item.severity === "error"); }
  merge(other: DiagnosticBag | Diagnostic[]): void { this.items.push(...(Array.isArray(other) ? other : other.items)); }
}

export class CompilerError extends Error {
  constructor(public readonly diagnostics: Diagnostic[]) {
    super(formatDiagnostics(diagnostics));
    this.name = "CompilerError";
  }
}

export function formatDiagnostic(d: Diagnostic): string {
  const source = d.source ? `\n${d.source.file}:${d.source.line}:${d.source.column}` : "";
  const token = d.token ? `\n${d.token}` : "";
  const details = d.details?.length ? `\n${d.details.join("\n")}` : "";
  const suggestion = d.suggestion ? `\nDid you mean: ${d.suggestion}` : "";
  return `${d.code} [${d.severity.toUpperCase()}]${source}${token}\n${d.message}${details}${suggestion}`;
}

export function formatDiagnostics(items: Diagnostic[]): string {
  return items.map(formatDiagnostic).join("\n\n");
}

export function sourceAt(file: string, text: string, needle: string): SourceLocation {
  const index = Math.max(0, text.indexOf(needle));
  const before = text.slice(0, index);
  const lines = before.split(/\r?\n/);
  return { file, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
