# Design-System Compiler: feasibility and capability report

> **Historical assessment:** This report describes the repository before host enforcement was implemented. See [the current integration guide](host-integration.md) for the new checker, Vite plugin, hospital demo, structured Figma import, and remaining limitations. The capability audit has also been updated.

Assessment date: 10 October 2026. This report evaluates the existing repository against your proposed application. Implemented capabilities are grounded in source inspection and the executable audit below; proposed capabilities are explicitly labeled. No Figma design or hospital application was supplied, so their actual import quality and integration cannot yet be tested.

## Decision

**Your main concept is technically feasible without AI:** connect to an application's approved design system, compile its tokens, inspect application source for violations, and report those violations before startup and during development.

**The existing project provides the token-compilation foundation but does not implement application-wide enforcement.** Its `ds lint` command validates token definitions and registry metadata. It does not scan arbitrary CSS, JSX, component imports, or inline styles in a consumer application.

**Figma extraction is feasible without AI.** Extracting structured variables, styles, component metadata, and variants is different from generating an entire production component library from an arbitrary visual design. The latter needs explicit mappings, templates, and decisions about behavior and accessibility.

**An optional SaaS product is feasible**, but it needs an installable local checker or CI integration. A hosted dashboard alone cannot monitor a developer's local source edits. This section is conditional because “as a say” in your request may mean SaaS.

## Where the project is

The current repository is `C:\Users\theja\Downloads\resume projects\dscompiler\design-system-compiler`.

| Location                                   | Responsibility today                                         |
| ------------------------------------------ | ------------------------------------------------------------ |
| `packages/compiler/src/compiler.ts`        | Parse tokens, resolve aliases/themes, generate artifacts     |
| `packages/cli/src/index.ts`                | `ds build`, `lint`, `check`, registry and migration commands |
| `packages/primitives` and `packages/react` | Accessible behavior and token-styled React components        |
| `registry/components`                      | Source-installable component manifests and files             |
| `apps/docs`                                | Explorer and educational component examples                  |
| `apps/figma-plugin`                        | Manual code-to-Figma token drift scan/apply                  |
| `apps/visual-tests`                        | Tests of this repository's browser examples                  |

The app at port 5173 is the docs explorer. It is not an enforcement service attached to an external application. The root package is private; the workspace packages and release configuration are not evidence that an npm installation is currently available.

## Capability comparison

| Your requirement                                            | Current implementation                                                        | Assessment                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Compile named design values into reusable CSS/TypeScript    | Token graph, CSS/TS generators, light/dark/custom themes                      | Implemented                                             |
| Explain malformed definitions and circular references       | Source-aware diagnostics, missing references, type and cycle checks           | Implemented                                             |
| Copy approved component source into a consumer              | Registry installation, dependency ordering, local-edit hash protection        | Implemented, using the local configured registry        |
| Use another application's token files                       | Explicit config paths and CLI `--cwd`                                         | Supported for compilation; not automatic discovery      |
| Find the application's complete design system automatically | No CSS/JSX/framework discovery adapters or mapping workflow                   | Missing; discovery requires review of ambiguous results |
| Import `.fig` and generate a library                        | No importer; plugin only reads pasted compiler metadata                       | Missing; structured extraction is feasible              |
| Check application CSS and inline styles                     | No application-source scanner in `lint`                                       | Missing                                                 |
| Reject unknown CSS variables in application files           | Token references checked in token definitions, not consumer CSS               | Missing                                                 |
| Enforce component imports, props, variants and overrides    | Registry manifests describe components; no consumer AST enforcement           | Missing                                                 |
| Run automatically before an external app starts             | No installed consumer startup hook or bundler plugin                          | Missing                                                 |
| Notify after application source edits                       | Existing watch command watches configured token/theme sources only            | Partial foundation; application watching missing        |
| Update the baseline after approved token edits              | Token watch can regenerate output                                             | Partial; no live consumer policy/report refresh         |
| Prove an arbitrary host application looks correct           | Browser suites target this repository's configured examples                   | Missing until host routes/states are configured         |
| Show a live violation dashboard                             | Explorer displays documentation, not a scanner report feed                    | Missing                                                 |
| Operate as a SaaS service                                   | No hosted backend, accounts, tenancy, project integration or report ingestion | Missing                                                 |

## What I tested

Run this reproducible audit from the repository root:

```bash
node scripts/audit-capabilities.mjs
```

It uses the built CLI, creates a temporary consumer project, runs checks, and removes the temporary files. It does not modify an actual hospital application.

Observed on Windows Node:

| Probe                                                              | Observed result                                     | Meaning                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------- |
| Valid tokens, with an alias to a purple color                      | Build succeeds; emitted alias resolves to `#7224D8` | Token compilation works                                   |
| JSX contains a plain button and hardcoded `#ff00ff` / `13px`       | `ds lint` exits 0                                   | Application-source enforcement is absent                  |
| CSS contains an unknown `--ds-color-does-not-exist` variable       | `ds lint` exits 0                                   | Consumer CSS variable checking is absent                  |
| Nonconforming application source, with up-to-date generated output | `ds check --skip-browser` exits 0                   | Generated-file checks are not consumer conformance checks |
| Token definition references `color.missing`                        | Exit 1; `TOKEN_REFERENCE_MISSING`                   | Token-reference validation works                          |
| Tokens reference each other cyclically                             | Exit 1; `TOKEN_CYCLE`                               | Cycle detection works                                     |

“NOT IMPLEMENTED” in the audit output is a demonstrated product gap, not a failing audit assertion. The browser tests from the explorer redesign verify that explorer's interactions; they do not establish that an external hospital application's styles follow its design system.

## Figma and the no-AI question

A Figma Design file is a structured design document, not an HTML application. Start with supported extraction rather than assuming a `.fig` upload is equivalent to ready-to-use web source.

For an offline `.fig` file, the recommended first path is to import it into Figma. Figma officially supports this file type. Then extract from the opened document using a plugin, or from its file key through the REST API. The documented file API returns document nodes and component metadata; it accepts file keys, not arbitrary `.fig` bytes. A direct offline parser would be a separate compatibility project and is not the first MVP recommendation. [Figma import guide](https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser), [file endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/).

| Output                                                  | Without AI?                      | Necessary conditions                                                                                        |
| ------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tokens from variables and named styles                  | Yes                              | Type/unit/name mapping, alias preservation, theme/mode mapping                                              |
| Component and variant inventory                         | Yes                              | Structured component sets and readable properties                                                           |
| CSS/TypeScript token library                            | Yes                              | Feed normalized values into the existing compiler                                                           |
| Components built from known templates                   | Yes                              | Map Figma component identity and variants to approved React implementations                                 |
| Arbitrary designs into complete production components   | Only within defined restrictions | Human-authored rules/templates and review of responsive behavior, semantics, accessibility and interactions |
| Universal inference of business behavior from a picture | No reliable guarantee            | A visual design does not specify every behavior or application requirement                                  |

The Plugin API can read local variable collections, variables, and bound-variable relationships. A new exporter can use these to preserve references rather than flattening every value. The Variables REST API's local-variable endpoint currently requires full membership in an Enterprise organization; access must be checked for the intended account. Do not assume every API route is available on every plan. [Plugin variables](https://developers.figma.com/docs/plugins/working-with-variables/), [Variables REST endpoints](https://developers.figma.com/docs/rest-api/variables-endpoints/).

For a no-AI first version, define a limited component catalog, such as Button, Input, Dialog and Tabs. A mapping binds a Figma component ID to a React implementation and its allowed props. Code Connect demonstrates this mapping model, but it is not a general component-library generator or enforcement engine; a local mapping file can serve the MVP without adopting that paid integration. [Figma Code Connect](https://developers.figma.com/docs/code-connect/).

## The correct source of truth

The approved contract should contain:

- Token definitions and themes.
- Approved UI primitives and their public props/variants.
- Property-specific rules: which semantic tokens may be used for color, spacing, radius, typography and other governed properties.
- Component mappings and allowed imports.
- Explicit exceptions, source locations, and a contract revision/hash.

For a hospital application, these can live in its own `design-system/` directory or in a shared versioned design-system package. A small adapter loads that contract. The compiler does not need to execute hospital workflows.

An arbitrary style edit in `src/PatientCard.tsx` must be checked against the contract. It must not silently become part of the contract. Otherwise the tool would approve the same changes it is supposed to detect. Initial discovery should propose candidates for review; subsequent checking should use only the approved baseline.

Approved edits inside the design-system source should trigger recompilation and rescanning of affected consumer files. Unapproved application styling should produce diagnostics. Remote design changes should arrive as candidate revisions, with a deliberate update of the approved baseline. CI should check the same revision the developer used.

## Proposed architecture

```text
Figma structured export      Existing project design-system files
          |                                  |
          +----------- adapter + mapping ----+
                              |
                  Approved contract revision
                 tokens + components + rules
                              |
                    Existing token compiler
                              |
                    CSS / TypeScript output
                              |
         Application-source checker + framework integration
               |                    |                  |
          terminal/editor      browser feedback    CI report
```

This is a developer tool integrated into the host project's workflow. It is not a permanent visual layer over the production application.

The first source checker should support React/TSX and plain CSS only. Use CSS parsing for declarations and JavaScript/TypeScript AST analysis for imports, JSX and inline styles. ESLint and Stylelint expose custom-rule mechanisms suited to these jobs. Tailwind, Sass and CSS-in-JS need dedicated adapters rather than an unsupported claim to inspect every styling system. [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules), [Stylelint plugins](https://stylelint.io/developer-guide/plugins/).

A Vite integration can perform an initial scan, watch token and source files, regenerate output after approved changes, and publish refreshed diagnostics. Vite provides server configuration and hot-update hooks for plugin integrations. This is a proposed package, not an existing feature of the repository. [Vite Plugin API](https://vite.dev/guide/api-plugin.html).

Example diagnostics for the proposed checker:

```text
src/PatientCard.tsx:18:24  DS_RAW_COLOR
Hardcoded color #ff00ff is not permitted for this component.
Choose an approved semantic color token; no equivalent was inferred.

src/styles.css:9:15  DS_UNKNOWN_TOKEN
--ds-color-does-not-exist is not in the approved contract.

src/PatientForm.tsx:31:3  DS_UNAPPROVED_CONTROL
Use the approved Button component for this interactive control.
```

These diagnostic codes do not exist today. Suggestions must respect token role and scope; matching a numeric or color value alone does not prove the correct semantic token.

Structural HTML and application-specific compositions should remain allowed. A `PatientCard` can compose approved controls. Third-party component internals, generated files, and design-system implementation files need declared boundaries so checking does not flag legitimate implementation details as consumer violations.

## Startup, live feedback and blocking

Recommended policy:

| Situation                                  | Behavior                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Invalid/cyclic approved token definitions  | Fail compilation; do not publish incomplete generated output                 |
| Styling violation during early adoption    | Warn before dev startup; keep the app running and report file/line/rule      |
| Violation introduced while dev server runs | Refresh diagnostics without repeatedly killing the server                    |
| Explicit strict mode                       | Fail the initial dev/build check when policy errors exist                    |
| CI/release                                 | Fail on configured errors; optionally fail warnings according to team policy |

An explicit dev script can run a checker before the normal application startup, and a bundler plugin can handle continued watching. Keep the startup behavior configurable. The future CLI should return a nonzero code only according to the chosen policy; current `ds lint` cannot act as this source checker.

Suggested future interface, **not commands available today**:

```json
{
  "scripts": {
    "dev": "ds inspect --mode warn && vite",
    "ds:check": "ds inspect --mode strict"
  }
}
```

The Vite config would also register a new design-system plugin for continuous checks. Frameworks other than Vite need their own integration or a generic watcher alongside their dev command.

“Immediately” should mean a measured, debounced response to supported local-file changes. No detection-latency guarantee has been benchmarked. Figma synchronization has different constraints: the documented `FILE_UPDATE` webhook fires after an inactivity window of up to 30 minutes, so it cannot provide keystroke-level synchronization. An active plugin bridge could provide a more immediate export path while running; polling needs rate-limit and staleness handling. [Figma webhook events](https://developers.figma.com/docs/rest-api/webhooks-events/), [Plugin events and lifecycle](https://developers.figma.com/docs/plugins/api/figma/).

## What enforcement can and cannot prove

Static checking can reliably enforce explicit rules for supported syntax: token existence, governed literal values, approved imports, component props/variants, deprecated APIs and controlled overrides.

It cannot prove every rendered page is visually or semantically correct. A valid spacing token can be used in a bad layout; a permitted theme can be applied to the wrong region. Runtime computed-style checks and configured screenshot/accessibility tests are separate verification layers. Dynamic values, styles injected by third-party code, portals, pseudo-elements and unsupported syntax can need runtime analysis or declared exclusions.

Reports should include the contract hash, scanned files, excluded files, unsupported cases and diagnostics. “No violations found” must not mean “every part of the application is proven correct.”

## Local demo and implementation sequence

**Build the host-project enforcement first.** It proves your main purpose without requiring a Figma account, importer, or cloud backend.

1. Add a small `apps/hospital-demo` React/Vite application with synthetic appointment/patient cards. It has its own approved token files and a few mapped components.
2. Add a reusable source-checking package with plain-CSS and React/TSX adapters. Implement four initial rules: unknown token, governed hardcoded style, unapproved control import/use, and restricted component override.
3. Add `ds inspect` with warning/strict modes, file/line suggestions, and JSON reporting. Keep `ds build` as token compilation.
4. Add the Vite plugin and incremental rescanning. Watch both approved design-system files and consumer application files. Delete stale diagnostics when a file is fixed or removed.
5. Demonstrate: clean app → hardcoded color → visible warning → replace with approved token → warning clears. Separately demonstrate an approved token edit updating the preview.
6. Test startup behavior in warning/strict modes and CI error exits. Include unsupported syntax, exceptions, file changes, deletions and baseline revision changes.
7. Add a Figma exporter/import adapter and a component-mapping review flow. Test it with a small, supplied design system before promising broad `.fig` conversion.
8. Add a hosted dashboard only after the local workflow works.

Acceptance criteria for the first demo:

- A supported styling violation is reported with file, line, rule and useful explanation.
- An unknown CSS variable is detected in consumer source.
- A legitimate structural HTML element and a compliant custom composition are accepted.
- Warning mode starts the app; strict mode fails on policy errors.
- New violations appear and resolved violations disappear while the app runs.
- An approved token change recompiles output and rescans dependent usage.
- CI fails on configured errors and identifies the contract revision.
- Reports explicitly identify unsupported cases and exclusions.

No implementation schedule or cost estimate is asserted here. Those depend on the host framework, styling system, rule set, Figma structure and required integration depth.

## Optional SaaS

The hosted part can store approved contract versions, receive scan reports, show trends, explain violations and coordinate team changes. The installed checker/plugin should remain responsible for local scanning and offline development. CI can upload reports tied to a commit and contract revision.

A hosted product additionally needs project onboarding, authentication, tenant isolation, permissions, secure integration credentials, report storage, retention settings and operational monitoring. Its commercial viability is unproven: pilot users should measure false positives, time spent fixing violations, integration effort and whether teams need central reporting.

## Recommended next decision

Proceed with a **local, installable design-system enforcement MVP for React + plain CSS**, using this repository's compiler as the foundation. Make Figma import a separate adapter and SaaS an optional later delivery layer. The complete product is feasible, but the missing enforcement engine is the next essential implementation, not another explorer redesign.
