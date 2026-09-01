import { normalizeCatalogRows } from "./catalog.js";
import { array, record, runSustech, SustechCommandError, type ProxyMode } from "./sustech.js";
import { recommendCourses } from "../solver/recommend.js";
import type { AdvisorProfile, AdvisorResult, CourseSection, NcesCourseEvidence } from "../types.js";

export interface RecommendationSources {
  catalog: CourseSection[];
  nces: NcesCourseEvidence[];
  sourceStatuses: Record<string, { ok: boolean; message?: string }>;
}

export interface LiveSourceOptions {
  semester: string;
  round?: string;
  totalTimeoutMs: number;
  maxRetries: number;
  proxyMode: ProxyMode;
  onRetry?: () => void;
  onSource?: (name: string, timestamp: string) => void;
  run?: (args: string[], options: { proxyMode: ProxyMode; timeoutMs: number }) => Promise<unknown>;
  now?: () => number;
}

export async function fetchLiveRecommendationSources(profile: AdvisorProfile, options: LiveSourceOptions): Promise<RecommendationSources> {
  if (!Number.isSafeInteger(options.totalTimeoutMs) || options.totalTimeoutMs < 1) throw new Error("totalTimeoutMs must be a positive integer.");
  if (!Number.isSafeInteger(options.maxRetries) || options.maxRetries < 0 || options.maxRetries > 2) throw new Error("maxRetries must be an integer from 0 to 2.");
  const now = options.now ?? Date.now;
  const deadline = now() + options.totalTimeoutMs;
  const runner = options.run ?? ((args, commandOptions) => runSustech(args, commandOptions));
  const usefulCodes = candidateCodes(profile);
  const requestedCodes = [...usefulCodes].slice(0, 80);
  const catalogRows: unknown[] = [];
  let catalogFailureCount = 0;

  for (let index = 0; index < requestedCodes.length; index += 1) {
    const code = requestedCodes[index];
    if (remainingBudget(deadline, now) <= 0) {
      catalogFailureCount += requestedCodes.length - index;
      break;
    }
    try {
      const data = record(await runBoundedRead(options.round
        ? ["tis", "courses", "available", code, "--semester", options.semester, "--round", options.round, "--limit", "100"]
        : ["tis", "courses", "search", code, "--semester", options.semester, "--limit", "100"],
      { ...options, deadline, runner, now }));
      catalogRows.push(...array<unknown>(data.courses));
    } catch { catalogFailureCount += 1; }
  }
  const catalogTimestamp = new Date(now()).toISOString();
  options.onSource?.("tisCatalog", catalogTimestamp);
  const normalizedCatalog = normalizeCatalogRows(catalogRows);
  const catalog = normalizedCatalog.sections;
  const evidenceCodes = [...new Set(catalog.map((course) => course.code.toUpperCase()).filter((code) => usefulCodes.size === 0 || usefulCodes.has(code)))].slice(0, 80);
  const nces: NcesCourseEvidence[] = [];
  let ncesFailureCount = 0;
  for (let index = 0; index < evidenceCodes.length; index += 1) {
    const code = evidenceCodes[index];
    if (remainingBudget(deadline, now) <= 0) {
      ncesFailureCount += evidenceCodes.length - index;
      break;
    }
    try {
      const data = record(await runBoundedRead(["nces", "search", code], { ...options, deadline, runner, now }));
      nces.push(...array<NcesCourseEvidence>(data.items));
    } catch { ncesFailureCount += 1; }
  }
  const ncesTimestamp = new Date(now()).toISOString();
  options.onSource?.("nces", ncesTimestamp);

  const sourceStatuses: RecommendationSources["sourceStatuses"] = {};
  const catalogWarnings: string[] = [];
  if (!requestedCodes.length) catalogWarnings.push("No verified curriculum or explicitly requested candidate codes were available; broad catalog retrieval was not attempted.");
  else if (catalogFailureCount > 0 || usefulCodes.size > requestedCodes.length) catalogWarnings.push(`${catalogFailureCount} of ${requestedCodes.length} targeted catalog lookups failed${usefulCodes.size > requestedCodes.length ? "; candidate list was limited to 80 codes" : ""}.`);
  if (normalizedCatalog.ambiguousCodes.length || normalizedCatalog.rejectedRows) {
    const details = [
      ...(normalizedCatalog.ambiguousCodes.length ? [`ambiguous course/component identities: ${normalizedCatalog.ambiguousCodes.join(", ")}`] : []),
      ...(normalizedCatalog.rejectedRows ? [`${normalizedCatalog.rejectedRows} malformed rows rejected`] : []),
    ].join("; ");
    catalogWarnings.push(`Catalog normalized conservatively; ${details}. Excluded records were not guessed or bundled.`);
  }
  if (catalogWarnings.length) sourceStatuses.tisCatalog = { ok: false, message: catalogWarnings.join(" ") };
  else sourceStatuses.tisCatalog = { ok: true };
  if (ncesFailureCount > 0) sourceStatuses.nces = { ok: false, message: `${ncesFailureCount} of ${evidenceCodes.length} NCES lookups failed; affected courses have no NCES evidence.` };
  else sourceStatuses.nces = { ok: true };
  return { catalog, nces, sourceStatuses };
}

export function buildRecommendation(input: {
  profile: AdvisorProfile;
  semester: string;
  round?: string;
  weekOneMonday?: string;
  sources: RecommendationSources;
  generatedAt?: string;
}): AdvisorResult {
  const result = recommendCourses({
    profile: input.profile,
    semester: input.semester,
    ...(input.round ? { round: input.round } : {}),
    ...(input.weekOneMonday ? { weekOneMonday: input.weekOneMonday } : {}),
    catalog: input.sources.catalog,
    nces: input.sources.nces,
    ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}),
  });
  result.sourceStatuses = { ...result.sourceStatuses, ...input.sources.sourceStatuses };
  const catalogMessage = input.sources.sourceStatuses.tisCatalog?.message;
  if (catalogMessage) for (const plan of result.strategies) plan.warnings.push(`TIS catalog containment: ${catalogMessage}`);
  return result;
}

function candidateCodes(profile: AdvisorProfile): Set<string> {
  return new Set([
    ...profile.curriculum.courses.map((course) => course.code.trim().toUpperCase()),
    ...profile.preferences.mustInclude.map((code) => code.trim().toUpperCase()),
  ].filter(Boolean));
}

async function runBoundedRead(
  args: string[],
  options: LiveSourceOptions & {
    deadline: number;
    runner: NonNullable<LiveSourceOptions["run"]>;
    now: () => number;
  },
): Promise<unknown> {
  let attempt = 0;
  while (true) {
    const remaining = remainingBudget(options.deadline, options.now);
    if (remaining <= 0) throw new SustechCommandError("launch", "WORKFLOW_TIMEOUT");
    try {
      return await options.runner(args, { proxyMode: options.proxyMode, timeoutMs: Math.max(1, Math.min(15_000, remaining)) });
    } catch (error) {
      if (attempt >= options.maxRetries || !isRetryableReadError(error) || remainingBudget(options.deadline, options.now) <= 0) throw error;
      attempt += 1;
      options.onRetry?.();
    }
  }
}

function isRetryableReadError(error: unknown): boolean {
  if (!(error instanceof SustechCommandError)) return false;
  return new Set(["COMMAND_TIMEOUT", "NETWORK_TIMEOUT", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"]).has(error.code);
}

function remainingBudget(deadline: number, now: () => number): number {
  return Math.max(0, deadline - now());
}
