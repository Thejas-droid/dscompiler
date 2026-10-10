import path from "node:path";
import { loadConfig, resolveConfigPaths } from "@dsc/compiler";
import type { Plugin, ViteDevServer } from "vite";
import { inspectProject, formatInspection } from "./index.js";
import type { InspectionReport } from "./types.js";

export interface DesignSystemPluginOptions {
  config?: string;
  devMode?: "warn" | "strict";
  failOnWarnings?: boolean;
  indicator?: boolean;
  debounceMs?: number;
}
const virtualId = "virtual:ds-report";
const resolvedId = `\0${virtualId}`;
export function designSystem(options: DesignSystemPluginOptions = {}): Plugin {
  let root: string;
  let base = "/";
  let command: string;
  let server: ViteDevServer | undefined;
  let report: InspectionReport;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let running: Promise<void> | undefined;
  let dirty = false;
  let generatedRoot: string | undefined;
  const endpoint = () => `${base}__ds/report`;
  async function scan(): Promise<void> {
    report = await inspectProject({
      cwd: root,
      ...(options.config ? { config: options.config } : {}),
      mode: command === "build" ? "strict" : (options.devMode ?? "warn"),
      ...(options.failOnWarnings !== undefined
        ? { failOnWarnings: options.failOnWarnings }
        : {}),
      emit: true,
    });
    if (server && !disposed) {
      server.config.logger.info(formatInspection(report));
      server.ws.send({ type: "custom", event: "ds:report", data: report });
      try {
        const loaded = await loadConfig(root, options.config);
        const config = resolveConfigPaths(loaded.config, loaded.file);
        generatedRoot = config.outDir;
        server.watcher.add([
          loaded.file,
          ...config.tokens,
          ...(config.themes ? [config.themes] : []),
          ...(config.enforcement
            ? [
                path.resolve(
                  path.dirname(loaded.file),
                  config.enforcement.contract,
                ),
              ]
            : []),
        ]);
      } catch {
        /* report contains baseline errors; watch the root for recovery */
      }
    }
  }
  async function refresh(): Promise<void> {
    if (running) {
      dirty = true;
      return running;
    }
    running = (async () => {
      do {
        dirty = false;
        await scan();
      } while (dirty && !disposed);
    })();
    try {
      await running;
    } finally {
      running = undefined;
    }
  }
  function changed(file: string) {
    if (disposed) return;
    const full = path.resolve(file);
    if (
      generatedRoot &&
      (full === generatedRoot || full.startsWith(generatedRoot + path.sep))
    )
      return;
    if (
      /(?:^|[\\/])(?:node_modules|\.git|\.dsc-cache\.json|\.ds\.config\.[^/]+\.mjs)(?:[\\/]|$)/.test(
        file,
      )
    )
      return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void refresh().catch((error) =>
        server?.config.logger.error(String(error)),
      );
    }, options.debounceMs ?? 100);
  }
  function dispose() {
    disposed = true;
    clearTimeout(timer);
    server?.watcher.off("add", changed);
    server?.watcher.off("change", changed);
    server?.watcher.off("unlink", changed);
  }
  return {
    name: "dsc-design-system",
    async configResolved(config) {
      root = config.root;
      base = config.base;
      command = config.command;
      await scan();
      if (!report.passed) throw new Error(formatInspection(report));
      config.logger.info(formatInspection(report));
    },
    async configureServer(devServer) {
      server = devServer;
      disposed = false;
      await scan();
      if (!report.passed) throw new Error(formatInspection(report));
      server.watcher
        .on("add", changed)
        .on("change", changed)
        .on("unlink", changed);
      server.middlewares.use((req, res, next) => {
        // Vite's base middleware may have already removed the base prefix.
        if (
          req.url?.split("?")[0] !== endpoint() &&
          req.url?.split("?")[0] !== "/__ds/report"
        )
          return next();
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(report));
      });
      server.httpServer?.once("close", dispose);
    },
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId)
        return command === "serve"
          ? browserClient(endpoint())
          : "export const subscribeReport = () => () => {}; export const readReport = async () => null; export const installIndicator = () => {};";
    },
    transformIndexHtml() {
      if (command !== "serve" || options.indicator === false) return;
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: `import { installIndicator } from ${JSON.stringify(`${base}@id/__x00__${virtualId}`)}; installIndicator();`,
          injectTo: "body",
        },
      ];
    },
    async buildStart() {
      if (command === "build") {
        // Recheck at each build, including Vite build --watch iterations.
        await scan();
        if (!report.passed) this.error(formatInspection(report));
      }
    },
    closeBundle() {
      dispose();
    },
  };
}
function browserClient(endpoint: string): string {
  return `
const listeners = new Set();
let latest;
function publish(report) { latest = report; for (const listener of listeners) listener(report); }
export async function readReport() {
  const response = await fetch(${JSON.stringify(endpoint)}, {cache: "no-store"});
  if (!response.ok) throw new Error("Design-system report unavailable");
  return response.json();
}
export function subscribeReport(listener) {
  listeners.add(listener);
  if (latest) listener(latest);
  return () => listeners.delete(listener);
}
if (import.meta.hot) import.meta.hot.on("ds:report", publish);
readReport().then(publish).catch(() => {});
export function installIndicator() {
  if (document.getElementById("dsc-indicator")) return;
  const host = document.createElement("div"); host.id = "dsc-indicator";
  const shadow = host.attachShadow({mode: "open"});
  const style = document.createElement("style");
  style.textContent = ":host{position:fixed;bottom:16px;right:16px;z-index:2147483647;font:14px/1.5 system-ui;color:#eef2ff}details{background:#172033;border:1px solid #74819c;border-radius:12px;box-shadow:0 8px 30px #0003;max-width:min(440px,calc(100vw - 32px))}summary{cursor:pointer;padding:12px 16px;font-weight:600}section{max-height:50vh;overflow:auto;padding:0 16px 12px}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}small{color:#c6d0e5}";
  const details = document.createElement("details");
  const summary = document.createElement("summary"); summary.textContent = "Design system: checking…";
  const content = document.createElement("section"); content.setAttribute("aria-live", "polite");
  details.append(summary, content); shadow.append(style, details); document.body.append(host);
  const unsubscribe = subscribeReport(report => {
    const errors = report.diagnostics.filter(d => d.severity === "error").length;
    const warnings = report.diagnostics.filter(d => d.severity === "warning").length;
    summary.textContent = !report.ready ? "Design system: baseline invalid" : errors || warnings ? "Design system: " + errors + " errors, " + warnings + " warnings" : "Design system: checks passed";
    content.replaceChildren();
    const info = document.createElement("p"); info.textContent = report.coverage.scanned.length + " files scanned · " + report.coverage.unsupported.length + " unsupported · " + report.suppressed.length + " exceptions"; content.append(info);
    for (const diagnostic of report.diagnostics) {
      const item = document.createElement("p");
      item.textContent = diagnostic.code + " · " + (diagnostic.source ? diagnostic.source.file + ":" + diagnostic.source.line + ":" + diagnostic.source.column + "\\n" : "") + diagnostic.message + (diagnostic.suggestion ? "\\n" + diagnostic.suggestion : ""); content.append(item);
    }
    const revision = document.createElement("small"); revision.textContent = "Contract " + (report.contractHash || "unavailable"); content.append(revision);
  });
  if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); host.remove(); });
}
`;
}
