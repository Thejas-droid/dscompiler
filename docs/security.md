# Security model

Registry inputs are treated as data. The installer rejects absolute paths and `..` traversal, reads only files declared by validated manifests, hashes installed sources, and does not execute registry-provided scripts. Package dependencies are displayed before installation; this reference implementation deliberately leaves package-manager execution to the developer so dependency side effects are explicit.

Remote registry transport is not enabled by default. If added later, pin a remote registry reference to an immutable commit/version, require HTTPS, and verify content integrity before writing files.

The Figma plugin requests no network domains and does not transmit document data. It scans local variables and requires explicit selection before writes.

Host enforcement uses trusted, source-controlled configuration. JavaScript/TypeScript config files execute locally when loaded. The contract hash identifies a baseline revision; it does not sign approvals or prevent someone with repository write access from changing policy. Review contracts, source exclusions, approved implementation changes, and exceptions through the host application's normal code-review process.

The Vite JSON report and browser indicator are development services. Production builds omit these services. Reports include local source paths and diagnostics, so use development servers only within the intended development environment.
