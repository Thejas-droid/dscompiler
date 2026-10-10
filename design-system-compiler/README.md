# Design-System Compiler

A compiler-driven design-system platform that treats design tokens, accessible primitives, component distribution, migrations, visual regression and design-tool parity as one source-controlled workflow.

## Why

A design system is more than a folder of React components. This project turns structured design tokens into a validated graph and compiles that graph into CSS variables, strongly typed TypeScript APIs, theme bundles, metadata, documentation data, editor schema and Figma synchronization metadata. The same repository ships accessible React primitives, a source-owning component registry/CLI, AST codemods, Playwright visual regression and accessibility checks.

## Demo flow

```bash
corepack enable
pnpm install
pnpm build
pnpm ds build
pnpm run docs
```

Then try:

```bash
pnpm ds tokens
pnpm ds lint
pnpm ds add dialog --dry-run
pnpm ds migrate v2 --dry-run
pnpm ds check-generated
pnpm visual
```

Introduce `a -> b -> c -> a` in a token fixture and the compiler reports `TOKEN_CYCLE` with the exact cycle. Change a public token and `ds diff --against <old-metadata.json>` classifies the change and suggests a semantic-version level. Edit an installed component and `ds update` refuses to overwrite it without `--force`.

## Architecture

```text
Token files (JSON / JSONC / YAML)
          ↓
Parser + schema checks
          ↓
Flat typed token index
          ↓
Alias dependency graph ─── reverse dependencies / cache
          ↓
Resolved token graph
          ├─ CSS variables + category CSS
          ├─ TypeScript constants + TokenName unions + token()
          ├─ theme bundles (light / dark / Jaldee)
          ├─ token metadata + JSON Schema
          ├─ docs search/component data
          └─ Figma variable metadata
                         ↓
              Registry / CLI / docs
                         ↓
             Codemods + CI validation
                         ↓
           Playwright visual + a11y tests
```

The token graph resolves aliases with memoized DFS in `O(V + E)` for normal traversal, detects circular references with visiting/visited states, and maintains reverse dependencies for affected-token calculation.

## Repository

```text
apps/
  docs/             React/Vite token explorer, theme compare, component docs
  playground/       deterministic component examples for browser tests
  visual-tests/     Playwright screenshots, axe and keyboard tests
  figma-plugin/     code → Figma drift scan and explicit apply
packages/
  compiler/         parser, graph, themes, generators, registry, diff, codemods
  cli/              ds command-line interface
  primitives/       accessible headless React behavior
  react/            token-styled React layer
registry/
  components/       source-installable components + manifests
  migrations/       versioned migration specs
tokens/              primitives, semantics and themes
fixtures/            valid/invalid/compiler/migration fixtures
```

## Token specification

```json
{
  "color": {
    "purple": {
      "500": { "$type": "color", "$value": "#8838F3" }
    },
    "background": {
      "brand": { "$type": "color", "$value": "{color.purple.500}" }
    }
  }
}
```

Aliases are validated against existence and type compatibility. Diagnostics contain stable codes, token paths and source locations. Deprecated tokens can name a replacement and are surfaced in docs/linting.

## Compiler outputs

`ds build` writes deterministic artifacts to `dist/`:

```text
tokens.css
css/<category>.css
tokens.ts
token-types.d.ts
token-metadata.json
token-sources.json
ds.tokens.schema.json
figma-tokens.json
themes/<theme>.css
docs-data/tokens.json
docs-data/components.json
docs-data/search-index.json
```

Generated files do not include timestamps. A content hash cache avoids unnecessary rewrites, and `ds check-generated` detects committed output drift.

## Themes

Themes use semantic overrides and optional inheritance:

```json
{
  "$name": "jaldee",
  "$extends": "light",
  "color": {
    "button": {
      "primary": {
        "background": { "$type": "color", "$value": "{color.purple.500}" }
      }
    }
  }
}
```

The demo Jaldee theme uses a purple accent sampled from the supplied Figma export thumbnail and a cool blue reference from its embedded progress imagery. The Figma plugin is responsible for exact variable drift detection rather than inferring hidden variable definitions from rasterized previews.

## Typed API

Generated TypeScript includes both nested constants and a compile-time-safe resolver:

```ts
import { token } from "./dist/tokens";

token("color.background.surface"); // var(--ds-color-background-surface)
// token("color.not-real")          // TypeScript error
```

## Component registry and CLI

Registry manifests declare source files, package dependencies, registry dependencies, token usage and compatibility metadata. `ds add dialog` resolves dependencies topologically and copies source into `components/ui`. `ds.config.json` records source hashes. `ds update` checks the installed hash against the current consumer file and never overwrites local edits silently.

All mutating component/migration commands support `--dry-run`; overwrite requires explicit `--force`.

## Codemods

`registry/migrations/v2.json` demonstrates three migration classes: token rename, import rename and JSX prop rename. TypeScript/JSX changes use the TypeScript compiler AST, not regex. Dynamic token expressions that cannot be transformed safely are reported as `MANUAL_MIGRATION_REQUIRED`.

## Accessibility

The primitive package implements keyboard semantics, ARIA state, Escape behavior, focus trapping/restoration where appropriate, and disabled states. Playwright runs axe and explicit interaction tests; the compiler additionally checks configured token foreground/background pairs against WCAG contrast thresholds.

## Visual regression

`apps/visual-tests` captures Chromium screenshots for light/dark modes and desktop/mobile viewports. Baselines are updated only through the explicit Playwright `--update-snapshots` path (`pnpm --filter @dsc/visual-tests test:update`). CI never updates baselines automatically.

## Figma plugin

The optional plugin consumes generated `figma-tokens.json`, maps themes to modes, scans local variables, displays `missing` / `mismatch` / `match`, and applies only the user-selected changes. Its manifest permits no network domains; code remains the default source of truth.

## Commands

```text
ds init
ds doctor
ds build [--watch]
ds tokens [--json]
ds add <components...> [--dry-run] [--force]
ds list
ds diff --against <metadata.json>
ds update [components...] [--dry-run] [--force]
ds migrate <version> [--dry-run]
ds lint
ds docs
ds visual [--update]
ds check [--skip-browser]
ds check-generated
ds format [path]
```

## Testing

Unit/golden coverage lives in `packages/compiler/test`; fixture directories cover valid aliases/themes and invalid missing references, cycles, type mismatches and theme cycles. Browser suites cover screenshots, axe and keyboard behavior. `scripts/benchmark.ts` generates 100 / 1,000 / 10,000 / 50,000-token inputs; record benchmark numbers only after running on the target machine.

## Security

Registry paths are normalized and traversal is rejected. Registry code is copied as data and never executed by the installer. Local modifications are hash-protected. Remote registry execution is intentionally outside the default implementation. The Figma plugin has no network access.

See `docs/architecture.md`, `docs/token-spec.md`, and `docs/security.md` for implementation details.
