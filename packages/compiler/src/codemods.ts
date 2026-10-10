import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { cssVariable } from "./utils.js";

export interface PropRename { component: string; from: string; to: string }
export interface ImportRename { from: string; to: string }
export interface MigrationSpec {
  version: string;
  tokenRenames?: Record<string, string>;
  propRenames?: PropRename[];
  importRenames?: ImportRename[];
}
export interface MigrationFileResult { file: string; changed: boolean; changes: number; manual: string[]; output: string }
export interface MigrationResult { files: MigrationFileResult[]; changedFiles: number; changes: number; manual: string[] }

export async function migrateDirectory(root: string, spec: MigrationSpec, options: { dryRun?: boolean; prefix?: string } = {}): Promise<MigrationResult> {
  const files = await collectFiles(root);
  const results: MigrationFileResult[] = [];
  for (const file of files) {
    const input = await readFile(file, "utf8");
    const ext = path.extname(file).toLowerCase();
    let result: MigrationFileResult;
    if ([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"].includes(ext)) result = transformCode(input, file, spec, options.prefix ?? "ds");
    else if ([".css", ".scss", ".less"].includes(ext)) result = transformCss(input, file, spec, options.prefix ?? "ds");
    else continue;
    if (result.changed && !options.dryRun) await writeFile(file, result.output, "utf8");
    if (result.changed || result.manual.length) results.push(result);
  }
  return {
    files: results,
    changedFiles: results.filter((r) => r.changed).length,
    changes: results.reduce((sum, r) => sum + r.changes, 0),
    manual: results.flatMap((r) => r.manual.map((m) => `${r.file}: ${m}`))
  };
}

export function transformCode(input: string, file: string, spec: MigrationSpec, prefix = "ds"): MigrationFileResult {
  const kind = /x$/.test(path.extname(file)) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, kind);
  let changes = 0;
  const manual: string[] = [];
  const tokenRenames = spec.tokenRenames ?? {};
  const propRenames = spec.propRenames ?? [];
  const importRenames = new Map((spec.importRenames ?? []).map((x) => [x.from, x.to]));

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "token" && node.arguments.length) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) {
          const replacement = tokenRenames[arg.text];
          if (replacement) {
            changes++;
            return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [ts.factory.createStringLiteral(replacement), ...node.arguments.slice(1)]);
          }
        } else if (arg && Object.keys(tokenRenames).length) manual.push(`MANUAL_MIGRATION_REQUIRED at ${lineOf(source, arg)}: dynamic token() argument`);
      }

      if (ts.isStringLiteralLike(node)) {
        let text = node.text;
        let changed = false;
        for (const [from, to] of Object.entries(tokenRenames)) {
          const oldVar = `var(${cssVariable(from, prefix)})`;
          const newVar = `var(${cssVariable(to, prefix)})`;
          if (text.includes(oldVar)) { text = text.split(oldVar).join(newVar); changed = true; }
        }
        if (changed) { changes++; return ts.factory.createStringLiteral(text); }
      }

      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
        const opening = node.parent?.parent;
        const tagName = opening && (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening)) ? jsxTagName(opening.tagName) : undefined;
        const attributeName = node.name.text;
        const rule = propRenames.find((x) => x.component === tagName && x.from === attributeName);
        if (rule) { changes++; return ts.factory.updateJsxAttribute(node, ts.factory.createIdentifier(rule.to), node.initializer); }
      }

      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const next = importRenames.get(node.moduleSpecifier.text);
        if (next) {
          changes++;
          return ts.factory.updateImportDeclaration(node, node.modifiers, node.importClause, ts.factory.createStringLiteral(next), node.attributes);
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (root) => ts.visitNode(root, visit) as ts.SourceFile;
  };
  const transformed = ts.transform(source, [transformer]);
  const output = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0] as ts.SourceFile);
  transformed.dispose();
  return { file, changed: changes > 0, changes, manual, output };
}

export function transformCss(input: string, file: string, spec: MigrationSpec, prefix = "ds"): MigrationFileResult {
  let output = input;
  let changes = 0;
  for (const [from, to] of Object.entries(spec.tokenRenames ?? {})) {
    const oldVar = cssVariable(from, prefix);
    const nextVar = cssVariable(to, prefix);
    if (output.includes(oldVar)) {
      changes += output.split(oldVar).length - 1;
      output = output.split(oldVar).join(nextVar);
    }
  }
  return { file, changed: changes > 0, changes, manual: [], output };
}

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", ".next"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.(tsx?|jsx?|mts|cts|css|scss|less)$/.test(entry.name)) out.push(full);
    }
  };
  await visit(root);
  return out.sort();
}
function jsxTagName(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  return name.getText();
}
function lineOf(source: ts.SourceFile, node: ts.Node): number { return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1; }
