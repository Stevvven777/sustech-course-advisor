import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AdvisorProfile } from "../types.js";
import { record, runSustech } from "../core/sustech.js";

export async function guidedProfile(): Promise<AdvisorProfile> {
  let inferred: Record<string, unknown> = {};
  try { inferred = record(await runSustech(["tis", "degree", "progress"])); } catch { /* guided fallback */ }
  const context = record(inferred.context);
  const rl = createInterface({ input, output });
  try {
    output.write("我会先确认培养方案，再询问负载、时间、兴趣和教学团队偏好。\n");
    const cohort = numberAnswer(await rl.question(`入学年级${context.cohort ? ` [${context.cohort}]` : ""}: `), Number(context.cohort) || new Date().getFullYear());
    const major = textAnswer(await rl.question(`专业${context.major ? ` [${context.major}]` : ""}: `), String(context.major ?? ""));
    const track = textAnswer(await rl.question("方向/分流（没有可留空）: "), "") || undefined;
    const title = textAnswer(await rl.question(`官方培养方案标题 [${cohort}级${major}专业本科人才培养方案]: `), `${cohort}级${major}专业本科人才培养方案`);
    const confirmed = yes(await rl.question("你已核对该官方 PDF 与年级、专业、方向一致吗？ [y/N]: "));
    const minCredits = numberAnswer(await rl.question("主修最低学分 [12]: "), 12);
    const targetCredits = numberAnswer(await rl.question("主修目标学分 [18]: "), 18);
    const maxCredits = numberAnswer(await rl.question("主修最高学分 [24]: "), 24);
    const mustInclude = list(await rl.question("必须选课程代码（逗号分隔）: "));
    const exclude = list(await rl.question("排除课程代码（逗号分隔）: "));
    const interests = list(await rl.question("兴趣关键词（逗号分隔）: "), false);
    output.write("课程规则需由顾问读取官方 PDF 后写入 profile.curriculum.courses，并保留 sourcePage。\n");
    return {
      kind: "sustech-advisor-profile", schemaVersion: "2", identity: { cohort, major, ...(track ? { track } : {}) },
      curriculum: { title, confirmed, courses: [], manualReview: confirmed ? [] : ["Official curriculum PDF identity has not been confirmed."] },
      preferences: { creditTargets: { mainProgram: { min: minCredits, target: targetCredits, max: maxCredits } }, blocked: [], mustInclude, exclude, interests, preferredTeams: [], avoidedTeams: [] },
      refreshedAt: new Date().toISOString(),
    };
  } finally { rl.close(); }
}

function textAnswer(answer: string, fallback: string): string { return answer.trim() || fallback; }
function numberAnswer(answer: string, fallback: number): number { const value = Number(answer.trim()); return Number.isFinite(value) && value >= 0 ? value : fallback; }
function yes(answer: string): boolean { return /^(y|yes|是)$/i.test(answer.trim()); }
function list(answer: string, upper = true): string[] { return [...new Set(answer.split(/[,，]/).map((item) => item.trim()).filter(Boolean).map((item) => upper ? item.toUpperCase() : item))]; }
