import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attributeTeachingTeam } from "../nces/evidence.js";
import { recommendCourses } from "../solver/recommend.js";
import { auditAdvisorResult } from "../solver/audit.js";
import { renderHtml } from "../exporters/html.js";
import { renderStrategyIcs } from "../exporters/ics.js";
import { buildWorkbook } from "../exporters/xlsx.js";
import { courseColorArgb, courseColorCss } from "../exporters/colors.js";
import { inspectEnvironment, versionAtLeast } from "../core/environment.js";
import { proxyModeFromEnv, runSustech, sustechChildEnv } from "../core/sustech.js";
import type { AdvisorProfile, CourseSection, NcesCourseEvidence } from "../types.js";

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
  assert.match(html, /colorFor\(s.code\)/);
  assert.match(renderStrategyIcs(result,result.strategies[0]), /BEGIN:VCALENDAR/);
});

test("advisor never pads a credit target with curriculum-unresolved courses", () => {
  const profile = fixtureProfile();
  profile.preferences.targetCredits = 9;
  profile.preferences.maxCredits = 12;
  profile.curriculum.courses.push({code:"EE207",required:false,module:"归属待人工确认",sourcePage:18,confidence:"needs-review"});
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
  profile.preferences.targetCredits = 26;
  profile.preferences.maxCredits = 26;
  assert.throws(() => recommendCourses({ profile, semester:"2026-2027-1", catalog:[] }), /max <= 25/);
});

test("course colors are stable across HTML and XLSX exports without a small modulo palette", () => {
  assert.equal(courseColorCss(" cs207 "), courseColorCss("CS207"));
  assert.equal(courseColorArgb(" cs207 "), courseColorArgb("CS207"));
  assert.equal(new Set(["CS207", "CS221", "EE207", "CLE030", "IPE104", "CS317"].map(courseColorCss)).size, 6);
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
  assert.ok(report.plans[0].conflicts.length > 0);
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
  assert.equal((report.authentication as Record<string,unknown>).profile, "student");
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

function fixtureProfile(): AdvisorProfile { return {kind:"sustech-advisor-profile",schemaVersion:"1",identity:{cohort:2023,major:"计算机科学与技术"},curriculum:{title:"fixture",confirmed:true,courses:[{code:"CS101",required:true,module:"专业基础",sourcePage:12,confidence:"verified"},{code:"MA101",required:true,module:"数学",sourcePage:4,confidence:"verified"}],manualReview:[]},preferences:{minCredits:0,targetCredits:6,maxCredits:8,blocked:[],mustInclude:[],exclude:[],interests:["计算机"],preferredTeams:[],avoidedTeams:[]}}; }
function course(code:string,group:string,teachers:string[],day:number):CourseSection{return{code,name:code==="CS101"?"计算机导论":"数学分析",sectionName:group,classGroup:group,rwh:`${code}-${group}`,id:`id-${code}-${group}`,college:"理学院",category:"",nature:"",campus:"南校区",credits:3,capacity:30,enrolled:20,teachers,schedule:[{weeks:[1,2],day,dayName:`周${day}`,periodStart:1,periodEnd:2,room:"R1"}]};}
