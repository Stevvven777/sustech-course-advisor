import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AdvisorProfile, AdvisorResult, CreditClassification, CreditTarget, CurriculumCourseRule, RecommendedPlan } from "../types.js";

export async function loadProfile(path: string): Promise<AdvisorProfile> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>;
  if (value.kind !== "sustech-advisor-profile") throw new Error("Unsupported advisor profile schema.");
  if (value.schemaVersion === "2") return value as unknown as AdvisorProfile;
  if (value.schemaVersion === "1") return migrateProfileV1(value);
  throw new Error("Unsupported advisor profile schema.");
}

export async function loadResult(path: string): Promise<AdvisorResult> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>;
  if (value.kind !== "sustech-advisor-result") throw new Error("Unsupported advisor result schema.");
  if (value.schemaVersion === "2") return value as unknown as AdvisorResult;
  if (value.schemaVersion === "1") return migrateResultV1(value);
  throw new Error("Unsupported advisor result schema.");
}

function migrateProfileV1(value: Record<string, unknown>): AdvisorProfile {
  const profile = value as unknown as {
    identity: AdvisorProfile["identity"];
    curriculum: Omit<AdvisorProfile["curriculum"], "courses"> & { courses: Array<Omit<CurriculumCourseRule, "program">> };
    preferences: Omit<AdvisorProfile["preferences"], "creditTargets"> & { minCredits: number; targetCredits: number; maxCredits: number };
    refreshedAt?: string;
  };
  const mainProgram: CreditTarget = {
    min: profile.preferences.minCredits,
    target: profile.preferences.targetCredits,
    max: profile.preferences.maxCredits,
  };
  return {
    kind: "sustech-advisor-profile",
    schemaVersion: "2",
    identity: profile.identity,
    curriculum: {
      ...profile.curriculum,
      courses: profile.curriculum.courses.map((course) => ({ ...course, program: "main-program" })),
    },
    preferences: {
      creditTargets: { mainProgram },
      blocked: profile.preferences.blocked,
      mustInclude: profile.preferences.mustInclude,
      exclude: profile.preferences.exclude,
      interests: profile.preferences.interests,
      preferredTeams: profile.preferences.preferredTeams,
      avoidedTeams: profile.preferences.avoidedTeams,
    },
    ...(profile.refreshedAt ? { refreshedAt: profile.refreshedAt } : {}),
  };
}

function migrateResultV1(value: Record<string, unknown>): AdvisorResult {
  const result = value as unknown as Omit<AdvisorResult, "schemaVersion" | "strategies"> & {
    strategies: Array<Omit<RecommendedPlan, "mainProgramCredits" | "minorProgramCredits" | "creditClassification">>;
  };
  return {
    ...result,
    schemaVersion: "2",
    strategies: result.strategies.map((plan) => {
      const confirmedCodes = new Set(plan.requirementCoverage.map((entry) => entry.split(":").at(-1)?.trim().toUpperCase()).filter(Boolean));
      const creditClassification: Record<string, CreditClassification> = Object.fromEntries(plan.sections.map((section) => {
        const classification: CreditClassification = confirmedCodes.has(section.code.trim().toUpperCase()) ? "main-program" : "unresolved";
        return [section.rwh, classification];
      }));
      return {
        ...plan,
        mainProgramCredits: plan.confirmedCredits,
        minorProgramCredits: 0,
        creditClassification,
      };
    }),
  };
}

export async function writeJsonExclusive(path: string, value: unknown, overwrite = false): Promise<string> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  try {
    const stats = await lstat(target);
    if (!stats.isFile() || !overwrite) throw new Error(`Destination already exists: ${target}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8"); } finally { await handle.close(); }
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return target;
}
