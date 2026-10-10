import React from "react";
import { createRoot } from "react-dom/client";
import "./ui.css";
type Drift = {
  token: string;
  name: string;
  mode: string;
  repository: unknown;
  figma: unknown;
  status: "missing" | "mismatch" | "match";
};
function App() {
  const [text, setText] = React.useState("");
  const [drift, setDrift] = React.useState<Drift[]>([]);
  const [selected, setSelected] = React.useState(new Set<string>());
  const [error, setError] = React.useState("");
  const [snapshot, setSnapshot] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const handle = (event: MessageEvent) => {
      const m = event.data?.pluginMessage;
      if (!m) return;
      if (m.type === "SCAN_RESULT") {
        setDrift(m.drift);
        setSelected(
          new Set(
            m.drift
              .filter((d: Drift) => d.status !== "match")
              .map((d: Drift) => `${d.token}::${d.mode}`),
          ),
        );
        setError("");
        setBusy(false);
        setStatus("Scan complete. Review changes before applying.");
      } else if (m.type === "EXPORT_RESULT") {
        setSnapshot(JSON.stringify(m.snapshot, null, 2));
        setBusy(false);
        setError("");
        setStatus(
          `Exported ${m.snapshot.variables.length} variables and ${m.snapshot.components.length} components.`,
        );
      } else if (m.type === "APPLY_RESULT") {
        setBusy(false);
        setSelected(new Set());
        setStatus(`Applied ${m.count} value changes. Scan again to verify.`);
      } else if (m.type === "ERROR") {
        setError(m.message);
        setBusy(false);
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);
  const send = (type: string, payload?: unknown) => {
    setBusy(true);
    setError("");
    parent.postMessage(
      {
        pluginMessage: { type, ...(payload !== undefined ? { payload } : {}) },
      },
      "*",
    );
  };
  const scan = () => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data.collections))
        throw new Error("Expected compiler metadata with collections.");
      send("SCAN", data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const download = () => {
    const blob = new Blob([snapshot], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "figma-snapshot.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <main>
      <header>
        <div>
          <small>DESIGN SYSTEM ↔ CODE</small>
          <h1>Connect your design system</h1>
        </div>
      </header>
      <section aria-labelledby="export-title">
        <h2 id="export-title">1. Export from Figma</h2>
        <p>
          Open your design system in Figma. For an offline <code>.fig</code>{" "}
          file, import it into Figma first. Export reads local variables, modes,
          aliases, and component properties.
        </p>
        <div className="actions">
          <button onClick={() => send("EXPORT")} disabled={busy}>
            Export current document
          </button>
          <button onClick={download} disabled={!snapshot || busy}>
            Download JSON
          </button>
        </div>
        {snapshot && (
          <>
            <label htmlFor="snapshot">Structured export</label>
            <textarea id="snapshot" value={snapshot} readOnly />
            <p>
              Create an explicit variable mapping, then run{" "}
              <code>
                ds import-figma figma-snapshot.json --mapping mapping.json --out
                candidates/figma
              </code>
              . Review candidate output before approving it.
            </p>
          </>
        )}
      </section>
      <section aria-labelledby="sync-title">
        <h2 id="sync-title">2. Check code → Figma drift</h2>
        <p>
          Paste generated <code>figma-tokens.json</code>. Select changes before
          applying values to this document.
        </p>
        <label htmlFor="metadata">Compiler metadata</label>
        <textarea
          id="metadata"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste generated Figma token metadata…"
        />
        <div className="actions">
          <button onClick={scan} disabled={busy || !text.trim()}>
            Scan variables
          </button>
          <button
            className="primary"
            onClick={() => {
              setBusy(true);
              parent.postMessage(
                { pluginMessage: { type: "APPLY", selected: [...selected] } },
                "*",
              );
            }}
            disabled={busy || !selected.size}
          >
            Apply {selected.size} selected
          </button>
        </div>
      </section>
      {busy && <p role="status">Reading design data…</p>}
      {status && <p role="status">{status}</p>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="list">
        {drift.map((d) => {
          const key = `${d.token}::${d.mode}`;
          return (
            <label key={key} className={d.status}>
              <input
                type="checkbox"
                checked={selected.has(key)}
                disabled={d.status === "match" || busy}
                onChange={(e) =>
                  setSelected((prev) => {
                    const n = new Set(prev);
                    e.target.checked ? n.add(key) : n.delete(key);
                    return n;
                  })
                }
              />
              <div>
                <strong>{d.token}</strong>
                <small>
                  {d.mode} · {d.status}
                </small>
                <code>
                  {String(d.figma ?? "∅")} → {String(d.repository)}
                </code>
              </div>
            </label>
          );
        })}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
