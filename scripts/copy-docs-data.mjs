import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from this script, independent of the terminal directory and OS separators.
const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "dist", "docs-data");
const destination = path.join(root, "apps", "docs", "public", "data");

await mkdir(destination, { recursive: true });
try {
  await cp(source, destination, { recursive: true, force: true });
} catch (error) {
  console.error(
    "Could not copy documentation data. Run `pnpm ds build` from the project root, then start the docs app again.",
  );
  console.error(error instanceof Error ? error.message : String(error));
  // The first workspace build happens before token compilation in the demo setup.
  // Development startup must stop rather than serve a broken explorer or preview.
  if (!(process.argv.includes("--allow-missing") && error?.code === "ENOENT")) {
    process.exitCode = 1;
  }
}
