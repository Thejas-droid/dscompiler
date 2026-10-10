# Explorer experience

The docs app now opens with a beginner workflow instead of a token dump. Its five pages map to concrete tasks:

- **Start here:** understand what tokens do, see the design-to-code flow, and pick a first task.
- **Design tokens:** search and filter values, inspect the selected theme, follow references, and copy CSS/TypeScript usage.
- **Themes:** preview the same small UI in each theme and compare resolved values. The difference filter hides unchanged values.
- **Components:** interact with the actual React components, read their keyboard instructions, and preview source installation commands.
- **How to test:** make a reversible radius change, compile, restart the explorer, and verify the result. The manual checklist records practice; it does not imply automated validation.

## Design decisions

The first screen prioritizes the few actions a beginner needs. Technical details appear where they become useful: source locations and usage snippets in the token inspector, installation information beneath component previews, and browser/visual test setup in an expandable guide. This follows [Nielsen Norman Group's progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/).

Navigation uses labeled landmarks, headings follow a logical hierarchy, inputs have accessible names, and a skip link moves focus to the content. Keyboard focus is visible, layouts reflow on small screens, and reduced-motion preferences disable nonessential animation. These choices follow [W3C's page structure guidance](https://www.w3.org/WAI/tutorials/page-structure/).

Loading, missing-data, empty-search, and clipboard-failure states give users an explanation and a recovery action. Copy success is announced, the preview theme persists, and browser history works through hash navigation. This implements the feedback principle described by [Nielsen Norman Group's visibility of system status guidance](https://www.nngroup.com/articles/visibility-system-status/).

## Local use

Run `pnpm ds build`, then `pnpm run docs`. Open the local address Vite prints and keep the terminal running. The explorer displays generated data; changes to token files require another compiler build and a docs-server restart, because documentation data is copied at startup. “Reload data” refetches the served files and does not run the compiler.

Component previews read actual compiled values for the selected theme. The docs interface has its own light/dark layout styles, while each theme comparison card binds its own token values. No terminal commands execute from the browser.

## Verification

Run `pnpm exec playwright install chromium`, then `pnpm test:docs`. The dedicated docs suite tests desktop and mobile navigation, token search and empty states, token links, theme persistence, copy feedback, component keyboard interactions, the practice guide, data recovery, accessibility scans, and horizontal overflow. It runs separately from screenshot-baseline tests.

For package validation, run `pnpm build`, `pnpm lint`, and `pnpm --filter @dsc/compiler test`. Browser automation supplements usability review; it does not establish that every workflow is understandable to every user.
