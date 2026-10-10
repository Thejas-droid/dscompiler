import { readFile, writeFile } from "node:fs/promises";
const target = new URL(
  "../apps/hospital-demo/src/demo-violation.css",
  import.meta.url,
);
const marker =
  "/* Controlled demo fixture. Use pnpm demo:break and pnpm demo:fix from the repository root. */\n";
const current = await readFile(target, "utf8");
if (!current.startsWith(marker))
  throw new Error(
    "Demo fixture was edited manually. Restore its marker before running this script.",
  );
const mode = process.argv[2];
if (mode !== "break" && mode !== "fix")
  throw new Error("Use demo-violation.mjs break|fix");
await writeFile(
  target,
  marker + (mode === "break" ? ".appointment-count { color: #ff00ff; }\n" : ""),
);
console.log(
  mode === "break"
    ? "Introduced a hardcoded color. Watch the hospital demo and development terminal."
    : "Restored approved styling. Live diagnostics should clear.",
);
