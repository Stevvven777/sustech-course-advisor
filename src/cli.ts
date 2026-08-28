#!/usr/bin/env node
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { guidedProfile } from "./interview/init.js";
import { inspectEnvironment } from "./core/environment.js";
import { array, record, runSustech } from "./core/sustech.js";
import { loadProfile, loadResult, writeJsonExclusive } from "./core/store.js";
import { recommendCourses } from "./solver/recommend.js";
import { renderHtml } from "./exporters/html.js";
import { renderStrategyIcs } from "./exporters/ics.js";
import type { AdvisorResult, CourseSection, NcesCourseEvidence, Strategy } from "./types.js";

const HELP = `sustech-advisor — guided SUSTech course planning

Usage:
  sustech-advisor doctor [--profile NAME] [--live]
  sustech-advisor init --path FILE [--overwrite]
  sustech-advisor show --path FILE
  sustech-advisor refresh --path FILE [--overwrite]
  sustech-advisor recommend --path FILE --semester TERM [--round ID] [--week-one-monday YYYY-MM-DD] [--destination FILE] [--overwrite]
  sustech-advisor export --input PLAN.json --html FILE --xlsx FILE --ics-dir DIR [--overwrite]
  sustech-advisor preview --input PLAN.json --strategy high-load|high-grading|interest --operation cart|enroll
`;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || rest.includes("--help")) { process.stdout.write(HELP); return; }
  const flags = parseFlags(rest);
  if (command === "doctor") return doctor(flags);
  if (command === "init") {
    const path = required(flags.path, "--path");
    const profile = await guidedProfile();
    process.stdout.write(`${await writeJsonExclusive(path, profile, flags.overwrite === true)}\n`); return;
  }
  if (command === "show") { process.stdout.write(`${JSON.stringify(await loadProfile(required(flags.path,"--path")), null, 2)}\n`); return; }
  if (command === "refresh") {
    const path = required(flags.path,"--path"); const profile = await loadProfile(path);
    await runSustech(["tis","degree","progress","--details"]);
    profile.refreshedAt = new Date().toISOString();
    process.stdout.write(`${await writeJsonExclusive(path, profile, flags.overwrite === true)}\n`); return;
  }
  if (command === "recommend") return recommend(flags);
  if (command === "export") return exportResult(flags);
  if (command === "preview") return preview(flags);
  throw new Error(`Unknown command: ${command}`);
}

async function doctor(flags: Flags): Promise<void> {
  const report = await inspectEnvironment({ profile: stringFlag(flags.profile), live: flags.live === true });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

async function recommend(flags: Flags): Promise<void> {
  const profile = await loadProfile(required(flags.path,"--path"));
  const semester = required(flags.semester,"--semester");
  const round = stringFlag(flags.round);
  const catalogData = record(await runSustech(round ? ["tis","courses","available","--semester",semester,"--round",round,"--limit","500"] : ["tis","courses","search","--semester",semester,"--limit","1000"]));
  const catalog = array<CourseSection>(catalogData.courses);
  const usefulCodes = new Set([...profile.curriculum.courses.map((course)=>course.code.toUpperCase()),...profile.preferences.mustInclude]);
  const candidateCodes = [...new Set(catalog.map((course)=>course.code.toUpperCase()).filter((code)=>usefulCodes.size===0||usefulCodes.has(code)))].slice(0,80);
  const nces: NcesCourseEvidence[] = [];
  for (const code of candidateCodes) {
    try { const data=record(await runSustech(["nces","search",code])); nces.push(...array<NcesCourseEvidence>(data.items)); } catch { /* preserve absent evidence */ }
  }
  const result = recommendCourses({ profile, semester, ...(round?{round}:{}), catalog, nces, ...(stringFlag(flags["week-one-monday"])?{weekOneMonday:stringFlag(flags["week-one-monday"])}:{}) });
  if (flags.destination) process.stdout.write(`${await writeJsonExclusive(String(flags.destination),result,flags.overwrite===true)}\n`);
  else process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

async function exportResult(flags: Flags): Promise<void> {
  const result = await loadResult(required(flags.input,"--input"));
  const { buildWorkbook } = await import("./exporters/xlsx.js");
  await writeBytes(required(flags.html,"--html"),Buffer.from(renderHtml(result)),flags.overwrite===true);
  await writeBytes(required(flags.xlsx,"--xlsx"),await buildWorkbook(result),flags.overwrite===true);
  const directory=resolve(required(flags["ics-dir"],"--ics-dir")); await mkdir(directory,{recursive:true});
  for(const plan of result.strategies) await writeBytes(`${directory}/${plan.strategy}.ics`,Buffer.from(renderStrategyIcs(result,plan)),flags.overwrite===true);
  process.stdout.write(`${JSON.stringify({html:resolve(String(flags.html)),xlsx:resolve(String(flags.xlsx)),icsDir:directory},null,2)}\n`);
}

async function preview(flags: Flags): Promise<void> {
  const result=await loadResult(required(flags.input,"--input")); const strategy=required(flags.strategy,"--strategy") as Strategy;
  const plan=result.strategies.find((item)=>item.strategy===strategy); if(!plan) throw new Error(`Strategy not found: ${strategy}`);
  const operation=required(flags.operation,"--operation"); if(operation!=="cart"&&operation!=="enroll") throw new Error("--operation must be cart or enroll.");
  const previews=[]; for(const section of plan.sections){if(!section.id) throw new Error(`Course ${section.code} lacks the opaque TIS course id required for preview.`);previews.push(await runSustech(["tis","selection","preview",operation==="cart"?"cart.add":"enroll","--course-id",section.id,"--rwh",section.rwh,"--semester",result.semester,...(result.round?["--round",result.round]:[])]));}
  process.stdout.write(`${JSON.stringify({strategy,operation,previews},null,2)}\n`);
}

type Flags=Record<string,string|boolean>;
function parseFlags(args:string[]):Flags{const result:Flags={};for(let i=0;i<args.length;i++){const arg=args[i];if(!arg.startsWith("--"))throw new Error(`Unexpected argument: ${arg}`);const key=arg.slice(2);if(key==="overwrite"||key==="live")result[key]=true;else result[key]=args[++i]??"";}return result;}
function required(value:string|boolean|undefined,name:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required.`);return value.trim();}
function stringFlag(value:string|boolean|undefined):string|undefined{return typeof value==="string"&&value.trim()?value.trim():undefined;}
async function writeBytes(path:string,bytes:Buffer,overwrite:boolean):Promise<void>{const target=resolve(path);await mkdir(dirname(target),{recursive:true});const handle=await open(target,overwrite?"w":"wx",0o600);try{await handle.writeFile(bytes);}finally{await handle.close();}}

main(process.argv.slice(2)).catch((error)=>{process.stderr.write(`Error: ${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
