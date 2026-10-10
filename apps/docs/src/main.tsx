import * as React from "react";
import { createRoot } from "react-dom/client";
import "@dsc/react/styles.css";
import "./styles.css";
import {
  pages,
  prettyName,
  themeStyle,
  type Component,
  type Page,
  type Token,
} from "./model";
import { Icon, CodeBlock } from "./components/ui";
import { StartPage, TestingPage } from "./components/guides";
import { TokenPage } from "./components/tokens";
import { ThemePage } from "./components/themes";
import { ComponentPage } from "./components/component-page";

function currentPage(): Page {
  const hash = window.location.hash.slice(1).split("?")[0];
  return pages.find((page) => page.id === hash)?.id ?? "start";
}
function savedTheme(): string {
  try {
    return localStorage.getItem("dsc-preview-theme") ?? "light";
  } catch {
    return "light";
  }
}
async function loadData<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(`Could not load ${path} (${response.status}).`);
  if (response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(
      "The generated documentation files are missing. Run `pnpm ds build`, then restart `pnpm run docs`.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      throw new Error(
        `The documentation file ${path} is not valid JSON. Rebuild your tokens and restart the docs server.`,
      );
    }
    throw cause;
  }
  if (
    !Array.isArray(data) ||
    !data.length ||
    !data.every(
      (item) =>
        item && typeof item === "object" && typeof item.name === "string",
    )
  ) {
    throw new Error("Generated documentation data is missing or invalid.");
  }
  return data as T[];
}
function App() {
  const [page, setPage] = React.useState<Page>(currentPage);
  const [tokens, setTokens] = React.useState<Token[]>([]);
  const [components, setComponents] = React.useState<Component[]>([]);
  const [theme, setTheme] = React.useState(savedTheme);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = React.useState("");
  const [reload, setReload] = React.useState(0);
  const title = pages.find((item) => item.id === page)!;
  const themeNames = [
    ...new Set(tokens.flatMap((token) => Object.keys(token.themes ?? {}))),
  ].sort((a, b) =>
    a === "light" ? -1 : b === "light" ? 1 : a.localeCompare(b),
  );
  React.useEffect(() => {
    const navigate = () => {
      setPage(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    Promise.all([
      loadData<Token>("/data/tokens.json", controller.signal),
      loadData<Component>("/data/components.json", controller.signal),
    ])
      .then(([loadedTokens, loadedComponents]) => {
        setTokens(loadedTokens);
        setComponents(loadedComponents);
        setStatus("ready");
        const names = new Set(
          loadedTokens.flatMap((token) => Object.keys(token.themes ?? {})),
        );
        setTheme((value) =>
          names.has(value) ? value : (names.values().next().value ?? "light"),
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load documentation data.",
          );
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [reload]);
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const styles = themeStyle(tokens, theme);
    for (const [property, value] of Object.entries(styles))
      document.documentElement.style.setProperty(property, String(value));
    try {
      localStorage.setItem("dsc-preview-theme", theme);
    } catch {
      /* Preview still works if storage is unavailable. */
    }
    return () => {
      for (const property of Object.keys(styles))
        document.documentElement.style.removeProperty(property);
    };
  }, [theme, tokens]);
  React.useEffect(() => {
    document.title = `${title.label} · Design-System Compiler`;
  }, [title.label]);
  const tokenName = new URLSearchParams(
    window.location.hash.split("?")[1] ?? "",
  ).get("token");
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
          document.getElementById("main-content")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <div className="app">
        <aside className="sidebar">
          <a
            className="brand"
            href="#start"
            aria-label="Design-System Compiler home"
          >
            <span className="brand-mark">
              <Icon name="layers" size={24} />
            </span>
            <span>
              <strong>Design System</strong>
              <small>COMPILER WORKSPACE</small>
            </span>
          </a>
          <div className="workspace-label">
            <span className="status-dot" />
            Local workspace<span className="workspace-version">v0.1</span>
          </div>
          <span className="nav-label">WORKSPACE</span>
          <nav aria-label="Main navigation">
            {pages.slice(0, 4).map((item) => (
              <a
                className={page === item.id ? "active" : ""}
                href={`#${item.id}`}
                key={item.id}
                aria-current={page === item.id ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {status === "ready" &&
                  (item.id === "tokens" || item.id === "components") && (
                    <span className="nav-count">
                      {item.id === "tokens" ? tokens.length : components.length}
                    </span>
                  )}
              </a>
            ))}
          </nav>
          <span className="nav-label learn-label">LEARN & VERIFY</span>
          <nav aria-label="Learning navigation">
            <a
              className={page === "testing" ? "active" : ""}
              href="#testing"
              aria-current={page === "testing" ? "page" : undefined}
            >
              <Icon name="check" />
              <span>How to test</span>
            </a>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-help">
              <span className="help-icon">
                <Icon name="book" size={20} />
              </span>
              <strong>New to design tokens?</strong>
              <p>
                Start with a small change.
                <br />
                We’ll walk you through it.
              </p>
              <a href="#testing">
                Your first experiment <Icon name="arrow" size={15} />
              </a>
            </div>
            <div className="sidebar-footer">
              <span className="status-dot" />
              <span>
                {status === "ready"
                  ? "Documentation loaded"
                  : status === "loading"
                    ? "Loading workspace…"
                    : "Data needs attention"}
              </span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <strong>{title.label}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="reload-button"
                onClick={() => setReload((value) => value + 1)}
                disabled={status === "loading"}
                aria-label="Reload documentation data"
              >
                <Icon name="refresh" size={16} />
                <span>Reload data</span>
              </button>
              <span className="topbar-divider" />
              <label className="theme-control">
                <Icon name={theme === "dark" ? "moon" : "sun"} size={17} />
                <span>Preview</span>
                <select
                  aria-label="Preview theme"
                  value={theme}
                  disabled={status !== "ready"}
                  onChange={(event) => setTheme(event.target.value)}
                >
                  {(themeNames.length ? themeNames : [theme]).map((name) => (
                    <option key={name} value={name}>
                      {prettyName(name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {page === "start"
                    ? "WELCOME TO YOUR WORKSPACE"
                    : "DESIGN-SYSTEM COMPILER"}
                </span>
                <h1>{title.subtitle}</h1>
                <p>
                  {
                    (
                      {
                        start:
                          "A guided workspace for exploring, using, and testing your design system.",
                        tokens:
                          "Find a value, understand its purpose, and use it in your code.",
                        themes:
                          "Preview your themes and see exactly what changes between them.",
                        components:
                          "Explore live examples, keyboard behavior, and installation commands.",
                        testing:
                          "Follow a first-change tutorial, then learn how to run the checks.",
                      } satisfies Record<Page, string>
                    )[page]
                  }
                </p>
              </div>
              <span className="page-badge">
                <span className="status-dot" />
                {status === "ready"
                  ? "From your project"
                  : status === "loading"
                    ? "Loading data"
                    : "Data unavailable"}
              </span>
            </div>
            {status === "loading" ? (
              <section className="loading-state" role="status">
                <span className="loading-spinner" />
                <h2>Loading your design system</h2>
                <p>Reading token and component documentation…</p>
              </section>
            ) : status === "error" ? (
              <section className="panel data-error" role="alert">
                <Icon name="info" size={32} />
                <h2>Let’s load your workspace data</h2>
                <p>{error}</p>
                <p>
                  Compile your tokens, restart the docs server to copy the
                  generated data, then refresh this page.
                </p>
                <CodeBlock code={"pnpm ds build\npnpm run docs"} />
                <button
                  className="primary-link"
                  onClick={() => setReload((value) => value + 1)}
                >
                  Try again <Icon name="refresh" size={16} />
                </button>
              </section>
            ) : (
              <>
                {page === "start" && (
                  <StartPage
                    tokens={tokens}
                    components={components}
                    theme={theme}
                  />
                )}{" "}
                {page === "tokens" && (
                  <TokenPage
                    key={tokenName ?? "tokens"}
                    tokens={tokens}
                    theme={theme}
                    initialToken={tokenName ?? undefined}
                  />
                )}{" "}
                {page === "themes" && (
                  <ThemePage tokens={tokens} theme={theme} onTheme={setTheme} />
                )}{" "}
                {page === "components" && (
                  <ComponentPage components={components} theme={theme} />
                )}{" "}
                {page === "testing" && <TestingPage tokens={tokens} />}
              </>
            )}
            <footer className="main-footer">
              <span>
                Design-System Compiler <span className="muted">/</span> Your
                source of consistency.
              </span>
              <a href="#testing">
                Need a hand? Start with the guide{" "}
                <Icon name="arrow" size={14} />
              </a>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
