# Security model

Registry inputs are treated as data. The installer rejects absolute paths and `..` traversal, reads only files declared by validated manifests, hashes installed sources, and does not execute registry-provided scripts. Package dependencies are displayed before installation; this reference implementation deliberately leaves package-manager execution to the developer so dependency side effects are explicit.

Remote registry transport is not enabled by default. If added later, pin a remote registry reference to an immutable commit/version, require HTTPS, and verify content integrity before writing files.

The Figma plugin requests no network domains and does not transmit document data. It scans local variables and requires explicit selection before writes.
