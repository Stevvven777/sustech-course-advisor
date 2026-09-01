#!/usr/bin/env node
import { mkdir, open } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { guidedProfile } from "./interview/init.js";
import { inspectEnvironment } from "./core/environment.js";
import { createDiagnosticReport, writeRollingDiagnostic, writeSupportBundle } from "./core/diagnostics.js";
import { normalizeCatalogRows } from "./core/catalog.js";
import { array, record, runSustech } from "./core/sustech.js";
import { loadProfile, loadResult, writeJsonExclusive } from "./core/store.js";
import { recommendCourses } from "./solver/recommend.js";
import { assertAuditableResult, auditAdvisorResult } from "./solver/audit.js";
import { renderHtml } from "./exporters/html.js";
import { renderStrategyIcs } from "./exporters/ics.js";
import type { NcesCourseEvidence, Strategy } from "./types.js";

const HELP = `sustech-advisor — guided SUSTech course planning

Usage:
  sustech-advisor doctor [--profile NAME] [--live]
  sustech-advisor diagnose [--profile NAME] [--live] [--support-bundle FILE] [--overwrite]
  sustech-advisor init --path FILE [--overwrite]
  sustech-advisor show --path FILE
  sustech-advisor refresh --path FILE [--overwrite]
  sustech-advisor recommend --path FILE --semester TERM [--round ID] [--week-one-monday YYYY-MM-DD] [--destination FILE] [--overwrite]
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
  const usefulCodes = new Set([...profile.curriculum.courses.map((course)=>course.code.trim().toUpperCase()),...profile.preferences.mustInclude.map((code)=>code.trim().toUpperCase())].filter(Boolean));
  const requestedCodes = [...usefulCodes].slice(0,80);
  const catalogRows: unknown[] = [];
  let catalogFailureCount = 0;
  for (const code of requestedCodes) {
    try {
      const data = record(await runSustech(round
        ? ["tis","courses","available",code,"--semester",semester,"--round",round,"--limit","100"]
        : ["tis","courses","search",code,"--semester",semester,"--limit","100"]));
      catalogRows.push(...array<unknown>(data.courses));
    } catch { catalogFailureCount += 1; }
  }
  const normalizedCatalog = normalizeCatalogRows(catalogRows);
  const catalog = normalizedCatalog.sections;
  const candidateCodes = [...new Set(catalog.map((course)=>course.code.toUpperCase()).filter((code)=>usefulCodes.size===0||usefulCodes.has(code)))].slice(0,80);
  const nces: NcesCourseEvidence[] = [];
  let ncesFailureCount = 0;
  for (const code of candidateCodes) {
    try { const data=record(await runSustech(["nces","search",code])); nces.push(...array<NcesCourseEvidence>(data.items)); } catch { ncesFailureCount += 1; }
  }
  const result = recommendCourses({ profile, semester, ...(round?{round}:{}), catalog, nces, ...(stringFlag(flags["week-one-monday"])?{weekOneMonday:stringFlag(flags["week-one-monday"])}:{}) });
  const catalogWarnings: string[] = [];
  if (!requestedCodes.length) catalogWarnings.push("No verified curriculum or explicitly requested candidate codes were available; broad catalog retrieval was not attempted.");
  else if (catalogFailureCount > 0 || usefulCodes.size > requestedCodes.length) catalogWarnings.push(`${catalogFailureCount} of ${requestedCodes.length} targeted catalog lookups failed${usefulCodes.size > requestedCodes.length ? "; candidate list was limited to 80 codes" : ""}.`);
  if (normalizedCatalog.ambiguousCodes.length || normalizedCatalog.rejectedRows) {
    const details = [
      ...(normalizedCatalog.ambiguousCodes.length ? [`ambiguous course/component identities: ${normalizedCatalog.ambiguousCodes.join(", ")}`] : []),
      ...(normalizedCatalog.rejectedRows ? [`${normalizedCatalog.rejectedRows} malformed rows rejected`] : []),
    ].join("; ");
    catalogWarnings.push(`Catalog normalized conservatively; ${details}. Excluded records were not guessed or bundled.`);
  }
  if (catalogWarnings.length) {
    result.sourceStatuses.tisCatalog = { ok: false, message: catalogWarnings.join(" ") };
    for (const plan of result.strategies) plan.warnings.push(...catalogWarnings.map((message) => `TIS catalog containment: ${message}`));
  }
  if (ncesFailureCount > 0) result.sourceStatuses.nces = {
    ok: false,
    message: `${ncesFailureCount} of ${candidateCodes.length} NCES lookups failed; affected courses have no NCES evidence.`,
  };
  assertAuditableResult(result);
  if (flags.destination) process.stdout.write(`${await writeJsonExclusive(String(flags.destination),result,flags.overwrite===true)}\n`);
  else process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

async function exportResult(flags: Flags): Promise<void> {
  const result = await loadResult(required(flags.input,"--input"));
  assertAuditableResult(result);
  const { buildWorkbook } = await import("./exporters/xlsx.js");
  await writeBytes(required(flags.html,"--html"),Buffer.from(renderHtml(result)),flags.overwrite===true);
  await writeBytes(required(flags.xlsx,"--xlsx"),await buildWorkbook(result),flags.overwrite===true);
  const directory=resolve(required(flags["ics-dir"],"--ics-dir")); await mkdir(directory,{recursive:true});
  for(const plan of result.strategies) await writeBytes(`${directory}/${plan.strategy}.ics`,Buffer.from(renderStrategyIcs(result,plan)),flags.overwrite===true);
  process.stdout.write(`${JSON.stringify({html:resolve(String(flags.html)),xlsx:resolve(String(flags.xlsx)),icsDir:directory},null,2)}\n`);
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
async function writeBytes(path:string,bytes:Buffer,overwrite:boolean):Promise<void>{const target=resolve(path);await mkdir(dirname(target),{recursive:true});const handle=await open(target,overwrite?"w":"wx",0o600);try{await handle.writeFile(bytes);}finally{await handle.close();}}

main(process.argv.slice(2)).catch((error)=>{process.stderr.write(`Error: ${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
