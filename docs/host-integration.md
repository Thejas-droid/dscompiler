# Host-application integration

The compiler now has a local enforcement workflow for React/JSX/TSX and plain CSS. It compiles an approved baseline, checks consumer source, explains violations, gates startup/build/CI, and refreshes development reports after edits. The hospital demo is a working integration, not a hospital management backend.

## Run and test the scenario

From the repository root, with Node 22 or later and pnpm 10.17.1:

```bash
pnpm install
pnpm build
pnpm demo
```

Open **http://localhost:5175**. Keep that terminal running. Port 5173 remains the documentation explorer. If port 5175 is occupied, stop the process using it or change the demo's Vite port.

In a second terminal, also at the repository root:

```bash
pnpm demo:break
pnpm demo:check
pnpm demo:fix
pnpm demo:check
```

The first command adds a hardcoded magenta color to a controlled CSS fixture. The running demo reports `DS_RAW_STYLE` with the file, line, explanation, and correction guidance. `demo:check` exits 1 while the violation exists. `demo:fix` restores the fixture and the live diagnostics clear; `demo:check` then exits 0. These scripts only edit `src/demo-violation.css` and refuse a file with a changed marker.

`pnpm demo:strict` blocks initial startup when source errors exist. `pnpm --filter @dsc/hospital-demo build` always uses strict validation, regardless of the development warning policy. Changes during an already running development session refresh diagnostics without killing the server.

To test an approved design-system change, edit `apps/hospital-demo/design-system/tokens.json`, for example `color.brand`. The generated CSS, rendered application, and contract revision update. Do not edit generated CSS. Ordinary consumer changes never become approved rules automatically.

## Install in a separate application

These packages are not assumed to be published on npm. Build local artifacts:

```bash
pnpm build
pnpm run package:local
```

This creates three tarballs in `artifacts/`. From your host application's root, install **all three together**, replacing the paths with your compiler checkout path:

```bash
npm install --save-dev "/path/to/compiler/artifacts/dsc-compiler-0.1.0.tgz" "/path/to/compiler/artifacts/dsc-enforcer-0.1.0.tgz" "/path/to/compiler/artifacts/dsc-cli-0.1.0.tgz"
```

For an unpublished local installation with pnpm, also add overrides for the internal package dependencies to the host package.json before running `pnpm add -D` with the three tarballs:

```json
{
  "pnpm": {
    "overrides": {
      "@dsc/compiler": "file:/path/to/compiler/artifacts/dsc-compiler-0.1.0.tgz",
      "@dsc/enforcer": "file:/path/to/compiler/artifacts/dsc-enforcer-0.1.0.tgz"
    }
  }
}
```

Without these overrides, pnpm may try to fetch unpublished internal dependencies from npm. Merge these fields with any existing host pnpm configuration. On Windows use quoted paths such as `"C:\Users\theja\Downloads\resume projects\dscompiler\design-system-compiler\artifacts\dsc-compiler-0.1.0.tgz"`. Installing the local tarballs avoids relying on the nonexistent root npm package. A workspace can instead use `workspace:*` dependencies.

Add `ds.config.json` to the host:

```json
{
  "tokens": ["./design-system/tokens.json"],
  "themes": "./design-system/themes",
  "outDir": "./.design-system/generated",
  "css": { "prefix": "ds" },
  "enforcement": {
    "contract": "./design-system/contract.json",
    "include": ["src/**"],
    "exclude": ["src/design-system/**"],
    "mode": "strict"
  }
}
```

Omit `themes` if you do not have a themes directory. All paths and source globs are relative to the config directory; `--cwd` and `--config` support another working directory. Generated output, token definitions, the contract, and config itself are excluded from consumer checking. Node modules, Git data, dist, and coverage directories are not traversed. Symlinks are not followed.

A minimal approved `contract.json`:

```json
{
  "version": 1,
  "name": "Hospital approved UI",
  "properties": {
    "color": {
      "types": ["color"],
      "tokens": ["color.text.*"],
      "allow": ["inherit"]
    },
    "background-color": {
      "types": ["color"],
      "tokens": ["color.background.*"],
      "allow": ["transparent"]
    },
    "padding": { "types": ["dimension"], "allow": [0] },
    "font-size": { "types": ["fontSize"] }
  },
  "implementation": ["src/design-system/**"],
  "components": [
    {
      "from": "@hospital/ui",
      "name": "Button",
      "replaces": ["button"],
      "variants": { "variant": ["primary", "secondary"] },
      "forbidProps": ["style", "className"]
    }
  ],
  "forbiddenImports": ["@unapproved-ui/**"],
  "rules": { "DS_UNSUPPORTED_SOURCE": "error" },
  "exceptions": []
}
```

Configure `@hospital/ui` as an actual package or framework alias. Component identity is matched to the exact import specifier plus exported name; aliases and namespace imports are supported. Default imports use the contract name `default`. Alternate import paths/barrels need explicit mappings. Structural HTML and custom compositions remain allowed unless a `replaces` rule governs that tag. Import restrictions apply to configured forbidden modules; this is not an exhaustive approved-package allowlist.

Govern **every property your design system intends to control**, including shorthands and longhands. For example, governing `background-color` does not also govern `background`, and governing `padding` does not also govern `padding-left`. Token existence is checked in all supported CSS/inline declarations, while literal restrictions and token type/scope checks apply to configured properties. The demo's contract provides a broader starting example.

`types` constrains token types; optional `tokens` limits permitted semantic token paths. `allow` lists exact literal values. Compound literals such as `0 auto` need an explicit entry; token-containing expressions are checked for remaining nonapproved literals. Fallback literals inside `var()` are also checked. `calc()` arithmetic is conservative: permit required operands explicitly. The checker does not infer a semantic token merely because its numeric/color value matches.

Approved implementation patterns add those files' content to the contract hash. Implementation files are still excluded from consumer policy checks when configured as exclusions; use type, unit, accessibility, and browser tests for the library itself. The hash also includes the contract, configured source scope, CSS naming settings, resolved tokens, and themes. It excludes consumer source and absolute checkout paths. This is a revision identifier, not a cryptographic approval signature or security boundary.

## Startup and live Vite integration

Add scripts to the host's package.json:

```json
{
  "scripts": {
    "dev": "ds inspect --mode warn && vite",
    "build": "vite build",
    "ds:check": "ds inspect --mode strict --fail-on-warnings --report reports/design-system.json"
  }
}
```

Register the plugin in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { designSystem } from "@dsc/enforcer/vite";

export default defineConfig({
  plugins: [designSystem({ devMode: "warn", failOnWarnings: true }), react()],
});
```

The plugin runs an initial inspection, compiles approved tokens, watches changes/additions/deletions, sends report updates over Vite HMR, and adds an accessible development indicator. It debounces and serializes rescans to avoid overlapping reports. The current implementation performs full scans of the selected source tree, not a dependency-indexed incremental scan; large-project latency has not been benchmarked. The default debounce is 100 ms, not a detection-time guarantee.

The report endpoint is `<Vite base>__ds/report`; it is read-only and available only on the development server. `virtual:ds-report` exports `readReport()` and `subscribeReport(listener)` for a custom development dashboard. `indicator: false` disables the automatic badge. Normal production output has no report endpoint or active diagnostic client. Do not expose a development server as a production service.

Startup warning mode permits source-policy diagnostics. Missing/invalid baselines, expired approvals, and empty source coverage fail even in warning mode. Strict mode fails errors; `--fail-on-warnings` also fails warnings. Set `DS_UNSUPPORTED_SOURCE` to `error` to require supported syntax. Exceptions cannot suppress infrastructure errors.

For a non-Vite project, `ds inspect` can gate the existing dev/build command and CI, but this release does not provide a continuous adapter for Next.js, Webpack, or other dev servers.

## Reports and exceptions

```bash
ds inspect --mode strict --json
ds inspect --mode strict --report reports/design-system.json
ds inspect --mode warn --emit
```

`--emit` also generates artifacts after a valid token compilation. Validation-only inspection does not alter consumer source or generated output. `ds lint` remains token/registry validation. `ds check` additionally performs strict source inspection when `enforcement` is configured; browser tests in that command remain repository-specific and are not automatically mapped to host routes. Use `ds inspect` for a standalone host CI gate.

Reports contain schema version, policy mode, readiness/pass status, contract revision, diagnostics with source locations, suppressed diagnostics, scanned files, excluded files/directories, and unsupported coverage. Parser errors are reported. Dynamic/referenced JSX styles, spreads, dynamic variants, CSS-in-JS, runtime DOM style mutation, injected markup and preprocessor files are identified as unsupported when detected. Unsupported expressions are not claimed as verified.

Reviewed exceptions live in the approved contract:

```json
{
  "files": ["src/legacy/**"],
  "rules": ["DS_RAW_STYLE"],
  "reason": "Legacy screen migration tracked in UI-123",
  "expires": "2027-01-31"
}
```

Exceptions remain visible in `suppressed` with their reason and expiry. Dates are UTC; an exception is valid through the named date and fails the following day. Inline comments cannot silently bypass checks. Rule severity can be `error`, `warning`, or `off`; disabling a rule is an explicit contract change.

This tool enforces configured static rules. It does not prove arbitrary CSS/HTML/JavaScript paths, dynamically generated values, third-party runtime styling, or visual layout correctness. Tailwind utilities, Sass, CSS-in-JS, raw HTML templates and unrestricted component behavior need additional adapters or browser checks. Only matching source files are scanned. Keep exclusions narrow and review unsupported coverage in CI.

## Figma import without AI

1. Import an offline `.fig` into Figma and open it.
2. Import `apps/figma-plugin/manifest.json` as a development plugin after building.
3. Click **Export current document**, then **Download JSON**.
4. Map variable IDs to token names/types/units. Use `fixtures/figma/mapping.json` as an example.
5. Import into a new candidate directory:

```bash
pnpm ds import-figma fixtures/figma/snapshot.json --mapping fixtures/figma/mapping.json --out candidates/figma
```

Use `--dry-run` for a JSON preview. Actual writes refuse existing directories, validate the candidate using the compiler, and remove incomplete candidate output on failure. Review `tokens.json`, `themes/`, and `import-report.json` before updating the approved host baseline.

The converter preserves variable IDs, descriptions, scopes, aliases, color alpha, numeric units, mode/theme overrides, and component property inventory. Every variable needs a mapping or explicit ignore decision. Boolean variables and unsupported string/composite mappings need an explicit ignore or a future adapter. Numeric dimensions/durations require units. Component metadata does not automatically become accessible React implementations; map it to approved code and variants.

The existing code-to-Figma scan/apply workflow remains available. The plugin UI is bundled into self-contained HTML for Figma's sandbox. This implementation uses structured export snapshots; it does not parse binary `.fig` files, access a private Figma account, or continuously synchronize Figma edits to local disk. Those require a supplied document and an authenticated/live bridge. No AI service is required for the implemented workflow.

## Verification

See [the implementation and readiness report](implementation-status.md) for the
completed checks and the remaining scope. Component screenshot references are
currently provided for Chromium on Linux; other platforms require explicitly
generated and reviewed references.

```bash
pnpm lint
pnpm test:enforcement
pnpm exec playwright install chromium
pnpm test:integration
pnpm test:demo
node scripts/audit-capabilities.mjs
```

The integration suite creates and cleans a temporary host application. It tests CLI policy exits, candidate Figma imports, strict Vite startup/build gates, browser report delivery, live fixes, new/deleted files, token-driven CSS updates, invalid-baseline recovery, a non-root Vite base, and removal of diagnostic code from production output. The compiler and enforcement unit suites cover parsing, aliases, token types/scopes, components, unsupported syntax, contract hashes, exceptions, exclusions and configuration failures.

A separate real host application and Figma document have not been supplied. Validate that application's import conventions, styling system, design rules, routes and build pipeline before releasing this integration there. Hosted SaaS accounts, tenancy, remote integrations and a cloud dashboard are not part of this local implementation.
