#!/usr/bin/env node
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  applyInstall, assertCompileSuccess, compile, diffMetadata, formatDiagnostic, loadConfig,
  loadRegistry, migrateDirectory, planInstall, readRegistryState, resolveConfigPaths,
  stableStringify, suggestSemver, type CompilerConfig, type MigrationSpec, type TokenMetadata
} from "@dsc/compiler";

const VERSION = "0.1.0";
const args = process.argv.slice(2);
const global = parseFlags(args);
const command = global.positionals.shift() ?? "help";
const cwd = path.resolve(String(global.flags.cwd ?? process.cwd()));

try {
  switch (command) {
    case "init": await initCommand(cwd, global.flags); break;
    case "doctor": await doctorCommand(cwd, global.flags); break;
    case "build": await buildCommand(cwd, global.flags); break;
    case "tokens": await tokensCommand(cwd, global.flags); break;
    case "add": await addCommand(cwd, global.positionals, global.flags); break;
    case "list": await listCommand(cwd, global.flags); break;
    case "diff": await diffCommand(cwd, global.flags); break;
    case "update": await updateCommand(cwd, global.positionals, global.flags); break;
    case "migrate": await migrateCommand(cwd, global.positionals[0], global.flags); break;
    case "lint": await lintCommand(cwd, global.flags); break;
    case "docs": await docsCommand(cwd, global.flags); break;
    case "visual": await visualCommand(cwd, global.flags); break;
    case "check": await checkCommand(cwd, global.flags); break;
    case "check-generated": await checkGeneratedCommand(cwd, global.flags); break;
    case "format": await formatCommand(cwd, global.positionals, global.flags); break;
    case "version": case "--version": case "-v": console.log(VERSION); break;
    case "help": case "--help": case "-h": printHelp(); break;
    default: throw new Error(`Unknown command: ${command}\nRun \"ds help\".`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function resolved(cwd: string, flags: Flags): Promise<{ config: CompilerConfig; file: string }> {
  const loaded = await loadConfig(cwd, stringFlag(flags.config));
  return { config: resolveConfigPaths(loaded.config, loaded.file), file: loaded.file };
}

async function initCommand(cwd: string, flags: Flags): Promise<void> {
  const force = boolFlag(flags.force);
  await mkdir(path.join(cwd, "tokens", "themes"), { recursive: true });
  await mkdir(path.join(cwd, "components", "ui"), { recursive: true });
  const configPath = path.join(cwd, "ds.config.ts");
  const config = `import { defineConfig } from "@dsc/compiler";\n\nexport default defineConfig({\n  tokens: ["./tokens/primitives.json", "./tokens/semantic.json"],\n  themes: "./tokens/themes",\n  registry: ${JSON.stringify(stringFlag(flags.registry) ?? "./registry/components")},\n  outDir: "./dist",\n  css: { prefix: "ds", separator: "-", splitByCategory: true },\n  docs: { enabled: true }\n});\n`;
  await writeNew(configPath, config, force);
  await writeNew(path.join(cwd,"tokens","primitives.json"), `${stableStringify({color:{brand:{"500":{$type:"color",$value:"#8838F3"}}},spacing:{"4":{$type:"dimension",$value:"16px"}}})}\n`, force);
  await writeNew(path.join(cwd,"tokens","semantic.json"), `${stableStringify({color:{background:{surface:{$type:"color",$value:"#FFFFFF"},brand:{$type:"color",$value:"{color.brand.500}"}},text:{primary:{$type:"color",$value:"#111827"}}}})}\n`, force);
  const detected=await detectProject(cwd);
  console.log("✓ Design-System Compiler initialized");
  console.log(`  ${relative(cwd,configPath)}`);
  console.log("  tokens/primitives.json\n  tokens/semantic.json\n  tokens/themes/");
  console.log(`Detected: ${detected.join(", ")||"plain project"}`);
}

async function doctorCommand(cwd: string, flags: Flags): Promise<void> {
  const checks: Array<[string, boolean, string]> = [];
  checks.push(["Node.js", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node]);
  try {
    const {config}=await resolved(cwd,flags); checks.push(["Config",true,"valid"]);
    const result=await compile(config,{emit:false});
    checks.push(["Token files",!result.diagnostics.some(d=>d.severity==="error"),`${result.tokens.size} tokens`]);
    checks.push(["Themes",!result.diagnostics.some(d=>d.code.startsWith("THEME_")&&d.severity==="error"),`${result.themes.size} themes`]);
    if(config.registry){const registry=await loadRegistry(config.registry,result.tokens);checks.push(["Registry",!registry.diagnostics.hasErrors(),`${registry.items.size} components`]);}
    for(const d of result.diagnostics) console.log(formatDiagnostic(d));
  } catch(error) { checks.push(["Config",false,error instanceof Error?error.message:String(error)]); }
  for(const [name,ok,detail] of checks) console.log(`${ok?"✓":"✗"} ${name}: ${detail}`);
  if(checks.some(([,ok])=>!ok)) process.exitCode=1;
}

async function buildCommand(cwd: string, flags: Flags): Promise<void> {
  const {config}=await resolved(cwd,flags);
  let previous:Awaited<ReturnType<typeof compile>>|undefined;
  const run=async()=>{const result=await compile(config,{emit:true,...(previous?{previous}:{})});printDiagnostics(result.diagnostics);assertCompileSuccess(result);previous=result;console.log(`✓ Compiled ${result.tokens.size} tokens, ${result.themes.size} themes, ${result.artifacts.length} artifacts in ${result.durationMs.toFixed(1)}ms${result.cacheHit?" (cache input match)":""}.`)};
  await run();
  if(boolFlag(flags.watch)) {
    const {watch}=await import("node:fs"); const roots=[...config.tokens,...(config.themes?[config.themes]:[])]; let timer:NodeJS.Timeout|undefined;
    console.log("Watching token/theme sources…");
    const watchers=roots.map(target=>watch(target,{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>run().catch(e=>console.error(e instanceof Error?e.message:String(e))),80)}));
    process.on("SIGINT",()=>{watchers.forEach(w=>w.close());process.exit(0)});
    await new Promise(()=>{});
  }
}

async function tokensCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:false});assertCompileSuccess(result);if(boolFlag(flags.json))console.log(stableStringify(result.metadata));else for(const token of result.metadata)console.log(`${token.name}\t${token.type}\t${String(token.resolvedValue)}\t${token.cssVariable}`)}

async function addCommand(cwd:string,names:string[],flags:Flags):Promise<void>{if(!names.length)throw new Error("Usage: ds add <component...> [--dry-run] [--force]");const {config}=await resolved(cwd,flags);if(!config.registry)throw new Error("No registry configured.");const plan=await planInstall(config.registry,cwd,names);console.log(`Components: ${plan.components.map(x=>x.manifest.name).join(", ")}`);for(const file of plan.files)console.log(`${file.modified?"!":"+"} ${relative(cwd,file.target)}${file.modified?" (locally modified)":""}`);if(plan.packageDependencies.length)console.log(`Package dependencies: ${plan.packageDependencies.join(", ")}`);if(boolFlag(flags["dry-run"]))return;if(plan.packageDependencies.length&&!boolFlag(flags["skip-install"]))await installDependencies(cwd,plan.packageDependencies);await applyInstall(plan,cwd,config.registry,{force:boolFlag(flags.force)});console.log(`✓ Added ${plan.files.length} files.`);}

async function listCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);if(!config.registry)throw new Error("No registry configured.");const registry=await loadRegistry(config.registry);const state=await readRegistryState(cwd,config.registry);for(const [name,item] of [...registry.items].sort(([a],[b])=>a.localeCompare(b))){const installed=state.components[name];console.log(`${installed?"✓":" "} ${name.padEnd(18)} ${item.manifest.version}${installed?` (installed ${installed.version})`:""}`)}}

async function diffCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:false});assertCompileSuccess(result);const against=stringFlag(flags.against)??path.join(config.outDir??path.join(cwd,"dist"),"token-metadata.previous.json");let before:TokenMetadata[];try{before=JSON.parse(await readFile(path.resolve(cwd,against),"utf8")) as TokenMetadata[]}catch{throw new Error(`Cannot read comparison metadata: ${against}. Pass --against <file>.`)}const changes=diffMetadata(before,result.metadata);for(const c of changes)console.log(`${c.kind==="added"?"+":c.kind==="removed"?"-":c.kind==="deprecated"?"!":"~"} ${c.name} (${c.kind})`);console.log(`Suggested semver: ${suggestSemver(changes)}`)}

async function updateCommand(cwd:string,names:string[],flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);if(!config.registry)throw new Error("No registry configured.");const state=await readRegistryState(cwd,config.registry);const requested=names.length?names:Object.keys(state.components);if(!requested.length){console.log("No installed components.");return}const plan=await planInstall(config.registry,cwd,requested);for(const conflict of plan.conflicts)console.log(`! Local modification: ${relative(cwd,conflict.target)}`);if(boolFlag(flags["dry-run"]))return;if(plan.packageDependencies.length&&!boolFlag(flags["skip-install"]))await installDependencies(cwd,plan.packageDependencies);await applyInstall(plan,cwd,config.registry,{force:boolFlag(flags.force)});console.log(`✓ Updated ${plan.components.length} components.`)}

async function migrateCommand(cwd:string,version:string|undefined,flags:Flags):Promise<void>{if(!version)throw new Error("Usage: ds migrate <version> [--dry-run]");const {config}=await resolved(cwd,flags);if(!config.registry)throw new Error("No registry configured.");const registryRoot=path.resolve(config.registry,"..");const file=path.join(registryRoot,"migrations",`${version}.json`);const spec=JSON.parse(await readFile(file,"utf8")) as MigrationSpec;const prefix=config.css?.prefix;const result=await migrateDirectory(cwd,spec,{dryRun:boolFlag(flags["dry-run"]),...(prefix?{prefix}:{})});console.log(`${boolFlag(flags["dry-run"])?"Dry run: ":""}${result.changedFiles} files affected, ${result.changes} changes.`);for(const m of result.manual)console.log(`! ${m}`)}

async function lintCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:false});printDiagnostics(result.diagnostics);const errors=result.diagnostics.filter(d=>d.severity==="error");if(errors.length)throw new Error(`${errors.length} lint error(s).`);console.log(`✓ ${result.diagnostics.filter(d=>d.severity==="warning").length} warning(s), 0 errors.`)}

async function docsCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:true});assertCompileSuccess(result);console.log(`✓ Docs data generated in ${relative(cwd,path.join(config.outDir??path.join(cwd,"dist"),"docs-data"))}.`);if(boolFlag(flags.serve)){const port=Number(flags.port??4173);await runCommand("pnpm",["--filter","@dsc/docs","dev","--","--port",String(port)],cwd)}}

async function visualCommand(cwd:string,flags:Flags):Promise<void>{const extra=boolFlag(flags.update)?["--update-snapshots"]:[];await runCommand("pnpm",["--filter","@dsc/visual-tests","test","--",...extra],cwd)}

async function checkCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:false});printDiagnostics(result.diagnostics);assertCompileSuccess(result);await checkGenerated(config,result.artifacts,cwd);if(!boolFlag(flags["skip-browser"]))await runCommand("pnpm",["--filter","@dsc/visual-tests","test"],cwd);console.log("✓ Design system check passed.")}
async function checkGeneratedCommand(cwd:string,flags:Flags):Promise<void>{const {config}=await resolved(cwd,flags);const result=await compile(config,{emit:false});assertCompileSuccess(result);await checkGenerated(config,result.artifacts,cwd);console.log("✓ Generated artifacts are up to date.")}
async function checkGenerated(config:CompilerConfig,artifacts:Array<{path:string;content:string}>,cwd:string):Promise<void>{const out=config.outDir??path.join(cwd,"dist");const drift:string[]=[];for(const a of artifacts){try{if(await readFile(path.join(out,a.path),"utf8")!==a.content)drift.push(a.path)}catch{drift.push(a.path)}}if(drift.length)throw new Error(`Generated output drift:\n${drift.map(x=>`- ${x}`).join("\n")}\nRun ds build.`)}

async function formatCommand(cwd:string,targets:string[],flags:Flags):Promise<void>{const list=targets.length?targets:["tokens"];for(const target of list){const full=path.resolve(cwd,target);const s=await stat(full);const files=s.isDirectory()?(await readdir(full)).filter(x=>x.endsWith(".json")).map(x=>path.join(full,x)):[full];for(const file of files){if(!file.endsWith(".json")){console.log(`skip ${relative(cwd,file)} (JSONC/YAML formatting preserves comments by design and is not rewritten)`);continue}const data=JSON.parse(await readFile(file,"utf8"));if(!boolFlag(flags["dry-run"]))await writeFile(file,`${stableStringify(data)}\n`);console.log(`✓ ${relative(cwd,file)}`)}}}

function parseFlags(input:string[]):{positionals:string[];flags:Flags}{const positionals:string[]=[];const flags:Flags={};for(let i=0;i<input.length;i++){const arg=input[i]??"";if(arg.startsWith("--")){const [raw,valueInline]=arg.slice(2).split("=",2);if(!raw)continue;if(valueInline!==undefined)flags[raw]=valueInline;else if(input[i+1]&&!input[i+1]!.startsWith("-")){flags[raw]=input[++i]}else flags[raw]=true}else if(arg.startsWith("-")&&arg.length===2){const key=({c:"config",h:"help",v:"version"} as Record<string,string>)[arg[1]!]??arg[1]!;flags[key]=true}else positionals.push(arg)}return{positionals,flags}}
type Flags=Record<string,string|boolean|undefined>;
function boolFlag(v:string|boolean|undefined):boolean{return v===true||v==="true"}
function stringFlag(v:string|boolean|undefined):string|undefined{return typeof v==="string"?v:undefined}
function printDiagnostics(items:Array<Parameters<typeof formatDiagnostic>[0]>):void{for(const item of items)console.log(formatDiagnostic(item))}
async function writeNew(file:string,content:string,force:boolean):Promise<void>{try{await stat(file);if(!force)return}catch{/* new */}await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content,"utf8")}
function relative(cwd:string,file:string):string{return path.relative(cwd,file)||"."}
async function runCommand(command:string,commandArgs:string[],cwd:string):Promise<void>{await new Promise<void>((resolve,reject)=>{const child=spawn(command,commandArgs,{cwd,stdio:"inherit",shell:process.platform==="win32"});child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)))})}


async function detectProject(cwd:string):Promise<string[]>{const found:string[]=[];try{const pkg=JSON.parse(await readFile(path.join(cwd,"package.json"),"utf8")) as {dependencies?:Record<string,string>;devDependencies?:Record<string,string>};const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})};if(deps.react)found.push("React");if(deps.next)found.push("Next.js");if(deps.vite)found.push("Vite");if(deps.typescript)found.push("TypeScript");if(deps.tailwindcss)found.push("Tailwind")}catch{/* no package */}try{const tsconfig=await readFile(path.join(cwd,"tsconfig.json"),"utf8");if(/\"paths\"\s*:/.test(tsconfig))found.push("path aliases")}catch{/* no tsconfig */}return found}
async function installDependencies(cwd:string,deps:string[]):Promise<void>{const manager=await detectPackageManager(cwd);console.log(`Installing with ${manager}: ${deps.join(", ")}`);const args=manager==="pnpm"?["add",...deps]:manager==="yarn"?["add",...deps]:manager==="bun"?["add",...deps]:["install","--save",...deps];await runCommand(manager,args,cwd)}
async function detectPackageManager(cwd:string):Promise<"pnpm"|"yarn"|"bun"|"npm">{const exists=async(name:string)=>{try{await access(path.join(cwd,name));return true}catch{return false}};if(await exists("pnpm-lock.yaml"))return"pnpm";if(await exists("yarn.lock"))return"yarn";if(await exists("bun.lockb")||await exists("bun.lock"))return"bun";return"npm"}
function printHelp():void{console.log(`Design-System Compiler ${VERSION}\n\nUsage: ds <command> [options]\n\nCommands:\n  init             Initialize config/tokens\n  doctor           Validate environment and project\n  build [--watch]  Compile tokens, themes, types and docs data\n  tokens [--json]  Inspect resolved tokens\n  add <names...>   Install registry components\n  list             List registry components\n  diff --against   Diff token metadata and suggest semver\n  update [names]   Update installed components safely\n  migrate <ver>    Apply AST migrations\n  lint             Run design-system lint rules\n  docs             Generate documentation data\n  visual           Run Playwright visual tests\n  check            CI validation (compiler + drift + browser tests)\n  check-generated  Verify committed generated outputs\n  format [path]    Deterministically format JSON token files\n\nMutation commands support --dry-run where applicable. Component overwrite requires --force.`)}
