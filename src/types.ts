export type Strategy = "high-load" | "high-grading" | "interest";
export type ProgramKind = "main-program" | "minor-program";
export type CreditClassification = ProgramKind | "unresolved";

export interface CreditTarget {
  min: number;
  target: number;
  max: number;
}

export interface ScheduleSlot {
  weeks: number[];
  day: number;
  dayName: string;
  periodStart: number;
  periodEnd: number;
  room: string;
}

export interface CourseSection {
  code: string;
  name: string;
  sectionName: string;
  classGroup: string;
  rwh: string;
  id?: string;
  college: string;
  category: string;
  nature: string;
  campus: string;
  credits: number;
  capacity?: number;
  enrolled?: number;
  teachers: string[];
  schedule: ScheduleSlot[];
}

export interface CurriculumCourseRule {
  code: string;
  name?: string;
  required: boolean;
  module: string;
  recommendedSemester?: string;
  credits?: number;
  completed?: boolean;
  sourcePage: number;
  confidence: "verified" | "needs-review";
  program: ProgramKind;
}

export interface AdvisorProfile {
  kind: "sustech-advisor-profile";
  schemaVersion: "2";
  identity: { cohort: number; major: string; track?: string };
  curriculum: {
    title: string;
    sourceUrl?: string;
    sha256?: string;
    confirmed: boolean;
    courses: CurriculumCourseRule[];
    manualReview: string[];
  };
  preferences: {
    creditTargets: {
      mainProgram: CreditTarget;
      minorProgram?: CreditTarget;
    };
    blocked: Array<{ day: number; periodStart: number; periodEnd: number }>;
    mustInclude: string[];
    exclude: string[];
    interests: string[];
    preferredTeams: string[][];
    avoidedTeams: string[][];
  };
  refreshedAt?: string;
}

export interface NcesCourseEvidence {
  code: string;
  semester: string;
  teacher: string;
  grading: { pct: number; label: string };
  rating: number;
  reviewCount: number;
  directUrl?: string;
}

export type TeamMatch = "exact-team" | "partial-team" | "course-only" | "none";

export interface TeachingTeamEvidence {
  tisTeamNames: string[];
  ncesTeamNames: string[];
  teamMatch: TeamMatch;
  roleAttribution: "known" | "mixed-or-unknown";
  gradingAttribution: "section-team" | "course-history" | "personal" | "unavailable";
  confidence: number;
  gradingScore?: number;
  reviewCount: number;
  sourceUrl?: string;
  warnings: string[];
}

export interface RecommendedPlan {
  strategy: Strategy;
  sections: CourseSection[];
  totalCredits: number;
  confirmedCredits: number;
  mainProgramCredits: number;
  minorProgramCredits: number;
  unresolvedCredits: number;
  creditClassification: Record<string, CreditClassification>;
  requirementCoverage: string[];
  reasons: Record<string, string[]>;
  evidence: Record<string, TeachingTeamEvidence>;
  warnings: string[];
}

export interface AdvisorResult {
  kind: "sustech-advisor-result";
  schemaVersion: "2";
  semester: string;
  round?: string;
  weekOneMonday?: string;
  generatedAt: string;
  strategies: RecommendedPlan[];
  sourceStatuses: Record<string, { ok: boolean; message?: string }>;
}
