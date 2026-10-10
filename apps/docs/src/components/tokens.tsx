import * as React from "react";
import { formatValue, themeValue, type Token } from "../model";
import { CodeBlock, Icon, Note } from "./ui";

export function TokenPage({
  tokens,
  theme,
  initialToken,
}: {
  tokens: Token[];
  theme: string;
  initialToken: string | undefined;
}) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [scope, setScope] = React.useState("all");
  const [selectedName, setSelectedName] = React.useState(
    initialToken ?? "color.button.primary.background",
  );
  const filtered = tokens.filter(
    (token) =>
      (type === "all" || token.type === type) &&
      (scope === "all" || token.sourceKind === scope) &&
      `${token.name} ${formatValue(themeValue(token, theme))} ${token.description ?? ""} ${token.cssVariable}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected =
    filtered.find((token) => token.name === selectedName) ?? filtered[0];
  const types = [...new Set(tokens.map((token) => token.type))].sort();
  const clear = () => {
    setQuery("");
    setType("all");
    setScope("all");
  };
  return (
    <>
      <Note>
        <strong>A token is a reusable design value.</strong> Instead of
        repeating a hex color in every file, use a name like{" "}
        <code>color.button.primary.background</code>. Select a token to see its
        source and usage.
      </Note>
      <div className="explorer-toolbar">
        <div className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search tokens"
            placeholder="Search tokens, values, or CSS variables…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear token search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <label className="filter-label">
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {["all", ...types].map((value) => (
              <option value={value} key={value}>
                {value === "all" ? "All types" : value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="result-toolbar">
        <div className="segmented" aria-label="Token source">
          {[
            { id: "all", label: "All tokens" },
            { id: "semantic", label: "Semantic" },
            { id: "primitive", label: "Primitives" },
          ].map((item) => (
            <button
              key={item.id}
              aria-pressed={scope === item.id}
              className={scope === item.id ? "selected" : ""}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="muted" role="status">
          {filtered.length} of {tokens.length} tokens
        </span>
      </div>
      <div className="explorer-layout">
        <section className="token-list-panel" aria-label="Token results">
          <div className="token-list-head">
            <span>TOKEN NAME</span>
            <span>RESOLVED VALUE · {theme.toUpperCase()}</span>
          </div>
          {filtered.length ? (
            filtered.map((token) => (
              <button
                className={`token-row ${selected?.name === token.name ? "selected" : ""}`}
                key={token.name}
                aria-pressed={selected?.name === token.name}
                onClick={() => setSelectedName(token.name)}
              >
                <span className="token-name-cell">
                  <TokenSample token={token} theme={theme} />
                  <span>
                    <code>{token.name}</code>
                    <small>
                      {token.type}
                      {token.deprecated ? " · deprecated" : ""}
                    </small>
                  </span>
                </span>
                <span className="token-value-cell">
                  <code>{formatValue(themeValue(token, theme))}</code>
                  <Icon name="arrow" size={15} />
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <Icon name="search" size={30} />
              <h2>No matching tokens</h2>
              <p>Try a shorter search or remove a filter.</p>
              <button className="secondary-button" onClick={clear}>
                Clear filters
              </button>
            </div>
          )}
        </section>
        {selected && (
          <section
            className="panel token-detail"
            aria-label="Selected token details"
          >
            <div className="panel-heading">
              <span className="eyebrow">TOKEN DETAILS</span>
              <span className="pill">
                {selected.sourceKind ?? selected.type}
              </span>
            </div>
            <h2>{selected.name}</h2>
            <p>
              {selected.description ??
                (selected.reference
                  ? "A semantic name that references another token."
                  : "A shared value from your design system.")}
            </p>
            <div className="detail-preview">
              <TokenSample token={selected} theme={theme} large />
              <strong>{formatValue(themeValue(selected, theme))}</strong>
              <span className="muted">Resolved in {theme}</span>
            </div>
            {selected.deprecated && (
              <div className="deprecated-note">
                <strong>Deprecated token</strong>
                <p>
                  {typeof selected.deprecated === "object"
                    ? (selected.deprecated.message ??
                      "Choose an active replacement.")
                    : "Choose an active replacement."}
                </p>
                {typeof selected.deprecated === "object" &&
                  selected.deprecated.replacement && (
                    <code>{selected.deprecated.replacement}</code>
                  )}
              </div>
            )}
            <dl className="detail-facts">
              <div>
                <dt>Type</dt>
                <dd>{selected.type}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  <code>
                    {selected.source
                      ? `${selected.source.file}:${selected.source.line}`
                      : "Token source"}
                  </code>
                </dd>
              </div>
              {selected.reference && (
                <div>
                  <dt>References</dt>
                  <dd>
                    <code>{selected.reference}</code>
                  </dd>
                </div>
              )}
            </dl>
            <CodeBlock
              label="CSS usage"
              code={`.your-element {\n  ${cssProperty(selected)}: var(${selected.cssVariable});\n}`}
              copyLabel="Copy CSS usage"
            />
            <CodeBlock
              label="TypeScript usage"
              code={`import { token } from "./dist/tokens";\n\ntoken("${selected.name}");`}
              copyLabel="Copy TypeScript usage"
            />
            <p className="step-help">
              Import generated <code>dist/tokens.css</code> into your app once.
              Adjust the TypeScript import path for your file.
            </p>
          </section>
        )}
      </div>
      <p className="scope-help">
        <strong>Primitives</strong> are raw values, such as purple.500.{" "}
        <strong>Semantic tokens</strong> describe their purpose, such as
        button.primary.background.
      </p>
    </>
  );
}
function cssProperty(token: Token) {
  if (token.name.startsWith("radius.")) return "border-radius";
  if (token.name.startsWith("space.") || token.name.startsWith("spacing."))
    return "padding";
  return (
    (
      {
        color: "color",
        dimension: "padding",
        fontFamily: "font-family",
        fontSize: "font-size",
        fontWeight: "font-weight",
        lineHeight: "line-height",
        shadow: "box-shadow",
        opacity: "opacity",
        duration: "transition-duration",
        cubicBezier: "transition-timing-function",
      } as Record<string, string>
    )[token.type] ?? "value"
  );
}
function TokenSample({
  token,
  theme,
  large = false,
}: {
  token: Token;
  theme: string;
  large?: boolean;
}) {
  const value = formatValue(themeValue(token, theme));
  return (
    <span
      className={`token-sample ${large ? "large" : ""} ${token.type === "color" ? "color" : ""}`}
      style={token.type === "color" ? { background: value } : undefined}
      aria-hidden="true"
    >
      {token.type === "color"
        ? null
        : token.type.startsWith("font")
          ? "Aa"
          : token.type === "dimension"
            ? "↔"
            : token.type === "shadow"
              ? "▢"
              : "#"}
    </span>
  );
}
