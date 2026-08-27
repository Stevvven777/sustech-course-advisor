import type { CourseSection, NcesCourseEvidence, TeachingTeamEvidence } from "../types.js";

export function normaliseTeam(names: readonly string[]): string[] {
  return [...new Set(names.flatMap((name) => name.split(/[,，、;/]/)).map((name) => name.replace(/\s+/g, "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

export function attributeTeachingTeam(
  section: CourseSection,
  candidates: readonly NcesCourseEvidence[],
  personal: { preferredTeams?: string[][]; avoidedTeams?: string[][] } = {},
): TeachingTeamEvidence {
  const tis = normaliseTeam(section.teachers);
  const preferred = (personal.preferredTeams ?? []).some((team) => teamsEqual(tis, normaliseTeam(team)));
  const avoided = (personal.avoidedTeams ?? []).some((team) => teamsEqual(tis, normaliseTeam(team)));
  if (preferred || avoided) {
    return {
      tisTeamNames: tis,
      ncesTeamNames: [],
      teamMatch: "none",
      roleAttribution: "mixed-or-unknown",
      gradingAttribution: "personal",
      confidence: 1,
      gradingScore: preferred ? 100 : 0,
      reviewCount: 0,
      warnings: [preferred ? "Student-provided preference for this complete teaching team." : "Student-provided avoidance for this complete teaching team."],
    };
  }

  const matchingCode = candidates.filter((entry) => entry.code.trim().toUpperCase() === section.code.trim().toUpperCase());
  const exact = matchingCode.find((entry) => teamsEqual(tis, normaliseTeam([entry.teacher])));
  if (exact) return fromNces(tis, exact, "exact-team");

  const partial = matchingCode.find((entry) => intersects(tis, normaliseTeam([entry.teacher])));
  if (partial) {
    const evidence = fromNces(tis, partial, "partial-team");
    return {
      ...evidence,
      gradingAttribution: "unavailable",
      confidence: 0,
      gradingScore: undefined,
      warnings: [...evidence.warnings, "NCES and TIS teaching teams overlap only partially; the rating is not assigned to any individual."],
    };
  }
  const courseOnly = matchingCode.sort((left, right) => right.reviewCount - left.reviewCount)[0];
  if (courseOnly) {
    return {
      ...fromNces(tis, courseOnly, "course-only"),
      gradingAttribution: "course-history",
      confidence: Math.min(0.25, confidenceForReviews(courseOnly.reviewCount) * 0.25),
      gradingScore: undefined,
      warnings: ["Only course-level history is available; it is not attributed to this teaching team."],
    };
  }
  return {
    tisTeamNames: tis,
    ncesTeamNames: [],
    teamMatch: "none",
    roleAttribution: "mixed-or-unknown",
    gradingAttribution: "unavailable",
    confidence: 0,
    reviewCount: 0,
    warnings: ["No NCES evidence could be reliably matched."],
  };
}

function fromNces(tis: string[], entry: NcesCourseEvidence, match: TeachingTeamEvidence["teamMatch"]): TeachingTeamEvidence {
  const nces = normaliseTeam([entry.teacher]);
  return {
    tisTeamNames: tis,
    ncesTeamNames: nces,
    teamMatch: match,
    roleAttribution: "mixed-or-unknown",
    gradingAttribution: match === "exact-team" ? "section-team" : "unavailable",
    confidence: match === "exact-team" ? confidenceForReviews(entry.reviewCount) : 0,
    ...(match === "exact-team" ? { gradingScore: entry.grading.pct } : {}),
    reviewCount: entry.reviewCount,
    ...(entry.directUrl ? { sourceUrl: entry.directUrl } : {}),
    warnings: tis.length > 1 ? ["Upstream data does not distinguish instructors from teaching assistants; the score belongs to the full team."] : [],
  };
}

function confidenceForReviews(count: number): number {
  return Math.round(Math.min(1, Math.log2(Math.max(1, count) + 1) / 5) * 100) / 100;
}

function teamsEqual(left: string[], right: string[]): boolean {
  return left.length > 0 && left.length === right.length && left.every((name, index) => name === right[index]);
}

function intersects(left: string[], right: string[]): boolean {
  const names = new Set(right);
  return left.some((name) => names.has(name));
}
