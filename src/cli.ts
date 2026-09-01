#!/usr/bin/env node
import { mkdir, open, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { guidedProfile } from "./interview/init.js";
import { inspectEnvironment } from "./core/environment.js";
import { createDiagnosticReport, writeRollingDiagnostic, writeSupportBundle } from "./core/diagnostics.js";
import { proxyModeFromEnv, runSustech } from "./core/sustech.js";
import { cacheFreshness, WorkflowRecorder, type ExecutionMode } from "./core/execution.js";
import { createSourceCache, loadSourceCache, writeSourceCache } from "./core/cache.js";
import { buildRecommendation, fetchLiveRecommendationSources, type RecommendationSources } from "./core/planning.js";
import { loadProfile, loadResult, writeJsonExclusive } from "./core/store.js";
import { assertAuditableResult, auditAdvisorResult } from "./solver/audit.js";
import { renderHtml } from "./exporters/html.js";
import { renderStrategyIcs } from "./exporters/ics.js";
import type { AdvisorResult, Strategy } from "./types.js";

const HELP = `sustech-advisor — guided SUSTech course planning

Usage:
  sustech-advisor doctor [--profile NAME] [--live]
  sustech-advisor diagnose [--profile NAME] [--live] [--support-bundle FILE] [--overwrite]
  sustech-advisor init --path FILE [--overwrite]
  sustech-advisor show --path FILE
  sustech-advisor refresh --path FILE [--overwrite]
  sustech-advisor recommend --path FILE --semester TERM [--round ID] [--week-one-monday YYYY-MM-DD] [--destination FILE] [--overwrite]
  sustech-advisor workflow --mode live --path PROFILE.json --semester TERM --cache CACHE.json --destination PLAN.json [--timeout-ms 120000] [--retries 1] [--report FILE] [--overwrite]
  sustech-advisor workflow --mode cached --path PROFILE.json --semester TERM --cache CACHE.json --destination PLAN.json [--max-cache-age-ms 86400000] [--report FILE] [--overwrite]
  sustech-advisor workflow --mode render-only --input PLAN.json --html FILE --xlsx FILE --ics-dir DIR [--report FILE] [--overwrite]
  sustech-advisor audit --input PLAN.json
  sustech-advisor export --input PLAN.json --html FILE --xlsx FILE --ics-dir DIR [--overwrite]
  sustech-advisor preview --input PLAN.json --strategy high-load|high-grading|interest --operation cart|enroll
`;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || rest.includes("--help")) { process.stdout.write(HELP); return; }
  const flags = parseFlags(rest);
  if (command === "doctor") return doctor(flags);
  if (command === "diagnose") return diagnose(flags);
  if (command === "init") {
    const path = required(flags.path, "--path");
    const profile = await guidedProfile();
    process.stdout.write(`${await writeJsonExclusive(path, profile, flags.overwrite === true)}\n`); return;
  }
  if (command === "show") { process.stdout.write(`${JSON.stringify(await loadProfile(required(flags.path,"--path")), null, 2)}\n`); return; }
  if (command === "refresh") {
    const path = required(flags.path,"--path"); const profile = await loadProfile(path);
    await runSustech(["tis","degree","progress"]);
    profile.refreshedAt = new Date().toISOString();
    process.stdout.write(`${await writeJsonExclusive(path, profile, flags.overwrite === true)}\n`); return;
  }
  if (command === "recommend") return recommend(flags);
  if (command === "workflow") return workflow(flags);
  if (command === "audit") {
    const report = auditAdvisorResult(await loadResult(required(flags.input,"--input")));
    process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (command === "export") return exportResult(flags);
  if (command === "preview") return preview(flags);
  throw new Error(`Unknown command: ${command}`);
}

async function doctor(flags: Flags): Promise<void> {
  const report = await inspectEnvironment({ profile: stringFlag(flags.profile), live: flags.live === true });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

async function diagnose(flags: Flags): Promise<void> {
  const environment = await inspectEnvironment({ profile: stringFlag(flags.profile), live: flags.live === true });
  const report = createDiagnosticReport(environment);
  const localLog = await writeRollingDiagnostic(report);
  const supportPath = stringFlag(flags["support-bundle"]);
  const supportBundle = supportPath ? await writeSupportBundle(supportPath, report, flags.overwrite === true) : undefined;
  process.stdout.write(`${JSON.stringify({ report, localLog: basename(localLog), ...(supportBundle ? { supportBundle } : {}) }, null, 2)}\n`);
  if (!environment.ok) process.exitCode = 1;
}

async function recommend(flags: Flags): Promise<void> {
  const profile = await loadProfile(required(flags.path,"--path"));
  const semester = required(flags.semester,"--semester");
  const round = stringFlag(flags.round);
  const sources = await fetchLiveRecommendationSources(profile, {
    semester, ...(round ? { round } : {}), totalTimeoutMs: 120_000, maxRetries: 0,
    proxyMode: proxyModeFromEnv(process.env),
  });
  const result = buildRecommendation({ profile, semester, ...(round ? { round } : {}), sources, ...(stringFlag(flags["week-one-monday"])?{weekOneMonday:stringFlag(flags["week-one-monday"])}:{}) });
  assertAuditableResult(result);
  if (flags.destination) process.stdout.write(`${await writeJsonExclusive(String(flags.destination),result,flags.overwrite===true)}\n`);
  else process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

async function workflow(flags: Flags): Promise<void> {
  const mode = required(flags.mode, "--mode") as ExecutionMode;
  if (!(["live", "cached", "render-only"] as string[]).includes(mode)) throw new Error("--mode must be live, cached, or render-only.");
  if (mode === "render-only") return renderOnlyWorkflow(flags);

  const profilePath = required(flags.path, "--path");
  const semester = required(flags.semester, "--semester");
  const round = stringFlag(flags.round);
  const cachePath = required(flags.cache, "--cache");
  const destination = required(flags.destination, "--destination");
  await assertDistinctPaths([
    ["profile input", profilePath], ["source cache", cachePath], ["plan destination", destination],
    ...(stringFlag(flags.report) ? [["workflow report", stringFlag(flags.report)!] as [string, string]] : []),
  ]);
  const recorder = new WorkflowRecorder(mode, mode === "live" ? proxyModeFromEnv(process.env) : "unused");
  const profile = await recorder.stage("profile-load", async () => loadProfile(profilePath));
  let sources: RecommendationSources;
  let cacheOutput: string | undefined;
  if (mode === "live") {
    const timeoutMs = integerFlag(flags["timeout-ms"], "--timeout-ms", 120_000, 1_000, 300_000);
    const maxRetries = integerFlag(flags.retries, "--retries", 1, 0, 2);
    sources = await recorder.stage("authoritative-read", async (retry) => fetchLiveRecommendationSources(profile, {
      semester, ...(round ? { round } : {}), totalTimeoutMs: timeoutMs, maxRetries,
      proxyMode: proxyModeFromEnv(process.env), onRetry: retry,
      onSource: (name, timestamp) => recorder.source(name, timestamp),
    }));
    const capturedAt = new Date().toISOString();
    const cache = createSourceCache({ semester, ...(round ? { round } : {}), capturedAt, sourceTimestamps: recorder.sourceTimestamps, ...sources });
    cacheOutput = await recorder.stage("cache-write", async () => writeSourceCache(cachePath, cache, flags.overwrite === true));
    recorder.cacheStatus({ status: "written", capturedAt });
  } else {
    const cache = await recorder.stage("cache-load", async () => loadSourceCache(cachePath));
    if (cache.semester !== semester || (cache.round ?? "") !== (round ?? "")) throw new Error("Cached source semester/round does not match the requested plan.");
    const maxAgeMs = integerFlag(flags["max-cache-age-ms"], "--max-cache-age-ms", 86_400_000, 1_000, 2_592_000_000);
    const freshness = cacheFreshness(cache.capturedAt, maxAgeMs);
    recorder.cacheStatus(freshness);
    for (const [name, timestamp] of Object.entries(cache.sourceTimestamps)) recorder.source(name, timestamp);
    sources = { catalog: cache.catalog, nces: cache.nces, sourceStatuses: { ...cache.sourceStatuses } };
    sources.sourceStatuses.cacheFreshness = freshness.status === "fresh"
      ? { ok: true }
      : { ok: false, message: `Cached authoritative facts are stale (${freshness.ageMs} ms old; limit ${freshness.maxAgeMs} ms).` };
  }
  const result = await recorder.stage("recommend", async () => buildRecommendation({
    profile, semester, ...(round ? { round } : {}), sources,
    ...(stringFlag(flags["week-one-monday"]) ? { weekOneMonday: stringFlag(flags["week-one-monday"]) } : {}),
  }));
  if (mode === "cached" && sources.sourceStatuses.cacheFreshness?.ok === false) {
    const warning = sources.sourceStatuses.cacheFreshness.message ?? "Cached authoritative facts are stale.";
    for (const plan of result.strategies) plan.warnings.push(warning);
  }
  await recorder.stage("audit", async () => assertAuditableResult(result));
  const resultOutput = await recorder.stage("result-write", async () => writeJsonExclusive(destination, result, flags.overwrite === true));
  const { report, reportOutput } = await finalizeWorkflowReport(flags, recorder);
  process.stdout.write(`${JSON.stringify({ ok: true, result: resultOutput, ...(cacheOutput ? { cache: cacheOutput } : {}), ...(reportOutput ? { reportFile: reportOutput } : {}), report }, null, 2)}\n`);
}

async function renderOnlyWorkflow(flags: Flags): Promise<void> {
  const input = required(flags.input, "--input");
  const html = required(flags.html, "--html");
  const xlsx = required(flags.xlsx, "--xlsx");
  const icsDir = required(flags["ics-dir"], "--ics-dir");
  const reportPath = stringFlag(flags.report);
  await assertDistinctPaths([
    ["plan input", input], ["HTML output", html], ["XLSX output", xlsx],
    ...(reportPath ? [["workflow report", reportPath] as [string, string]] : []),
    ...(["high-load", "high-grading", "interest"] as Strategy[]).map((strategy): [string, string] => [`${strategy} ICS output`, resolve(icsDir, `${strategy}.ics`)]),
  ]);
  const recorder = new WorkflowRecorder("render-only", "unused");
  const result = await recorder.stage("result-load", async () => loadResult(input));
  recorder.source("advisorResult", result.generatedAt);
  await recorder.stage("audit", async () => assertAuditableResult(result));
  const outputs = await exportArtifacts(result, flags, recorder);
  const { report, reportOutput } = await finalizeWorkflowReport(flags, recorder);
  process.stdout.write(`${JSON.stringify({ ok: true, ...outputs, ...(reportOutput ? { reportFile: reportOutput } : {}), report }, null, 2)}\n`);
}

async function exportResult(flags: Flags): Promise<void> {
  const result = await loadResult(required(flags.input,"--input"));
  assertAuditableResult(result);
  const outputs = await exportArtifacts(result, flags);
  process.stdout.write(`${JSON.stringify(outputs,null,2)}\n`);
}

async function exportArtifacts(result: AdvisorResult, flags: Flags, recorder?: WorkflowRecorder): Promise<{ html: string; xlsx: string; icsDir: string }> {
  const runStage = async <T>(name: string, operation: () => Promise<T>): Promise<T> => recorder ? recorder.stage(name, async () => operation()) : operation();
  await runStage("render-html", async () => writeBytes(required(flags.html,"--html"),Buffer.from(renderHtml(result)),flags.overwrite===true));
  await runStage("render-xlsx", async () => { const { buildWorkbook } = await import("./exporters/xlsx.js"); await writeBytes(required(flags.xlsx,"--xlsx"),await buildWorkbook(result),flags.overwrite===true); });
  const directory=resolve(required(flags["ics-dir"],"--ics-dir"));
  await runStage("render-ics", async () => { await mkdir(directory,{recursive:true}); for(const plan of result.strategies) await writeBytes(`${directory}/${plan.strategy}.ics`,Buffer.from(renderStrategyIcs(result,plan)),flags.overwrite===true); });
  return { html: resolve(String(flags.html)), xlsx: resolve(String(flags.xlsx)), icsDir: directory };
}

async function preview(flags: Flags): Promise<void> {
  const result=await loadResult(required(flags.input,"--input")); assertAuditableResult(result); const strategy=required(flags.strategy,"--strategy") as Strategy;
  const plan=result.strategies.find((item)=>item.strategy===strategy); if(!plan) throw new Error(`Strategy not found: ${strategy}`);
  const operation=required(flags.operation,"--operation"); if(operation!=="cart"&&operation!=="enroll") throw new Error("--operation must be cart or enroll.");
  const ids=plan.sections.map((section)=>section.id?.trim()).filter((id):id is string=>Boolean(id));
  if(ids.length!==plan.sections.length||new Set(ids).size!==ids.length) throw new Error("Preview blocked: every selected course must have one unique opaque TIS course id; identifier semantics are unresolved.");
  const previews=[]; for(const section of plan.sections){previews.push(await runSustech(["tis","selection","preview",operation==="cart"?"cart.add":"enroll","--course-id",section.id!,"--rwh",section.rwh,"--semester",result.semester,...(result.round?["--round",result.round]:[])]));}
  process.stdout.write(`${JSON.stringify({strategy,operation,previews},null,2)}\n`);
}

type Flags=Record<string,string|boolean>;
function parseFlags(args:string[]):Flags{const result:Flags={};for(let i=0;i<args.length;i++){const arg=args[i];if(!arg.startsWith("--"))throw new Error(`Unexpected argument: ${arg}`);const key=arg.slice(2);if(key==="overwrite"||key==="live")result[key]=true;else result[key]=args[++i]??"";}return result;}
function required(value:string|boolean|undefined,name:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required.`);return value.trim();}
function stringFlag(value:string|boolean|undefined):string|undefined{return typeof value==="string"&&value.trim()?value.trim():undefined;}
function integerFlag(value:string|boolean|undefined,name:string,fallback:number,min:number,max:number):number{if(value===undefined)return fallback;const parsed=typeof value==="string"?Number(value):NaN;if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${name} must be an integer from ${min} to ${max}.`);return parsed;}
async function assertDistinctPaths(entries:Array<[string,string]>):Promise<void>{
  const seen=new Map<string,string>();
  for(const [label,path] of entries){
    const target=await canonicalPath(path);
    const existing=seen.get(target);
    if(existing)throw new Error(`${label} must not overwrite ${existing}: ${resolve(path)}`);
    seen.set(target,label);
  }
}
async function canonicalPath(path:string):Promise<string>{
  let cursor=resolve(path); const suffix:string[]=[];
  while(true){
    try{
      const existing=await realpath(cursor); const target=resolve(existing,...suffix.reverse());
      return process.platform==="win32"?target.toLowerCase():target;
    }catch(error){
      if(!(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT"))throw error;
      const parent=dirname(cursor);
      if(parent===cursor){const target=resolve(path);return process.platform==="win32"?target.toLowerCase():target;}
      suffix.push(basename(cursor)); cursor=parent;
    }
  }
}
async function finalizeWorkflowReport(flags:Flags,recorder:WorkflowRecorder):Promise<{report:ReturnType<WorkflowRecorder["report"]>;reportOutput?:string}>{
  const path=stringFlag(flags.report); let reportOutput:string|undefined;
  if(path){
    // A measured first write avoids pretending report I/O is free; the atomic second pass commits that final measurement.
    const provisional=recorder.report();
    reportOutput=await recorder.stage("report-write",async()=>writeJsonExclusive(path,provisional,flags.overwrite===true));
  }
  const report=recorder.report();
  if(reportOutput)await writeJsonExclusive(reportOutput,report,true);
  return{report,...(reportOutput?{reportOutput}:{})};
}
async function writeBytes(path:string,bytes:Buffer,overwrite:boolean):Promise<void>{const target=resolve(path);await mkdir(dirname(target),{recursive:true});const handle=await open(target,overwrite?"w":"wx",0o600);try{await handle.writeFile(bytes);}finally{await handle.close();}}

main(process.argv.slice(2)).catch((error)=>{process.stderr.write(`Error: ${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
