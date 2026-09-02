import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { proxyModeFromEnv, runSustech, SustechCommandError, sustechChildEnv } from "../core/sustech.js";
import { loadProfile, loadResult } from "../core/store.js";
import { assertDiagnosticSafe, createDiagnosticReport, writeRollingDiagnostic } from "../core/diagnostics.js";
import { normalizeCatalogRows } from "../core/catalog.js";
import { assertSourceCacheSafe, createSourceCache, loadSourceCache, writeSourceCache } from "../core/cache.js";
import { cacheFreshness } from "../core/execution.js";
import { fetchLiveRecommendationSources } from "../core/planning.js";
import type { AdvisorProfile, CourseSection, NcesCourseEvidence } from "../types.js";

const execFile = promisify(execFileCallback);

test("release install policy creates a pinned consumer root and rejects unrelated manifests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-install-policy-"));
  const packageRoot = join(directory, "packages");
  const archiveName = "sustech-course-advisor-0.2.3.tgz";
  const archive = join(directory, archiveName);
  const policy = fileURLToPath(new URL("../../skills/sustech-course-advisor/scripts/install-policy.mjs", import.meta.url));
  try {
    await mkdir(packageRoot, { recursive: true });
    await writeFile(archive, "synthetic release archive", "utf8");
    await execFile(process.execPath, [policy, "prepare", packageRoot, archive, archiveName, "0.10.0"]);
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    assert.deepEqual(manifest.dependencies, {
      "sustech-course-advisor": `file:../releases/${archiveName}`,
      "sustech-cli": "0.10.0",
    });
    assert.deepEqual(manifest.overrides, { uuid: "^11.1.1" });
    assert.equal(await readFile(join(directory, "releases", archiveName), "utf8"), "synthetic release archive");

    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "unrelated-project" }), "utf8");
    await assert.rejects(
      execFile(process.execPath, [policy, "prepare", packageRoot, archive, archiveName, "0.10.0"]),
      /Refusing to replace an unrelated package manifest/,
    );
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ dependencies: { unrelated: "1.0.0" } }), "utf8");
    await assert.rejects(
      execFile(process.execPath, [policy, "prepare", packageRoot, archive, archiveName, "0.10.0"]),
      /Refusing to replace an unrelated package manifest/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release install policy verifies exact packages and the safe uuid boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-install-verify-"));
  const packageRoot = join(directory, "packages");
  const policy = fileURLToPath(new URL("../../skills/sustech-course-advisor/scripts/install-policy.mjs", import.meta.url));
  try {
    for (const name of ["sustech-course-advisor", "sustech-cli", "exceljs", "uuid"]) {
      await mkdir(join(packageRoot, "node_modules", name), { recursive: true });
    }
    await writeFile(join(packageRoot, "node_modules", "sustech-course-advisor", "package.json"), JSON.stringify({ version: "0.2.3" }), "utf8");
    await writeFile(join(packageRoot, "node_modules", "sustech-cli", "package.json"), JSON.stringify({ version: "0.10.0" }), "utf8");
    await writeFile(join(packageRoot, "node_modules", "exceljs", "package.json"), JSON.stringify({ version: "4.4.0" }), "utf8");
    const uuidManifest = join(packageRoot, "node_modules", "uuid", "package.json");
    await writeFile(uuidManifest, JSON.stringify({ version: "11.1.1" }), "utf8");
    await execFile(process.execPath, [policy, "verify", packageRoot, "0.2.3", "0.10.0"]);

    await writeFile(uuidManifest, JSON.stringify({ version: "8.3.2" }), "utf8");
    await assert.rejects(
      execFile(process.execPath, [policy, "verify", packageRoot, "0.2.3", "0.10.0"]),
      /below the stable 11\.1\.1 boundary/,
    );
    await writeFile(uuidManifest, JSON.stringify({ version: "11.1.1-0" }), "utf8");
    await assert.rejects(
      execFile(process.execPath, [policy, "verify", packageRoot, "0.2.3", "0.10.0"]),
      /below the stable 11\.1\.1 boundary/,
    );
    await rm(join(packageRoot, "node_modules", "uuid"), { recursive: true, force: true });
    await rm(join(packageRoot, "node_modules", "exceljs"), { recursive: true, force: true });
    const nestedExceljs = join(packageRoot, "node_modules", "sustech-course-advisor", "node_modules", "exceljs");
    const nestedUuid = join(nestedExceljs, "node_modules", "uuid");
    await mkdir(nestedUuid, { recursive: true });
    await writeFile(join(nestedExceljs, "package.json"), JSON.stringify({ version: "4.4.0" }), "utf8");
    await writeFile(join(nestedUuid, "package.json"), JSON.stringify({ version: "11.1.1" }), "utf8");
    await execFile(process.execPath, [policy, "verify", packageRoot, "0.2.3", "0.10.0"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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

test("an older CLI with the complete capability contract remains compatible", async () => {
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

test("a current-version CLI missing one capability is named and blocked before live authentication", async () => {
  const completeCommands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview","curriculum sources","curriculum fetch"];
  const availableCommands = completeCommands.filter((name) => name !== "tis selection preview");
  let liveAuthenticationCalls = 0;
  const report = await inspectEnvironment({
    live: true,
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "default" && arg !== "tis").join(" ");
      if (command === "version") return { version:"0.10.0" };
      if (command === "capabilities") return { capabilities:availableCommands.map((name)=>({command:name})) };
      if (command === "consequences") return { consequences:["tis.enroll","tis.cart.update","curriculum.fetch"].map((operation)=>({operation})) };
      if (command === "auth status") return { configured:true, credentialAvailable:true, backendAvailable:true, backend:"test" };
      if (command === "auth check") { liveAuthenticationCalls += 1; return { authenticated:true }; }
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
  });
  assert.equal(report.installationReady, false);
  assert.equal(report.readyForPersonalizedPlanning, false);
  assert.deepEqual((report.sustech as Record<string,unknown>).missingCapabilities, ["tis selection preview"]);
  assert.equal(liveAuthenticationCalls, 0);
  const live = (report.authentication as Record<string,Record<string,unknown>>).live;
  assert.equal(live.status, "skipped");
  assert.match(String(live.reason), /capability preflight is incomplete/);
});

test("the published 0.10.0 core surface is ready with explicit curriculum acquisition fallback", async () => {
  const commands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview"];
  const report = await inspectEnvironment({
    live: true,
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "default" && arg !== "tis").join(" ");
      if (command === "version") return { version:"0.10.0" };
      if (command === "capabilities") return { capabilities:commands.map((name)=>({command:name})) };
      if (command === "consequences") return { consequences:["tis.enroll","tis.cart.update"].map((operation)=>({operation})) };
      if (command === "auth status") return { configured:true, credentialAvailable:true, backendAvailable:true, backend:"test" };
      if (command === "auth check") return { authenticated:true };
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
  });
  assert.equal(report.installationReady, true);
  assert.equal(report.readyForPersonalizedPlanning, true);
  assert.deepEqual((report.sustech as Record<string,unknown>).missingCapabilities, []);
  const optional = (report.sustech as Record<string,Array<Record<string,unknown>>>).optionalFeatures[0];
  assert.equal(optional.name, "automatic-curriculum-acquisition");
  assert.equal(optional.available, false);
  assert.deepEqual(optional.missingCapabilities, ["curriculum sources", "curriculum fetch"]);
  assert.deepEqual(optional.missingConsequences, ["curriculum.fetch"]);
  assert.match((report.remediation as string[]).join(" "), /confirmed official public PDF/);
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

test("doctor bounds a hanging credential-store status check without breaking installation readiness", async () => {
  const commands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview"];
  const startedAt = Date.now();
  const report = await inspectEnvironment({
    commandTimeoutMs: 25,
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "default").join(" ");
      if (command === "version") return { version:"0.10.0" };
      if (command === "capabilities") return { capabilities:commands.map((name)=>({command:name})) };
      if (command === "consequences") return { consequences:["tis.enroll","tis.cart.update"].map((operation)=>({operation})) };
      if (command === "auth status") return new Promise<never>(() => undefined);
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
  });
  assert.ok(Date.now() - startedAt < 1_000);
  assert.equal(report.installationReady, true);
  assert.equal(report.authenticationReady, false);
  assert.deepEqual(report.installationErrors, []);
  assert.deepEqual(report.authenticationErrors, ["auth status: COMMAND_TIMEOUT"]);
});

test("doctor never accepts an environment probe timeout above the documented ten-second cap", async () => {
  await assert.rejects(
    inspectEnvironment({ commandTimeoutMs:10_001, run:async () => ({}) }),
    /integer from 1 to 10000/,
  );
});

test("live doctor bounds a hanging authenticated read and reports a stable failure code", async () => {
  const commands = ["version","capabilities","consequences","auth status","auth check","tis courses search","tis courses available","tis degree progress","nces search","tis selection preview"];
  const report = await inspectEnvironment({
    live: true,
    commandTimeoutMs: 25,
    run: async (args) => {
      const command = args.filter((arg) => !arg.startsWith("--") && arg !== "default" && arg !== "tis").join(" ");
      if (command === "version") return { version:"0.10.0" };
      if (command === "capabilities") return { capabilities:commands.map((name)=>({command:name})) };
      if (command === "consequences") return { consequences:["tis.enroll","tis.cart.update"].map((operation)=>({operation})) };
      if (command === "auth status") return { configured:true, credentialAvailable:true, backendAvailable:true, backend:"test" };
      if (command === "auth check") return new Promise<never>(() => undefined);
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
  });
  assert.equal(report.installationReady, true);
  assert.equal(report.authenticationReady, false);
  assert.deepEqual(report.authenticationErrors, ["auth check: COMMAND_TIMEOUT"]);
  const live = (report.authentication as Record<string,Record<string,unknown>>).live;
  assert.deepEqual(live, { requested:true, status:"failed", error:"COMMAND_TIMEOUT" });
});

test("diagnostics contain only projected metadata and retain at most ten local reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-diagnostics-"));
  try {
    const environment = {
      installationReady: true, authenticationReady: false, readyForPersonalizedPlanning: false,
      project: { root: "/synthetic/home/student/project", packageVersion: "0.2.0", manifestOk: true, buildPresent: true, runtimeDependenciesAvailable: true },
      sustech: { available: true, version: "0.10.0", missingCapabilities: ["projected degree progress"], missingConsequences: [], optionalFeatures: [{ name:"automatic-curriculum-acquisition", available:false, missingCapabilities:["curriculum sources","curriculum fetch"], missingConsequences:["curriculum.fetch"] }] },
      network: { proxyMode: "direct" },
      authentication: { profile: "student-secret", maskedSid: "12****34", credentialAvailable: false, backendAvailable: true, backend: "test", live: { status: "not-requested" } },
      errors: ["auth status: CREDENTIAL_STORE_ERROR"],
    };
    for (let index = 0; index < 12; index += 1) {
      const report = createDiagnosticReport(environment, `2026-09-02T00:00:${String(index).padStart(2,"0")}.000Z`);
      assertDiagnosticSafe(report);
      assert.doesNotMatch(JSON.stringify(report), /student-secret|12\*\*\*\*34|\/synthetic\/home/);
      await writeRollingDiagnostic(report, { directory, keep: 10 });
      assert.deepEqual(report.sustech.unavailableOptionalFeatures, [{
        name:"automatic-curriculum-acquisition",
        missingCapabilities:["curriculum sources","curriculum fetch"],
        missingConsequences:["curriculum.fetch"],
      }]);
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

test("source caches are timestamped projections and report fresh versus stale state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-source-cache-"));
  const cachePath = join(directory, "sources.json");
  try {
    const cache = createSourceCache({
      semester: "2026-2027-1", capturedAt: "2026-09-02T00:00:00.000Z",
      sourceTimestamps: { tisCatalog: "2026-09-02T00:00:00.000Z", nces: "2026-09-02T00:00:01.000Z" },
      catalog: [{ ...course("CS101", "A", ["张老师"], 1), rawPayload: { studentId: "secret" } } as CourseSection],
      nces: [{ code:"CS101", semester:"2025秋", teacher:"张老师", grading:{pct:88,label:"Excellent"}, rating:4.5, reviewCount:12 }],
      sourceStatuses: { tisCatalog: { ok: true }, nces: { ok: true } },
    });
    await writeSourceCache(cachePath, cache);
    const saved = await readFile(cachePath, "utf8");
    assert.doesNotMatch(saved, /rawPayload|studentId|secret/);
    assert.equal((await loadSourceCache(cachePath)).catalog[0].code, "CS101");
    assert.equal(cacheFreshness(cache.capturedAt, 60_000, Date.parse("2026-09-02T00:00:30.000Z")).status, "fresh");
    assert.equal(cacheFreshness(cache.capturedAt, 60_000, Date.parse("2026-09-02T00:02:00.000Z")).status, "stale");
    assert.throws(() => assertSourceCacheSafe({ token: "secret" }), /Unsafe key/);
    assert.throws(() => assertSourceCacheSafe({ access_token: "secret" }), /Unsafe key/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("live source reads retry only bounded transient failures and retain source timestamps", async () => {
  const calls: string[] = [];
  const timeouts: number[] = [];
  const sourceTimestamps: Record<string, string> = {};
  let firstCatalogAttempt = true;
  let nowMs = Date.parse("2026-09-02T00:00:00.000Z");
  let retries = 0;
  const sources = await fetchLiveRecommendationSources(fixtureProfile(), {
    semester: "2026-2027-1", totalTimeoutMs: 2_000, maxRetries: 1, proxyMode: "direct",
    now: () => nowMs,
    onRetry: () => { retries += 1; },
    onSource: (name, timestamp) => { sourceTimestamps[name] = timestamp; },
    run: async (args, options) => {
      calls.push(args.join(" "));
      timeouts.push(options.timeoutMs);
      nowMs += 100;
      if (args[0] === "tis" && firstCatalogAttempt) {
        firstCatalogAttempt = false;
        throw new SustechCommandError("launch", "COMMAND_TIMEOUT");
      }
      if (args[0] === "tis") return { courses: [course(String(args[3]), "A", ["张老师"], 1)] };
      return { items: [] };
    },
  });
  assert.equal(retries, 1);
  assert.equal(calls.filter((call) => call.startsWith("tis courses")).length, 3);
  assert.ok(timeouts.every((timeout) => timeout > 0 && timeout <= 2_000));
  assert.equal(sources.catalog.length, 2);
  assert.equal(sources.sourceStatuses.tisCatalog.ok, true);
  assert.deepEqual(Object.keys(sourceTimestamps), ["tisCatalog", "nces"]);
});

test("a timed SUSTech child is terminated with a stable timeout code", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-timeout-"));
  const executable = join(directory, process.platform === "win32" ? "slow sustech.cmd" : "slow sustech");
  try {
    const source = process.platform === "win32"
      ? `@echo off\r\n"${process.execPath}" -e "setTimeout(() =^> {}, 10000)" %*\r\n`
      : `#!${process.execPath}\nsetTimeout(() => process.stdout.write(JSON.stringify({ok:true,data:{}})), 10_000);\n`;
    await writeFile(executable, source, "utf8");
    if (process.platform !== "win32") await chmod(executable, 0o700);
    await assert.rejects(
      runSustech(["tis", "courses", "search", "CS101"], { executable, timeoutMs: 30 }),
      (error: unknown) => error instanceof SustechCommandError && error.code === "COMMAND_TIMEOUT",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cached and render-only workflows never start the campus CLI and emit complete telemetry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-workflows-"));
  const profilePath = join(directory, "profile.json");
  const cachePath = join(directory, "cache.json");
  const cachedPlan = join(directory, "cached-plan.json");
  const renderedHtml = join(directory, "plan.html");
  const renderedXlsx = join(directory, "plan.xlsx");
  const renderedIcs = join(directory, "ics");
  const reportFile = join(directory, "render-report.json");
  const cli = fileURLToPath(new URL("../cli.js", import.meta.url));
  const blockedExecutable = join(directory, "campus-cli-must-not-run");
  try {
    await writeFile(profilePath, JSON.stringify(fixtureProfile()), "utf8");
    await writeSourceCache(cachePath, createSourceCache({
      semester: "2026-2027-1", capturedAt: "2026-01-01T00:00:00.000Z",
      sourceTimestamps: { tisCatalog: "2026-01-01T00:00:00.000Z", nces: "2026-01-01T00:00:01.000Z" },
      catalog: [course("CS101", "A", ["张老师"], 1), course("MA101", "A", ["王老师"], 3)], nces: [],
      sourceStatuses: { tisCatalog: { ok: true }, nces: { ok: true } },
    }));
    const collidingDestination = process.platform === "win32" ? profilePath.toUpperCase() : profilePath;
    await assert.rejects(
      execFile(process.execPath, [cli, "workflow", "--mode", "cached", "--path", profilePath, "--semester", "2026-2027-1", "--cache", cachePath, "--destination", collidingDestination, "--overwrite"], { env: { ...process.env, SUSTECH_BIN: blockedExecutable } }),
      (error: unknown) => Boolean(error && typeof error === "object" && "stderr" in error && /must not overwrite profile input/i.test(String(error.stderr))),
    );
    assert.equal((await loadProfile(profilePath)).kind, "sustech-advisor-profile");
    const cachedRun = await execFile(process.execPath, [cli, "workflow", "--mode", "cached", "--path", profilePath, "--semester", "2026-2027-1", "--cache", cachePath, "--destination", cachedPlan, "--week-one-monday", "2026-09-07"], { env: { ...process.env, SUSTECH_BIN: blockedExecutable } });
    const cachedOutput = JSON.parse(cachedRun.stdout) as Record<string, unknown>;
    const cachedReport = cachedOutput.report as Record<string, unknown>;
    assert.equal(cachedReport.mode, "cached");
    assert.equal(cachedReport.proxyMode, "unused");
    assert.equal((cachedReport.cache as Record<string, unknown>).status, "stale");
    assert.ok(((cachedReport.cache as Record<string, unknown>).ageMs as number) > 0);
    assert.deepEqual(Object.keys(cachedReport.sourceTimestamps as Record<string, string>), ["tisCatalog", "nces"]);
    assert.equal((cachedReport.stages as Array<Record<string, unknown>>).some((stage) => stage.name === "authoritative-read"), false);
    assert.match(JSON.stringify(await loadResult(cachedPlan)), /Cached authoritative facts are stale/);

    const renderRun = await execFile(process.execPath, [cli, "workflow", "--mode", "render-only", "--input", cachedPlan, "--html", renderedHtml, "--xlsx", renderedXlsx, "--ics-dir", renderedIcs, "--report", reportFile], { env: { ...process.env, SUSTECH_BIN: blockedExecutable } });
    const renderOutput = JSON.parse(renderRun.stdout) as Record<string, unknown>;
    const renderReport = renderOutput.report as Record<string, unknown>;
    assert.equal(renderReport.mode, "render-only");
    assert.equal(renderReport.proxyMode, "unused");
    assert.equal((renderReport.cache as Record<string, unknown>).status, "not-used");
    assert.ok((renderReport.totalWallClockMs as number) >= 0);
    assert.deepEqual((renderReport.stages as Array<Record<string, unknown>>).map((stage) => stage.name), ["result-load", "audit", "render-html", "render-xlsx", "render-ics", "report-write"]);
    const persistedReport = JSON.parse(await readFile(reportFile, "utf8")) as Record<string, unknown>;
    assert.deepEqual(persistedReport, renderReport);
    const measuredStages = (renderReport.stages as Array<Record<string, number>>).reduce((total, stage) => total + stage.durationMs, 0);
    assert.ok((renderReport.totalWallClockMs as number) >= measuredStages);
    await access(renderedHtml);
    await access(renderedXlsx);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("live workflow writes a projected cache and reports its bounded authoritative stage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "advisor-live-workflow-"));
  const profilePath = join(directory, "profile.json");
  const cachePath = join(directory, "semester.sources.json");
  const planPath = join(directory, "plan.json");
  const script = join(directory, process.platform === "win32" ? "fake-sustech.mjs" : "fake sustech.mjs");
  const executable = process.platform === "win32" ? join(directory, "fake sustech.cmd") : script;
  const cli = fileURLToPath(new URL("../cli.js", import.meta.url));
  try {
    await writeFile(profilePath, JSON.stringify(fixtureProfile()), "utf8");
    await writeFile(script, `${process.platform === "win32" ? "" : `#!${process.execPath}\n`}const a=process.argv.slice(2);const code=String(a[3]||"CS101");const course={code,name:code,sectionName:"A",classGroup:"A",rwh:code+"-A",id:"id-"+code+"-A",college:"理学院",category:"",nature:"",campus:"南校区",credits:3,capacity:30,enrolled:20,teachers:["张老师"],schedule:[{weeks:[1,2],day:code==="CS101"?1:3,dayName:"周一",periodStart:1,periodEnd:2,room:"R1"}],rawPayload:{studentId:"must-not-survive"}};const data=a[0]==="tis"?{courses:[course]}:{items:[]};process.stdout.write(JSON.stringify({ok:true,data}));\n`, "utf8");
    if (process.platform === "win32") await writeFile(executable, `@echo off\r\n"${process.execPath}" "%~dp0fake-sustech.mjs" %*\r\n`, "utf8");
    else await chmod(executable, 0o700);
    const run = await execFile(process.execPath, [cli, "workflow", "--mode", "live", "--path", profilePath, "--semester", "2026-2027-1", "--cache", cachePath, "--destination", planPath, "--timeout-ms", "5000", "--retries", "1"], { env: { ...process.env, SUSTECH_BIN: executable } });
    const output = JSON.parse(run.stdout) as Record<string, unknown>;
    const report = output.report as Record<string, unknown>;
    assert.equal(report.mode, "live");
    assert.equal((report.cache as Record<string, unknown>).status, "written");
    assert.deepEqual(Object.keys(report.sourceTimestamps as Record<string, string>), ["tisCatalog", "nces"]);
    const authoritative = (report.stages as Array<Record<string, unknown>>).find((stage) => stage.name === "authoritative-read");
    assert.equal(authoritative?.retries, 0);
    assert.ok((authoritative?.durationMs as number) >= 0);
    const savedCache = await readFile(cachePath, "utf8");
    assert.doesNotMatch(savedCache, /rawPayload|studentId|must-not-survive/);
    assert.equal((await loadSourceCache(cachePath)).catalog.length, 2);
    await access(planPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fixtureProfile(): AdvisorProfile { return {kind:"sustech-advisor-profile",schemaVersion:"2",identity:{cohort:2023,major:"计算机科学与技术"},curriculum:{title:"fixture",confirmed:true,courses:[{code:"CS101",required:true,module:"专业基础",program:"main-program",sourcePage:12,confidence:"verified"},{code:"MA101",required:true,module:"数学",program:"main-program",sourcePage:4,confidence:"verified"}],manualReview:[]},preferences:{creditTargets:{mainProgram:{min:0,target:6,max:8}},blocked:[],mustInclude:[],exclude:[],interests:["计算机"],preferredTeams:[],avoidedTeams:[]}}; }
function course(code:string,group:string,teachers:string[],day:number):CourseSection{return{code,name:code==="CS101"?"计算机导论":"数学分析",sectionName:group,classGroup:group,rwh:`${code}-${group}`,id:`id-${code}-${group}`,college:"理学院",category:"",nature:"",campus:"南校区",credits:3,capacity:30,enrolled:20,teachers,schedule:[{weeks:[1,2],day,dayName:`周${day}`,periodStart:1,periodEnd:2,room:"R1"}]};}
