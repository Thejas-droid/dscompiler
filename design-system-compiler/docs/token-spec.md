# Token format

Token files may be JSON, JSONC, or the compiler's safe YAML subset. A token is a nested leaf with `$type` and `$value`; groups may nest arbitrarily. Aliases use `{path.to.token}` and must be type-compatible when the whole value is an alias.

Supported types: `color`, `dimension`, `number`, `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`, `duration`, `cubicBezier`, `shadow`, `border`, `gradient`, and `opacity`.

Optional metadata: `$description`, `$since`, `$tags`, and `$deprecated` as either a boolean or `{ message, replacement, since }`.

Theme files can include `$name` and `$extends`. They override existing tokens and are resolved through the same token graph, so missing references, cycles and type mismatches are diagnosed consistently.
