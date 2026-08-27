import assert from "node:assert/strict";
import test from "node:test";
import { attributeTeachingTeam } from "../nces/evidence.js";
import { recommendCourses } from "../solver/recommend.js";
import { renderHtml } from "../exporters/html.js";
import { renderStrategyIcs } from "../exporters/ics.js";
import { buildWorkbook } from "../exporters/xlsx.js";
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
  assert.match(renderHtml(result), /高负载/);
  assert.match(renderStrategyIcs(result,result.strategies[0]), /BEGIN:VCALENDAR/);
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

function fixtureProfile(): AdvisorProfile { return {kind:"sustech-advisor-profile",schemaVersion:"1",identity:{cohort:2023,major:"计算机科学与技术"},curriculum:{title:"fixture",confirmed:true,courses:[{code:"CS101",required:true,module:"专业基础",sourcePage:12,confidence:"verified"},{code:"MA101",required:true,module:"数学",sourcePage:4,confidence:"verified"}],manualReview:[]},preferences:{minCredits:0,targetCredits:6,maxCredits:8,blocked:[],mustInclude:[],exclude:[],interests:["计算机"],preferredTeams:[],avoidedTeams:[]}}; }
function course(code:string,group:string,teachers:string[],day:number):CourseSection{return{code,name:code==="CS101"?"计算机导论":"数学分析",sectionName:group,classGroup:group,rwh:`${code}-${group}`,id:`id-${code}-${group}`,college:"理学院",category:"",nature:"",campus:"南校区",credits:3,capacity:30,enrolled:20,teachers,schedule:[{weeks:[1,2],day,dayName:`周${day}`,periodStart:1,periodEnd:2,room:"R1"}]};}
