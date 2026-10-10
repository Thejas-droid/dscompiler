import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const packageManager = process.env.npm_execpath;
if (!packageManager || !/pnpm\.(?:c?js)$/.test(packageManager))
  throw new Error("Run this script with pnpm run package:local.");
const destination = path.join(root, "artifacts");
await mkdir(destination, { recursive: true });
for (const name of ["compiler", "enforcer", "cli"]) {
  const result = spawnSync(
    process.execPath,
    [packageManager, "pack", "--pack-destination", destination],
    { cwd: path.join(root, "packages", name), stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Packing ${name} failed (${result.status}).`);
}
console.log(
  "Install all three artifacts/*.tgz files together in your host project's devDependencies. See docs/host-integration.md.",
);
