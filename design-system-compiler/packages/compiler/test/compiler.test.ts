import { describe, expect, test } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, contrastRatio, diffMetadata, parseTokenFile, resolveTokenGraph, transformCode } from "../src/index.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");

describe("token parser and graph",()=>{
  test("resolves aliases",async()=>{const parsed=await parseTokenFile(path.join(root,"fixtures/valid/aliases/tokens.json"));const graph=resolveTokenGraph(parsed.tokens);expect(graph.diagnostics.hasErrors()).toBe(false);expect(graph.tokens.get("color.background.brand")?.resolvedValue).toBe("#2563EB")});
  test("reports missing references with a stable code",async()=>{const parsed=await parseTokenFile(path.join(root,"fixtures/invalid/missing-reference/tokens.json"));const graph=resolveTokenGraph(parsed.tokens);expect(graph.diagnostics.items.some(x=>x.code==="TOKEN_REFERENCE_MISSING")).toBe(true)});
  test("reports exact cycle",async()=>{const parsed=await parseTokenFile(path.join(root,"fixtures/invalid/cycle/tokens.json"));const graph=resolveTokenGraph(parsed.tokens);expect(graph.diagnostics.items.find(x=>x.code==="TOKEN_CYCLE")?.details?.[0]).toContain("color.a -> color.b -> color.c -> color.a")});
  test("validates alias types",async()=>{const parsed=await parseTokenFile(path.join(root,"fixtures/invalid/type-mismatch/tokens.json"));const graph=resolveTokenGraph(parsed.tokens);expect(graph.diagnostics.items.some(x=>x.code==="TOKEN_TYPE_MISMATCH")).toBe(true)});
});

describe("compiler",()=>{
  test("generates deterministic artifacts and themes",async()=>{const config={tokens:[path.join(root,"tokens/primitives.json"),path.join(root,"tokens/semantic.json")],themes:path.join(root,"tokens/themes"),registry:path.join(root,"registry/components"),outDir:path.join(root,".tmp-test-dist"),css:{prefix:"ds",splitByCategory:true},docs:{enabled:true}};const a=await compile(config,{emit:false,cache:false});const b=await compile(config,{emit:false,cache:false});expect(a.artifacts.map(x=>[x.path,x.content])).toEqual(b.artifacts.map(x=>[x.path,x.content]));expect(a.themes.has("dark")).toBe(true);expect(a.artifacts.some(x=>x.path==="tokens.ts"&&x.content.includes("export function token"))).toBe(true)});
});

describe("codemod",()=>{
  test("renames token calls and JSX props through TypeScript AST",()=>{const result=transformCode('const x=token("color.text.muted"); const y=<Button kind="primary"/>;',"test.tsx",{version:"v2",tokenRenames:{"color.text.muted":"color.text.secondary"},propRenames:[{component:"Button",from:"kind",to:"variant"}]});expect(result.output).toContain('token("color.text.secondary")');expect(result.output).toContain('variant="primary"')});
});

describe("accessibility tokens",()=>{test("computes WCAG contrast",()=>{expect(contrastRatio("#000000","#FFFFFF")).toBeCloseTo(21,5)})});

describe("diff",()=>{test("classifies additions as minor",()=>{const base:any=[{name:"a",type:"color",resolvedValue:"#fff"}];const next:any=[...base,{name:"b",type:"color",resolvedValue:"#000"}];expect(diffMetadata(base,next)[0]?.kind).toBe("added")})});
