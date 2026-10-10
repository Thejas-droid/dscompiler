import * as React from "react";
import { Button } from "@dsc/react";
import type { Component, Token } from "../model";
import { formatValue, prettyName, themeValue } from "../model";
import { CodeBlock, Icon, Note } from "./ui";

export function StartPage({
  tokens,
  components,
  theme,
}: {
  tokens: Token[];
  components: Component[];
  theme: string;
}) {
  const themes = new Set(
    tokens.flatMap((token) => Object.keys(token.themes ?? {})),
  );
  const example = tokens.find(
    (token) => token.name === "color.button.primary.background",
  );
  return (
    <>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="eyebrow">A SMALL CHANGE. A CONSISTENT SYSTEM.</span>
          <h2 id="welcome-title">
            Design once.
            <br />
            Use it everywhere.
          </h2>
          <p>
            Colors, spacing, and components work better together. This workspace
            helps you understand, preview, and test the design decisions behind
            your app.
          </p>
          <div className="welcome-actions">
            <a className="primary-link" href="#tokens">
              Explore your tokens <Icon name="arrow" size={17} />
            </a>
            <a className="text-link" href="#testing">
              Try your first change <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
        <div
          className="welcome-visual"
          aria-label="Example of a token becoming a button"
        >
          <div className="visual-top">
            <span className="mini-dot" /> THE DESIGN → CODE CONNECTION
          </div>
          <div className="visual-token">
            <span
              className="visual-swatch"
              style={{
                background: example
                  ? formatValue(themeValue(example, theme))
                  : "#7224D8",
              }}
            />
            <div>
              <small>Design token</small>
              <code>color.button.primary.background</code>
            </div>
            <span className="visual-tag">color</span>
          </div>
          <div className="flow-connector">
            <span />↓<span />
          </div>
          <div className="visual-code">
            <code>
              background:{" "}
              <span>
                var(--ds-color-button-
                <br />
                primary-background)
              </span>
              ;
            </code>
          </div>
          <div className="flow-connector">
            <span />↓<span />
          </div>
          <div className="visual-result">
            <span>Working component</span>
            <Button
              onClick={() => {
                window.location.hash = "components";
              }}
            >
              Try it yourself <Icon name="arrow" size={16} />
            </Button>
          </div>
          <p className="visual-foot">One named value. Shared across your UI.</p>
        </div>
      </section>
      <div className="stat-grid">
        {[
          {
            count: tokens.length,
            name: "Design tokens",
            note: "Your reusable design values",
            href: "tokens",
            icon: "palette",
          },
          {
            count: themes.size,
            name: "Themes",
            note: "Different looks, the same system",
            href: "themes",
            icon: "layers",
          },
          {
            count: components.length,
            name: "Components",
            note: "Interactive React building blocks",
            href: "components",
            icon: "grid",
          },
        ].map((stat) => (
          <a className="stat-card" href={`#${stat.href}`} key={stat.name}>
            <span className="stat-icon">
              <Icon name={stat.icon} />
            </span>
            <div>
              <strong>{stat.count}</strong>
              <span>{stat.name}</span>
              <small>{stat.note}</small>
            </div>
            <Icon name="arrow" size={18} />
          </a>
        ))}
      </div>
      <section aria-labelledby="first-steps">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR FIRST FIVE MINUTES</span>
            <h2 id="first-steps">A good place to start</h2>
          </div>
          <span className="muted">No design-system experience needed</span>
        </div>
        <div className="journey-grid">
          {[
            {
              n: "01",
              title: "Understand a token",
              text: "A token is a name for a design value. Find a color, see where it comes from, and copy its CSS usage.",
              href: "tokens",
              action: "Explore tokens",
            },
            {
              n: "02",
              title: "See it in a component",
              text: "Click a button, open a dialog, and switch themes. These examples use the actual React components.",
              href: "components",
              action: "Try components",
            },
            {
              n: "03",
              title: "Make your first change",
              text: "Edit a token in your project, rebuild, and check the result. Follow the guide one step at a time.",
              href: "testing",
              action: "Follow the test guide",
            },
          ].map((step) => (
            <article className="journey-card" key={step.n}>
              <span className="step-number">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <a className="text-link" href={`#${step.href}`}>
                {step.action}
                <Icon name="arrow" size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="workflow-panel" aria-labelledby="workflow-title">
        <div>
          <Icon name="code" size={24} />
          <h2 id="workflow-title">How everything connects</h2>
          <p>
            You edit the source values. The compiler builds the files your app
            uses.
          </p>
        </div>
        <ol className="workflow">
          <li>
            <span>1</span>
            <strong>Define</strong>
            <small>Token JSON files</small>
          </li>
          <li>
            <span>2</span>
            <strong>Compile</strong>
            <small>Validate and resolve values</small>
          </li>
          <li>
            <span>3</span>
            <strong>Use</strong>
            <small>CSS + TypeScript + React</small>
          </li>
          <li>
            <span>4</span>
            <strong>Verify</strong>
            <small>Tests and browser checks</small>
          </li>
        </ol>
      </section>
      <Note>
        This app is your explorer and practice space. Edit token files and run
        commands in your project terminal. Start with{" "}
        <a href="#testing">How to test</a> for a guided example.
      </Note>
    </>
  );
}

const manualChecks = [
  "Find radius.control in Design tokens and check its resolved value.",
  "Try a component with the mouse and then with the keyboard.",
  "Switch between Light and Dark and compare the previews.",
  "Open a dialog, press Escape, and check that focus returns to its trigger.",
];
export function TestingPage({ tokens }: { tokens: Token[] }) {
  const [checked, setChecked] = React.useState<string[]>([]);
  const radius = tokens.find((token) => token.name === "radius.control");
  return (
    <>
      <div className="guide-intro">
        <span className="intro-icon">
          <Icon name="check" size={24} />
        </span>
        <div>
          <h2>Make one change. See the result.</h2>
          <p>
            A small radius change is an easy first experiment. Follow these
            steps in the project folder where you run <code>pnpm run docs</code>
            .
          </p>
        </div>
        <span className="pill">ABOUT 5 MINUTES</span>
      </div>
      <div className="guide-layout">
        <section className="steps-panel" aria-label="First change tutorial">
          <article className="guide-step">
            <span className="number-circle">1</span>
            <div>
              <h3>Find the source value</h3>
              <p>
                Open <code>tokens/semantic.json</code> in your editor. Search
                for <code>radius</code>, then find <code>control</code>. This
                token determines the roundness of buttons and form controls.
              </p>
              <CodeBlock
                label="JSON · tokens/semantic.json"
                code={`"control": {\n  "$type": "dimension",\n  "$value": "12px"\n}`}
                copyLabel="Copy example token"
              />
              <p className="step-help">
                Replace the existing control value with <code>12px</code> and
                save.{" "}
                {radius && (
                  <>
                    Its current resolved value is{" "}
                    <strong>{formatValue(radius.resolvedValue)}</strong>.
                  </>
                )}
              </p>
            </div>
          </article>
          <article className="guide-step">
            <span className="number-circle">2</span>
            <div>
              <h3>Compile your change</h3>
              <p>
                Open a second terminal in the project folder. This command
                validates your token files and generates the CSS, TypeScript,
                and documentation data.
              </p>
              <CodeBlock code="pnpm ds build" />
              <p className="expected">
                <Icon name="check" size={15} />
                <span>
                  Expected: a “Compiled” message with token, theme, and artifact
                  counts.
                </span>
              </p>
            </div>
          </article>
          <article className="guide-step">
            <span className="number-circle">3</span>
            <div>
              <h3>Refresh the explorer</h3>
              <p>
                In the terminal running this app, press <kbd>Ctrl</kbd> +{" "}
                <kbd>C</kbd>, then start it again. Restarting copies the newly
                generated data into the explorer.
              </p>
              <CodeBlock code="pnpm run docs" />
              <p>
                Refresh your browser, open <a href="#components">Components</a>,
                and select Button. The button corners should now look rounder.
              </p>
            </div>
          </article>
          <article className="guide-step">
            <span className="number-circle">4</span>
            <div>
              <h3>Verify the result</h3>
              <p>
                Check that the compiled output matches the source, then run the
                compiler unit tests.
              </p>
              <CodeBlock
                code={
                  "pnpm ds check --skip-browser\npnpm --filter @dsc/compiler test"
                }
              />
              <p className="expected">
                <Icon name="check" size={15} />
                <span>
                  Expected: “Design system check passed” and passing compiler
                  tests.
                </span>
              </p>
              <p className="step-help">
                To undo the experiment, restore the original token value,
                compile again, and restart the explorer.
              </p>
            </div>
          </article>
        </section>
        <div className="guide-sidebar">
          <section className="panel checklist" aria-labelledby="practice-title">
            <div className="panel-heading">
              <h2 id="practice-title">Try it in the browser</h2>
              <span className="pill">
                {checked.length}/{manualChecks.length}
              </span>
            </div>
            <p>Tick each item after you check it yourself.</p>
            <div className="progress-track">
              <span
                style={{
                  width: `${(checked.length / manualChecks.length) * 100}%`,
                }}
              />
            </div>
            {manualChecks.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={(event) =>
                    setChecked((values) =>
                      event.target.checked
                        ? [...values, item]
                        : values.filter((value) => value !== item),
                    )
                  }
                />
                <span>{item}</span>
              </label>
            ))}
            <p className="step-help" role="status">
              {checked.length === manualChecks.length
                ? "Practice checklist complete. Nice work!"
                : "This records your practice; it does not run automated tests."}
            </p>
          </section>
          <section className="panel">
            <h2>Three useful commands</h2>
            <div className="command-explainer">
              <code>pnpm ds build</code>
              <p>Generate output from token source files.</p>
              <code>pnpm ds doctor</code>
              <p>Check Node, configuration, tokens, themes, and registry.</p>
              <code>pnpm lint</code>
              <p>Check TypeScript types across the workspace.</p>
            </div>
          </section>
        </div>
      </div>
      <section className="panel advanced-tests">
        <span className="eyebrow">WHEN YOU’RE READY</span>
        <h2>Test the explorer automatically</h2>
        <p>
          These browser tests check navigation, token search, theme previews,
          component interactions, error recovery, accessibility, and mobile
          layout.
        </p>
        <CodeBlock
          code={"pnpm exec playwright install chromium\npnpm test:docs"}
        />
        <details>
          <summary>Component playground and visual regression tests</summary>
          <p>
            The separate playground runs at <code>http://localhost:4174</code>.
            Start it to inspect the component test fixtures.
          </p>
          <CodeBlock code="pnpm --filter @dsc/playground dev" />
          <p>Run accessibility and keyboard checks without screenshots:</p>
          <CodeBlock code="pnpm --filter @dsc/visual-tests exec playwright test accessibility.spec.ts" />
          <p>
            Screenshot tests need reviewed baselines. On your first run, create
            them explicitly, inspect the images, and then run comparisons.
          </p>
          <CodeBlock
            code={"pnpm --filter @dsc/visual-tests test:update\npnpm visual"}
          />
          <p className="step-help">
            Only update baselines after you review and accept a visual change.
          </p>
        </details>
      </section>
    </>
  );
}
