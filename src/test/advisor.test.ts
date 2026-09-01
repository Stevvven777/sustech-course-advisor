import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attributeTeachingTeam } from "../nces/evidence.js";
import { recommendCourses } from "../solver/recommend.js";
import { assertAuditableResult, auditAdvisorResult } from "../solver/audit.js";
import { renderHtml } from "../exporters/html.js";
import { renderStrategyIcs } from "../exporters/ics.js";
import { buildWorkbook } from "../exporters/xlsx.js";
import { courseColorArgb, courseColorCss } from "../exporters/colors.js";
import { inspectEnvironment, versionAtLeast } from "../core/environment.js";
import { proxyModeFromEnv, runSustech, sustechChildEnv } from "../core/sustech.js";
import { loadProfile, loadResult } from "../core/store.js";
import { assertDiagnosticSafe, createDiagnosticReport, writeRollingDiagnostic } from "../core/diagnostics.js";
import { normalizeCatalogRows } from "../core/catalog.js";
import type { AdvisorProfile, CourseSection, NcesCourseEvidence } from "../types.js";

const execFile = promisify(execFileCallback);

test("multi-person NCES evidence is attributable only to the exact complete team", () => {
  const section = course("CS101", "A", ["张老师", "李助教"], 1);
  const exact: NcesCourseEvidence = { code:"CS101",semester:"2025秋",teacher:"李助教、张老师",grading:{pct:90,label:"Excellent"},rating:4.8,reviewCount:16 };
  const evidence = attributeTeachingTeam(section, [exact]);
  assert.equal(evidence.teamMatch, "exact-team");
  assert.equal(evidence.gradingScore, 90);
  assert.match(evidence.warnings.join(" "), /full team/i);

  const partial = attributeTeachingTeam(section, [{...exact,teacher:"张老师"}]);
  assert.equal(partial.teamMatch, "partial-team");
  assert.equal(partial.gradingScore, undefined);
  assert.equal(partial.gradingAttribution, "unavailable");
});

test("advisor returns the three named strategies and respects conflicts", () => {
  const profile = fixtureProfile();
  const catalog = [course("CS101","A",["张老师","李助教"],1),course("MA101","A",["王老师"],1),course("MA101","B",["王老师"],3)];
  const nces: NcesCourseEvidence[] = [{code:"CS101",semester:"2025秋",teacher:"张老师、李助教",grading:{pct:88,label:"Excellent"},rating:4.5,reviewCount:12}];
  const result = recommendCourses({profile,semester:"2026-2027-1",weekOneMonday:"2026-09-07",catalog,nces,generatedAt:"2026-08-28T00:00:00.000Z"});
  assert.deepEqual(result.strategies.map((plan)=>plan.strategy),["high-load","high-grading","interest"]);
  for(const plan of result.strategies) assert.equal(plan.sections.length,2);
  const html = renderHtml(result);
  assert.match(html, /高负载/);
  assert.match(html, /class=\"team\"/);
  assert.match(html, /主修确认/);
  assert.match(html, /辅修确认/);
  assert.match(html, /colorFor\(s.code\)/);
  assert.match(renderStrategyIcs(result,result.strategies[0]), /BEGIN:VCALENDAR/);
});

test("advisor never pads a credit target with curriculum-unresolved courses", () => {
  const profile = fixtureProfile();
  profile.preferences.creditTargets.mainProgram.target = 9;
  profile.preferences.creditTargets.mainProgram.max = 12;
  profile.curriculum.courses.push({code:"EE207",required:false,module:"归属待人工确认",program:"main-program",sourcePage:18,confidence:"needs-review"});
  const catalog = [course("CS101","A",["张老师"],1),course("MA101","A",["王老师"],3),course("EE207","A",["何老师"],5)];

  const confirmedOnly = recommendCourses({ profile, semester:"2026-2027-1", catalog });
  for (const plan of confirmedOnly.strategies) {
    assert.deepEqual(plan.sections.map((section) => section.code).sort(), ["CS101", "MA101"]);
    assert.equal(plan.confirmedCredits, 6);
    assert.equal(plan.unresolvedCredits, 0);
    assert.match(plan.warnings.join(" "), /Do not auto-fill/);
  }

  profile.preferences.mustInclude = ["EE207"];
  const explicitlyRequested = recommendCourses({ profile, semester:"2026-2027-1", catalog });
  for (const plan of explicitlyRequested.strategies) {
    assert.ok(plan.sections.some((section) => section.code === "EE207"));
    assert.equal(plan.confirmedCredits, 6);
    assert.equal(plan.unresolvedCredits, 3);
    assert.match(plan.warnings.join(" "), /curriculum membership is unresolved/);
  }
});

test("main-program credit preferences cannot exceed 25 credits", () => {
  const profile = fixtureProfile();
  profile.preferences.creditTargets.mainProgram.target = 26;
  profile.preferences.creditTargets.mainProgram.max = 26;
  assert.throws(() => recommendCourses({ profile, semester:"2026-2027-1", catalog:[] }), /max <= 25/);
});

test("minor-program credit targets are tracked separately and may exceed 25 credits", () => {
  const profile = fixtureProfile();
  profile.preferences.creditTargets.minorProgram = { min: 0, target: 27, max: 30 };
  profile.curriculum.courses.push({code:"FIN101",required:true,module:"辅修",program:"minor-program",sourcePage:3,confidence:"verified"});
  const result = recommendCourses({ profile, semester:"2026-2027-1", catalog:[course("FIN101","A",["赵老师"],5)] });
  assert.equal(result.strategies[0].minorProgramCredits, 3);
  assert.equal(result.strategies[0].mainProgramCredits, 0);
  assert.equal(result.strategies[0].creditClassification["FIN101-A"], "minor-program");
});

test("course colors are stable across HTML and XLSX exports without a small modulo palette", () => {
  assert.equal(courseColorCss(" cs207 "), courseColorCss("CS207"));
  assert.equal(courseColorArgb(" cs207 "), courseColorArgb("CS207"));
  assert.equal(new Set(["CS207", "CS221", "EE207", "CLE030", "IPE104", "CS317"].map(courseColorCss)).size, 6);
});

test("catalog projection drops unrelated fields and excludes ambiguous component identities", () => {
  const lecture = { ...course("CS101","A",["张老师"],1), unrelatedStudentProfile: { numericGrade: 99 } };
  const lab = { ...course("CS101","A",["李助教"],3), sectionName:"A-LAB", rwh:"CS101-A-LAB", id:"lab-id" };
  const normal = { ...course("MA101","B",["王老师"],4), rawPayload:"must not survive" };
  const normalized = normalizeCatalogRows([lecture, lab, normal, { code:"BROKEN" }]);
  assert.deepEqual(normalized.ambiguousCodes, ["CS101"]);
  assert.equal(normalized.rejectedRows, 1);
  assert.deepEqual(normalized.sections.map((section) => section.code), ["MA101"]);
  assert.equal("rawPayload" in normalized.sections[0], false);
});

test("advisor workbook is a real XLSX zip with all strategy sheets", async () => {
  const result = recommendCourses({
    profile: fixtureProfile(), semester: "2026-2027-1", weekOneMonday: "2026-09-07",
    catalog: [course("CS101","A",["张老师","李助教"],1),course("MA101","B",["王老师"],3)],
    generatedAt: "2026-08-28T00:00:00.000Z",
  });
  const workbook = await buildWorkbook(result);
  assert.equal(workbook.subarray(0, 2).toString(), "PK");
  assert.ok(workbook.length > 5_000);
});

test("audit exposes conflicts, duplicate credit rows, early periods, and weekday footprint", () => {
  const result = recommendCourses({
    profile: fixtureProfile(), semester: "2026-2027-1",
    catalog: [course("CS101","A",["张老师"],1),course("MA101","A",["王老师"],3)],
  });
  const clean = auditAdvisorResult(result);
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.plans[0].daysUsed, [1, 3]);
  assert.equal(clean.plans[0].hasEarlyPeriods, true);

  const broken = structuredClone(result);
  broken.strategies[0].sections.push({ ...broken.strategies[0].sections[0], rwh: "CS101-B" });
  const report = auditAdvisorResult(broken);
  assert.equal(report.ok, false);
  assert.deepEqual(report.plans[0].duplicateCourseCodes, ["CS101"]);
  assert.deepEqual(report.plans[0].duplicateOpaqueIds, ["id-CS101-A"]);
  assert.ok(report.plans[0].conflicts.length > 0);
  assert.throws(() => assertAuditableResult(broken), /failed safety audit/i);
});

test("CLI blocks export and preview before any side effect when audit fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-audit-gate-"));
  const input = join(directory, "broken.json");
  const html = join(directory, "should-not-exist.html");
  const xlsx = join(directory, "should-not-exist.xlsx");
  const ics = join(directory, "should-not-exist-ics");
  try {
    const broken = recommendCourses({ profile: fixtureProfile(), semester:"2026-2027-1", catalog:[course("CS101","A",["张老师"],1)] });
    broken.strategies[0].sections.push({ ...broken.strategies[0].sections[0], rwh:"CS101-B" });
    await writeFile(input, JSON.stringify(broken), "utf8");
    const cli = fileURLToPath(new URL("../cli.js", import.meta.url));
    await assert.rejects(
      execFile(process.execPath, [cli,"export","--input",input,"--html",html,"--xlsx",xlsx,"--ics-dir",ics]),
      (error: unknown) => Boolean(error && typeof error === "object" && "stderr" in error && /failed safety audit/i.test(String(error.stderr))),
    );
    await assert.rejects(access(html));
    await assert.rejects(
      execFile(process.execPath, [cli,"preview","--input",input,"--strategy","high-load","--operation","cart"], { env:{...process.env,SUSTECH_BIN:join(directory,"must-not-run")} }),
      (error: unknown) => Boolean(error && typeof error === "object" && "stderr" in error && /failed safety audit/i.test(String(error.stderr))),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema v1 profiles and results migrate conservatively to schema v2", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-schema-"));
  const profilePath = join(directory, "profile.json");
  const resultPath = join(directory, "result.json");
  try {
    const legacyProfile = {
      ...fixtureProfile(), schemaVersion: "1",
      curriculum: { ...fixtureProfile().curriculum, courses: fixtureProfile().curriculum.courses.map(({ program: _program, ...rule }) => rule) },
      preferences: { minCredits: 0, targetCredits: 6, maxCredits: 8, blocked: [], mustInclude: [], exclude: [], interests: [], preferredTeams: [], avoidedTeams: [] },
    };
    const currentResult = recommendCourses({ profile: fixtureProfile(), semester:"2026-2027-1", catalog:[course("CS101","A",["张老师"],1)] });
    const legacyResult = {
      ...currentResult, schemaVersion: "1",
      strategies: currentResult.strategies.map(({ mainProgramCredits: _main, minorProgramCredits: _minor, creditClassification: _classification, ...plan }) => plan),
    };
    await writeFile(profilePath, JSON.stringify(legacyProfile), "utf8");
    await writeFile(resultPath, JSON.stringify(legacyResult), "utf8");
    const migratedProfile = await loadProfile(profilePath);
    const migratedResult = await loadResult(resultPath);
    assert.equal(migratedProfile.schemaVersion, "2");
    assert.equal(migratedProfile.curriculum.courses[0].program, "main-program");
    assert.equal(migratedResult.schemaVersion, "2");
    assert.equal(migratedResult.strategies[0].mainProgramCredits, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("environment preflight checks project, capabilities, consequences, and live TIS auth", async () => {
  assert.equal(versionAtLeast("20.18.0", "20.18.0"), true);
  assert.equal(versionAtLeast("20.17.9", "20.18.0"), false);
  const commands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview","curriculum sources","curriculum fetch"];
  const report = await inspectEnvironment({
    profile: "student",
    live: true,
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "student" && arg !== "tis").join(" ");
      if (command === "version") return {version:"0.8.4",runtime:"node v20.18.0"};
      if (command === "capabilities") return {capabilities:commands.map((name)=>({command:name}))};
      if (command === "consequences") return {consequences:["tis.enroll","tis.cart.update","curriculum.fetch"].map((operation)=>({operation}))};
      if (command === "auth status") return {configured:true,credentialAvailable:true,backendAvailable:true,backend:"test",persistent:true,maskedSid:"12****34"};
      if (command === "auth check") return {service:"tis",authenticated:true};
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
  });
  assert.equal(report.ok, true);
  assert.equal(report.installationReady, true);
  assert.equal(report.authenticationReady, true);
  assert.equal((report.authentication as Record<string,unknown>).profile, "student");
});

test("credential-store failures do not misreport a compatible installation as broken", async () => {
  const commands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview","curriculum sources","curriculum fetch"];
  const report = await inspectEnvironment({
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "default").join(" ");
      if (command === "version") return { version:"0.10.0" };
      if (command === "capabilities") return { capabilities:commands.map((name)=>({command:name})) };
      if (command === "consequences") return { consequences:["tis.enroll","tis.cart.update","curriculum.fetch"].map((operation)=>({operation})) };
      const error = Object.assign(new Error("secret backend detail"), { code:"CREDENTIAL_STORE_ERROR" });
      throw error;
    },
  });
  assert.equal(report.installationReady, true);
  assert.equal(report.authenticationReady, false);
  assert.deepEqual(report.installationErrors, []);
  assert.deepEqual(report.authenticationErrors, ["auth status: CREDENTIAL_STORE_ERROR"]);
});

test("diagnostics contain only projected metadata and retain at most ten local reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-diagnostics-"));
  try {
    const environment = {
      installationReady: true, authenticationReady: false, readyForPersonalizedPlanning: false,
      project: { root: "/synthetic/home/student/project", packageVersion: "0.2.0", manifestOk: true, buildPresent: true, runtimeDependenciesAvailable: true },
      sustech: { available: true, version: "0.10.0", missingCapabilities: ["projected degree progress"], missingConsequences: [] },
      network: { proxyMode: "direct" },
      authentication: { profile: "student-secret", maskedSid: "12****34", credentialAvailable: false, backendAvailable: true, backend: "test", live: { status: "not-requested" } },
      errors: ["auth status: CREDENTIAL_STORE_ERROR"],
    };
    for (let index = 0; index < 12; index += 1) {
      const report = createDiagnosticReport(environment, `2026-09-02T00:00:${String(index).padStart(2,"0")}.000Z`);
      assertDiagnosticSafe(report);
      assert.doesNotMatch(JSON.stringify(report), /student-secret|12\*\*\*\*34|\/synthetic\/home/);
      await writeRollingDiagnostic(report, { directory, keep: 10 });
    }
    const { readdir } = await import("node:fs/promises");
    assert.equal((await readdir(directory)).length, 10);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("SUSTech child processes default to direct access and can explicitly inherit proxies", () => {
  const source = {
    PATH: "fixture-path",
    HTTP_PROXY: "http://proxy.invalid:8080",
    https_proxy: "http://proxy.invalid:8080",
    ALL_PROXY: "socks5://proxy.invalid:1080",
    NODE_USE_ENV_PROXY: "1",
    npm_config_proxy: "http://proxy.invalid:8080",
    CUSTOM_VALUE: "preserved",
  };
  const env = sustechChildEnv(source);
  assert.equal(env.PATH, "fixture-path");
  assert.equal(env.CUSTOM_VALUE, "preserved");
  assert.equal(env.HTTP_PROXY, undefined);
  assert.equal(env.https_proxy, undefined);
  assert.equal(env.ALL_PROXY, undefined);
  assert.equal(env.NODE_USE_ENV_PROXY, undefined);
  assert.equal(env.npm_config_proxy, undefined);
  assert.equal(env.NO_PROXY, "*");
  assert.equal(env.no_proxy, "*");

  const inherited = sustechChildEnv(source, "inherit");
  assert.equal(inherited.HTTP_PROXY, "http://proxy.invalid:8080");
  assert.equal(inherited.https_proxy, "http://proxy.invalid:8080");
  assert.equal(inherited.NODE_USE_ENV_PROXY, "1");
  assert.equal(proxyModeFromEnv({}), "direct");
  assert.equal(proxyModeFromEnv({ SUSTECH_ADVISOR_PROXY_MODE: "inherit" }), "inherit");
  assert.throws(() => proxyModeFromEnv({ SUSTECH_ADVISOR_PROXY_MODE: "automatic" }), /direct or inherit/);
});

test("Windows can launch an npm-style .cmd executable from a path containing spaces", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor cmd "));
  const script = join(directory, "fake sustech.mjs");
  const launcher = join(directory, "fake sustech.cmd");
  try {
    await writeFile(script, "process.stdout.write(JSON.stringify({ok:true,data:process.argv.slice(2)}));\n", "utf8");
    await writeFile(launcher, `@echo off\r\n"${process.execPath}" "%~dp0fake sustech.mjs" %*\r\n`, "utf8");
    const result = await runSustech(["tis", "courses", "search", "CS101"], { executable: launcher });
    assert.deepEqual(result, ["tis", "courses", "search", "CS101", "--json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("macOS and Linux launch direct executables from a path containing spaces", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor executable "));
  const executable = join(directory, "fake sustech");
  try {
    await writeFile(executable, `#!${process.execPath}\nprocess.stdout.write(JSON.stringify({ok:true,data:process.argv.slice(2)}));\n`, "utf8");
    await chmod(executable, 0o700);
    const result = await runSustech(["tis", "courses", "search", "CS101"], { executable });
    assert.deepEqual(result, ["tis", "courses", "search", "CS101", "--json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fixtureProfile(): AdvisorProfile { return {kind:"sustech-advisor-profile",schemaVersion:"2",identity:{cohort:2023,major:"计算机科学与技术"},curriculum:{title:"fixture",confirmed:true,courses:[{code:"CS101",required:true,module:"专业基础",program:"main-program",sourcePage:12,confidence:"verified"},{code:"MA101",required:true,module:"数学",program:"main-program",sourcePage:4,confidence:"verified"}],manualReview:[]},preferences:{creditTargets:{mainProgram:{min:0,target:6,max:8}},blocked:[],mustInclude:[],exclude:[],interests:["计算机"],preferredTeams:[],avoidedTeams:[]}}; }
function course(code:string,group:string,teachers:string[],day:number):CourseSection{return{code,name:code==="CS101"?"计算机导论":"数学分析",sectionName:group,classGroup:group,rwh:`${code}-${group}`,id:`id-${code}-${group}`,college:"理学院",category:"",nature:"",campus:"南校区",credits:3,capacity:30,enrolled:20,teachers,schedule:[{weeks:[1,2],day,dayName:`周${day}`,periodStart:1,periodEnd:2,room:"R1"}]};}
