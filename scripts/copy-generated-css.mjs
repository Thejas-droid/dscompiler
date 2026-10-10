import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const output = path.join(root, "dist");
  const css = [await readFile(path.join(output, "tokens.css"), "utf8")];
  let themes = [];
  try {
    themes = (await readdir(path.join(output, "themes")))
      .filter((file) => file.endsWith(".css"))
      .sort((a, b) =>
        a === "light.css" ? -1 : b === "light.css" ? 1 : a.localeCompare(b),
      );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const theme of themes)
    css.push(await readFile(path.join(output, "themes", theme), "utf8"));
  await writeFile(
    path.join(root, "apps", "playground", "src", "generated.css"),
    css.join("\n"),
  );
} catch (error) {
  console.error(
    "Could not copy generated CSS. Run `pnpm ds build` from the project root, then start the playground again.",
  );
  console.error(error instanceof Error ? error.message : String(error));
  // The first workspace build happens before token compilation in the demo setup.
  // Development startup must stop rather than serve a broken explorer or preview.
  if (!(process.argv.includes("--allow-missing") && error?.code === "ENOENT")) {
    process.exitCode = 1;
  }
}
