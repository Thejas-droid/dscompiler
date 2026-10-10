import * as React from "react";
import {
  formatValue,
  prettyName,
  themeStyle,
  themeValue,
  type Token,
} from "../model";
import { CopyButton, Note } from "./ui";

export function ThemePage({
  tokens,
  theme,
  onTheme,
}: {
  tokens: Token[];
  theme: string;
  onTheme: (value: string) => void;
}) {
  const [changedOnly, setChangedOnly] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const names = [
    ...new Set(tokens.flatMap((token) => Object.keys(token.themes ?? {}))),
  ].sort((a, b) =>
    a === "light" ? -1 : b === "light" ? 1 : a.localeCompare(b),
  );
  const changed = (token: Token) =>
    new Set(names.map((name) => formatValue(themeValue(token, name)))).size > 1;
  const filtered = tokens.filter(
    (token) =>
      (!changedOnly || changed(token)) &&
      token.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Note>
        <strong>Themes change values, not names.</strong> Your code still uses
        the same CSS variable. Select a theme to preview it throughout the
        explorer, or compare values below.
      </Note>
      <div className="theme-cards">
        {names.map((name) => (
          <article
            key={name}
            className={`theme-card ${theme === name ? "active" : ""}`}
          >
            <div className="theme-mini-app" style={themeStyle(tokens, name)}>
              <div className="mini-app-bar">
                <span />
                <span />
                <span />
                <small>workspace</small>
              </div>
              <div className="mini-app-body">
                <span className="mini-kicker">YOUR NEXT PROJECT</span>
                <h2>
                  Make something
                  <br />
                  consistent.
                </h2>
                <p>A foundation you can build on.</p>
                <span className="mini-primary">
                  Get started <span aria-hidden="true">→</span>
                </span>
                <div className="mini-progress">
                  <span />
                </div>
                <div className="mini-palette">
                  {[
                    "color.background.surface",
                    "color.background.subtle",
                    "color.button.primary.background",
                    "color.text.primary",
                  ].map((path) => (
                    <span
                      key={path}
                      style={{
                        background: formatValue(
                          themeValue(
                            tokens.find((token) => token.name === path) ?? {
                              name: path,
                              type: "color",
                              cssVariable: "",
                              resolvedValue: "#ccc",
                            },
                            name,
                          ),
                        ),
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="theme-card-bottom">
              <div>
                <h3>{prettyName(name)}</h3>
                <p>
                  {
                    tokens.filter(
                      (token) =>
                        formatValue(themeValue(token, name)) !==
                        formatValue(token.resolvedValue),
                    ).length
                  }{" "}
                  values differ from base
                </p>
              </div>
              <button
                className={theme === name ? "theme-active" : "secondary-button"}
                aria-pressed={theme === name}
                onClick={() => onTheme(name)}
              >
                {theme === name ? "Selected" : "Use theme"}
                <span className="sr-only"> {name}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      <section
        className="panel theme-table-panel"
        aria-labelledby="compare-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="compare-title">Compare the actual values</h2>
            <p>Spot the tokens that change between themes.</p>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={changedOnly}
              onChange={(event) => setChangedOnly(event.target.checked)}
            />
            Only show differences
          </label>
        </div>
        <label className="theme-search">
          Search comparison
          <input
            placeholder="e.g. color.background"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable theme comparison"
        >
          <table>
            <caption className="sr-only">
              Resolved token values by theme
            </caption>
            <thead>
              <tr>
                <th scope="col">Token</th>
                {names.map((name) => (
                  <th scope="col" key={name}>
                    {prettyName(name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((token) => (
                <tr key={token.name}>
                  <th scope="row">
                    <code>{token.name}</code>
                  </th>
                  {names.map((name) => (
                    <td key={name}>
                      <span className="comparison-value">
                        {token.type === "color" && (
                          <i
                            style={{
                              background: formatValue(themeValue(token, name)),
                            }}
                          />
                        )}
                        <code>{formatValue(themeValue(token, name))}</code>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="empty-state">
              No tokens match this comparison. Try another search.
            </p>
          )}
        </div>
      </section>
      <div className="theme-usage panel">
        <div>
          <h2>Use a theme in your app</h2>
          <p>
            Import <code>dist/tokens.css</code> and{" "}
            <code>dist/themes/{theme}.css</code>, then set the theme on your
            app’s root element.
          </p>
        </div>
        <div>
          <code>{`<html data-theme="${theme}">`}</code>
          <CopyButton
            text={`<html data-theme="${theme}">`}
            label="Copy theme attribute"
          />
        </div>
      </div>
    </>
  );
}
