# Architecture

The repository is deliberately local-first. Token source files are parsed into a flat `Map<TokenPath, TokenNode>`, then a directed alias graph resolves values with memoized DFS. The same graph stores reverse dependencies for incremental rebuild impact analysis. Generators consume the resolved graph and emit deterministic CSS, TypeScript, declaration unions, metadata, docs data, JSON Schema, Figma metadata and per-theme CSS.

The compiler never depends on the React layer. `@dsc/primitives` contains accessible behavior, while `@dsc/react` is the token-styled layer. Registry entries copy styled source into a consumer project and record source hashes in `ds.config.json`; updates compare those hashes before any overwrite.

Migrations use the TypeScript compiler AST for JavaScript/TypeScript/JSX changes. CSS variable renames use exact generated variable names. Browser validation is isolated in `apps/visual-tests`, where Playwright captures theme/viewport screenshots and axe plus explicit keyboard tests enforce behavior.

Figma remains optional. The plugin consumes `dist/figma-tokens.json`, scans local variables, presents drift, and only writes selected changes after explicit confirmation. Code is the default source of truth.
