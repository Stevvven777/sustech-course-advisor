import { coursesConflict } from "./recommend.js";
import type { AdvisorResult, CourseSection, RecommendedPlan } from "../types.js";

export interface PlanAudit {
  strategy: RecommendedPlan["strategy"];
  ok: boolean;
  courseCount: number;
  totalCredits: number;
  reportedCredits: number;
  confirmedCredits: number;
  unresolvedCredits: number;
  daysUsed: number[];
  hasEarlyPeriods: boolean;
  fridayMeetingCount: number;
  conflicts: Array<{ left: string; right: string }>;
  duplicateCourseCodes: string[];
  missingTeachingTeams: string[];
  missingMeetings: string[];
  creditErrors: string[];
}

export interface ResultAudit {
  ok: boolean;
  semester: string;
  plans: PlanAudit[];
}

export function auditAdvisorResult(result: AdvisorResult): ResultAudit {
  const plans = result.strategies.map(auditPlan);
  return { ok: plans.every((plan) => plan.ok), semester: result.semester, plans };
}

function auditPlan(plan: RecommendedPlan): PlanAudit {
  const byCode = new Map<string, CourseSection[]>();
  for (const section of plan.sections) {
    const code = normalize(section.code);
    byCode.set(code, [...(byCode.get(code) ?? []), section]);
  }
  const duplicateCourseCodes = [...byCode.entries()].filter(([, sections]) => sections.length > 1).map(([code]) => code);
  const totalCredits = round([...byCode.values()].reduce((sum, sections) => sum + sections[0].credits, 0));
  const conflicts: Array<{ left: string; right: string }> = [];
  for (let left = 0; left < plan.sections.length; left += 1) {
    for (let right = left + 1; right < plan.sections.length; right += 1) {
      if (coursesConflict(plan.sections[left], plan.sections[right])) {
        conflicts.push({ left: plan.sections[left].rwh, right: plan.sections[right].rwh });
      }
    }
  }
  const missingTeachingTeams = plan.sections.filter((section) => section.teachers.length === 0 || section.teachers.some((name) => !name.trim())).map((section) => section.rwh);
  const missingMeetings = plan.sections.filter((section) => section.schedule.length === 0).map((section) => section.rwh);
  const creditErrors = [
    ...(totalCredits !== round(plan.totalCredits) ? [`Reported total ${plan.totalCredits} does not match unique-course total ${totalCredits}.`] : []),
    ...(round(plan.confirmedCredits + plan.unresolvedCredits) !== round(plan.totalCredits) ? [`Confirmed ${plan.confirmedCredits} plus unresolved ${plan.unresolvedCredits} does not equal total ${plan.totalCredits}.`] : []),
  ];
  const meetings = plan.sections.flatMap((section) => section.schedule);
  const daysUsed = [...new Set(meetings.map((meeting) => meeting.day))].sort((a, b) => a - b);
  const ok = conflicts.length === 0 && duplicateCourseCodes.length === 0 && missingTeachingTeams.length === 0 && missingMeetings.length === 0 && creditErrors.length === 0;
  return {
    strategy: plan.strategy,
    ok,
    courseCount: byCode.size,
    totalCredits,
    reportedCredits: plan.totalCredits,
    confirmedCredits: plan.confirmedCredits,
    unresolvedCredits: plan.unresolvedCredits,
    daysUsed,
    hasEarlyPeriods: meetings.some((meeting) => meeting.periodStart <= 2),
    fridayMeetingCount: meetings.filter((meeting) => meeting.day === 5).length,
    conflicts,
    duplicateCourseCodes,
    missingTeachingTeams,
    missingMeetings,
    creditErrors,
  };
}

function normalize(value: string): string { return value.trim().toUpperCase(); }
function round(value: number): number { return Math.round(value * 100) / 100; }
