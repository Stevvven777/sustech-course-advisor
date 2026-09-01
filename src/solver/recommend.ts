import { attributeTeachingTeam } from "../nces/evidence.js";
import type { AdvisorProfile, AdvisorResult, CourseSection, NcesCourseEvidence, RecommendedPlan, ScheduleSlot, Strategy, TeachingTeamEvidence } from "../types.js";

export function recommendCourses(input: {
  profile: AdvisorProfile;
  semester: string;
  round?: string;
  catalog: CourseSection[];
  nces?: NcesCourseEvidence[];
  weekOneMonday?: string;
  generatedAt?: string;
}): AdvisorResult {
  if (!input.profile.curriculum.confirmed) throw new Error("The official curriculum framework must be confirmed before recommendation.");
  validateCredits(input.profile);
  const completed = new Set(input.profile.curriculum.courses.filter((course) => course.completed).map((course) => upper(course.code)));
  const excluded = new Set(input.profile.preferences.exclude.map(upper));
  const rules = new Map(input.profile.curriculum.courses.filter((course) => course.confidence === "verified").map((course) => [upper(course.code), course]));
  const must = new Set(input.profile.preferences.mustInclude.map(upper));
  const allowed = new Set([...rules.keys(), ...must]);
  const available = input.catalog.filter((section) =>
    allowed.has(upper(section.code))
    && !completed.has(upper(section.code))
    && !excluded.has(upper(section.code))
    && section.schedule.length > 0
    && !section.schedule.some((slot) => input.profile.preferences.blocked.some((blocked) => overlapsBlocked(slot, blocked))),
  );
  const evidence = new Map<CourseSection, TeachingTeamEvidence>();
  for (const section of available) {
    evidence.set(section, attributeTeachingTeam(section, input.nces ?? [], {
      preferredTeams: input.profile.preferences.preferredTeams,
      avoidedTeams: input.profile.preferences.avoidedTeams,
    }));
  }
  const strategies: Strategy[] = ["high-load", "high-grading", "interest"];
  return {
    kind: "sustech-advisor-result",
    schemaVersion: "1",
    semester: input.semester,
    ...(input.round ? { round: input.round } : {}),
    ...(input.weekOneMonday ? { weekOneMonday: input.weekOneMonday } : {}),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    strategies: strategies.map((strategy) => buildPlan(strategy, available, input.profile, rules, evidence)),
    sourceStatuses: {
      curriculumPdf: { ok: true },
      tisCatalog: { ok: true },
      nces: { ok: Boolean(input.nces?.length), ...(input.nces?.length ? {} : { message: "No NCES evidence was supplied." }) },
    },
  };
}

function buildPlan(
  strategy: Strategy,
  catalog: CourseSection[],
  profile: AdvisorProfile,
  rules: Map<string, AdvisorProfile["curriculum"]["courses"][number]>,
  evidence: Map<CourseSection, TeachingTeamEvidence>,
): RecommendedPlan {
  const byCode = new Map<string, CourseSection[]>();
  for (const section of catalog) {
    const code = upper(section.code);
    const sections = byCode.get(code) ?? [];
    sections.push(section);
    byCode.set(code, sections);
  }
  const must = new Set(profile.preferences.mustInclude.map(upper));
  const codes = [...byCode.keys()].sort((left, right) => compareCodes(left, right, strategy, profile, rules, byCode, evidence, must));
  const selected: CourseSection[] = [];
  const reasons: Record<string, string[]> = {};
  for (const code of codes) {
    const choices = [...(byCode.get(code) ?? [])].sort((left, right) => sectionScore(right, strategy, profile, rules.get(code), evidence) - sectionScore(left, strategy, profile, rules.get(code), evidence));
    const choice = choices.find((section) =>
      selected.every((existing) => !coursesConflict(existing, section))
      && totalCredits(selected) + section.credits <= profile.preferences.maxCredits,
    );
    if (!choice) continue;
    selected.push(choice);
    reasons[choice.rwh] = explain(choice, strategy, profile, rules.get(code), evidence.get(choice));
  }
  const missingMust = [...must].filter((code) => !selected.some((section) => upper(section.code) === code));
  const selectedCredits = totalCredits(selected);
  const confirmedCredits = totalCredits(selected.filter((section) => rules.has(upper(section.code))));
  const unresolvedCredits = Math.round((selectedCredits - confirmedCredits) * 100) / 100;
  const warnings = [
    ...(selectedCredits < profile.preferences.minCredits ? [`Only ${selectedCredits} credits could be placed, below the requested minimum.`] : []),
    ...(selectedCredits < profile.preferences.targetCredits ? [`Confirmed curriculum and explicitly requested candidates provide ${selectedCredits} credits, ${Math.round((profile.preferences.targetCredits - selectedCredits) * 100) / 100} below the target. Do not auto-fill with unresolved courses; ask the student how to handle the shortfall.`] : []),
    ...(unresolvedCredits > 0 ? [`${unresolvedCredits} credits come from explicitly requested courses whose curriculum membership is unresolved; do not count them as confirmed degree-credit coverage.`] : []),
    ...(missingMust.length ? [`Required-by-user courses not placed: ${missingMust.join(", ")}.`] : []),
  ];
  return {
    strategy,
    sections: selected,
    totalCredits: selectedCredits,
    confirmedCredits,
    unresolvedCredits,
    requirementCoverage: selected.map((section) => rules.get(upper(section.code))).filter(Boolean).map((rule) => `${rule!.module}: ${rule!.code}`),
    reasons,
    evidence: Object.fromEntries(selected.map((section) => [section.rwh, evidence.get(section)!])),
    warnings,
  };
}

function compareCodes(
  left: string,
  right: string,
  strategy: Strategy,
  profile: AdvisorProfile,
  rules: Map<string, AdvisorProfile["curriculum"]["courses"][number]>,
  byCode: Map<string, CourseSection[]>,
  evidence: Map<CourseSection, TeachingTeamEvidence>,
  must: Set<string>,
): number {
  const priority = (code: string): number => {
    const rule = rules.get(code);
    const sections = byCode.get(code) ?? [];
    let value = must.has(code) ? 1_000_000 : 0;
    value += rule?.required ? 100_000 : rule ? 20_000 : 0;
    if (strategy === "high-load") value += Math.max(...sections.map((section) => section.credits), 0) * 1_000;
    if (strategy === "high-grading") value += Math.max(...sections.map((section) => evidence.get(section)?.gradingScore ?? -1), -1) * 100;
    if (strategy === "interest") value += Math.max(...sections.map((section) => interestScore(section, profile.preferences.interests)), 0) * 1_000;
    return value;
  };
  return priority(right) - priority(left) || left.localeCompare(right);
}

function sectionScore(section: CourseSection, strategy: Strategy, profile: AdvisorProfile, rule: AdvisorProfile["curriculum"]["courses"][number] | undefined, evidence: Map<CourseSection, TeachingTeamEvidence>): number {
  const capacity = section.capacity && section.enrolled !== undefined ? Math.max(0, section.capacity - section.enrolled) : 0;
  if (strategy === "high-load") return section.credits * 100 + (rule?.required ? 50 : 0) - capacity / 100;
  if (strategy === "high-grading") {
    const item = evidence.get(section);
    return (item?.gradingScore ?? -100) * (item?.confidence ?? 0) + (rule?.required ? 5 : 0);
  }
  return interestScore(section, profile.preferences.interests) * 100 + (rule ? 10 : 0);
}

function interestScore(section: CourseSection, interests: string[]): number {
  const text = [section.code, section.name, section.college, section.category, section.nature].join(" ").toLocaleLowerCase("zh-Hans-CN");
  return interests.reduce((score, interest) => score + (text.includes(interest.trim().toLocaleLowerCase("zh-Hans-CN")) ? 1 : 0), 0);
}

function explain(section: CourseSection, strategy: Strategy, profile: AdvisorProfile, rule: AdvisorProfile["curriculum"]["courses"][number] | undefined, evidence?: TeachingTeamEvidence): string[] {
  const reasons = [rule ? `Matches official curriculum module “${rule.module}” (PDF p.${rule.sourcePage}).` : "Explicitly requested by the student; curriculum membership remains unresolved and is excluded from confirmed requirement coverage."];
  if (strategy === "high-load") reasons.push(`${section.credits} credits contribute to the high-load target of ${profile.preferences.targetCredits}.`);
  if (strategy === "high-grading") reasons.push(evidence?.gradingScore !== undefined ? `Exact-team NCES grading evidence: ${evidence.gradingScore}/100, confidence ${evidence.confidence}.` : "No attributable team-level NCES grading score; selected using remaining constraints.");
  if (strategy === "interest") reasons.push(`Interest matches: ${profile.preferences.interests.filter((interest) => interestScore(section, [interest]) > 0).join(", ") || "none explicit"}.`);
  return reasons;
}

export function coursesConflict(left: CourseSection, right: CourseSection): boolean {
  return left.schedule.some((a) => right.schedule.some((b) => slotsConflict(a, b)));
}

function slotsConflict(left: ScheduleSlot, right: ScheduleSlot): boolean {
  if (left.day !== right.day || left.periodEnd < right.periodStart || right.periodEnd < left.periodStart) return false;
  const weeks = new Set(right.weeks);
  return left.weeks.some((week) => weeks.has(week));
}

function overlapsBlocked(slot: ScheduleSlot, blocked: { day: number; periodStart: number; periodEnd: number }): boolean {
  return slot.day === blocked.day && slot.periodEnd >= blocked.periodStart && blocked.periodEnd >= slot.periodStart;
}

function totalCredits(sections: CourseSection[]): number {
  return Math.round(sections.reduce((sum, section) => sum + section.credits, 0) * 100) / 100;
}

function upper(value: string): string { return value.trim().toUpperCase(); }

function validateCredits(profile: AdvisorProfile): void {
  const { minCredits, targetCredits, maxCredits } = profile.preferences;
  if (!(minCredits >= 0 && minCredits <= targetCredits && targetCredits <= maxCredits && maxCredits <= 25)) {
    throw new Error("Main-program credit preferences must satisfy 0 <= min <= target <= max <= 25. Track minor-program credits separately.");
  }
}
