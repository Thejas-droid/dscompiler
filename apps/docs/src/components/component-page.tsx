import * as React from "react";
import { prettyName, type Component } from "../model";
import { ComponentPreview } from "./previews";
import { CodeBlock, Icon, Note } from "./ui";

export function ComponentPage({
  components,
  theme,
}: {
  components: Component[];
  theme: string;
}) {
  const [name, setName] = React.useState("button");
  const [query, setQuery] = React.useState("");
  const selected =
    components.find((component) => component.name === name) ?? components[0];
  const filtered = components.filter((component) =>
    component.name.includes(query.toLowerCase()),
  );
  return (
    <>
      <Note>
        <strong>These are working React components.</strong> Click, focus, and
        use your keyboard to test them. The preview uses the selected theme and
        your compiled token values.
      </Note>
      <div className="component-layout">
        <section
          className="panel component-picker"
          aria-label="Choose a component"
        >
          <div className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search components"
              placeholder="Find a component…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="component-options">
            {filtered.map((component) => (
              <button
                key={component.name}
                aria-pressed={selected?.name === component.name}
                className={selected?.name === component.name ? "selected" : ""}
                onClick={() => setName(component.name)}
              >
                <Icon name="grid" size={16} />
                <span>{prettyName(component.name)}</span>
                <Icon name="arrow" size={14} />
              </button>
            ))}
            {!filtered.length && (
              <p>No components found. Try another search.</p>
            )}
          </div>
        </section>
        {selected && (
          <div className="component-content">
            <section
              className="panel preview-panel"
              aria-labelledby="component-title"
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">INTERACTIVE PREVIEW</span>
                  <h2 id="component-title">{prettyName(selected.name)}</h2>
                </div>
                <span className="pill">v{selected.version}</span>
              </div>
              <p>{selected.description}</p>
              <div className="component-stage">
                <span className="stage-label">
                  {theme} theme · live component
                </span>
                <ComponentPreview key={selected.name} name={selected.name} />
              </div>
              <div className="keyboard-guide">
                <Icon name="terminal" size={18} />
                <div>
                  <strong>Try it with your keyboard</strong>
                  <ul>
                    {(
                      selected.accessibility?.keyboard ?? [
                        "Use Tab to focus the component.",
                      ]
                    ).map((instruction) => (
                      <li key={instruction}>{instruction}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
            <section className="panel component-install">
              <div className="section-heading">
                <div>
                  <h2>Bring it into your project</h2>
                  <p>
                    The CLI copies component source files that you can edit.
                  </p>
                </div>
                <span className="pill">SOURCE OWNED</span>
              </div>
              <CodeBlock
                code={`pnpm ds add ${selected.name} --dry-run`}
                copyLabel="Copy installation preview command"
              />
              <p className="step-help">
                Run this in your project terminal to preview the files. Remove{" "}
                <code>--dry-run</code> when you want to copy them into{" "}
                <code>components/ui</code>.
              </p>
              {selected.files?.length ? (
                <p className="component-files">
                  Files:{" "}
                  {selected.files.map((file) => (
                    <code key={file}>{file}</code>
                  ))}
                </p>
              ) : null}
            </section>
            <section className="panel component-tokens">
              <h2>Design tokens it uses</h2>
              <p>
                These names connect the component’s appearance to your design
                system.
              </p>
              <div className="token-chips">
                {selected.tokens?.map((token) => (
                  <a
                    key={token}
                    href={`#tokens?token=${encodeURIComponent(token)}`}
                  >
                    {token}
                    <Icon name="arrow" size={13} />
                  </a>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
