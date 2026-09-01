import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeCatalogRows } from "./catalog.js";
import { record } from "./sustech.js";
import { writeJsonExclusive } from "./store.js";
import type { CourseSection, NcesCourseEvidence } from "../types.js";

export interface AdvisorSourceCache {
  kind: "sustech-advisor-source-cache";
  schemaVersion: "1";
  semester: string;
  round?: string;
  capturedAt: string;
  sourceTimestamps: Record<string, string>;
  catalog: CourseSection[];
  nces: NcesCourseEvidence[];
  sourceStatuses: Record<string, { ok: boolean; message?: string }>;
}

const FORBIDDEN_CACHE_KEYS = new Set(["password", "cookie", "token", "accesstoken", "refreshtoken", "sid", "studentid", "profile", "studentprofile", "identity", "rawpayload"]);
const SOURCE_NAMES = new Set(["tisCatalog", "nces"]);

export function createSourceCache(input: {
  semester: string;
  round?: string;
  capturedAt: string;
  sourceTimestamps: Record<string, string>;
  catalog: CourseSection[];
  nces: NcesCourseEvidence[];
  sourceStatuses: Record<string, { ok: boolean; message?: string }>;
}): AdvisorSourceCache {
  const normalized = normalizeCatalogRows(input.catalog);
  if (normalized.ambiguousCodes.length || normalized.rejectedRows) throw new Error("Refusing to cache ambiguous or malformed catalog rows.");
  const value: AdvisorSourceCache = {
    kind: "sustech-advisor-source-cache",
    schemaVersion: "1",
    semester: input.semester,
    ...(input.round ? { round: input.round } : {}),
    capturedAt: validTimestamp(input.capturedAt, "capturedAt"),
    sourceTimestamps: projectSourceTimestamps(input.sourceTimestamps),
    catalog: normalized.sections,
    nces: input.nces.map(projectNces).filter((item): item is NcesCourseEvidence => item !== undefined),
    sourceStatuses: projectSourceStatuses(input.sourceStatuses),
  };
  assertSourceCacheSafe(value);
  return value;
}

export async function loadSourceCache(path: string): Promise<AdvisorSourceCache> {
  const raw = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  const value = record(raw);
  if (value.kind !== "sustech-advisor-source-cache" || value.schemaVersion !== "1") throw new Error("Unsupported advisor source cache schema.");
  const semester = typeof value.semester === "string" && value.semester.trim() ? value.semester.trim() : undefined;
  if (!semester) throw new Error("Source cache semester is missing.");
  const sourceTimestamps = record(value.sourceTimestamps);
  return createSourceCache({
    semester,
    ...(typeof value.round === "string" && value.round.trim() ? { round: value.round.trim() } : {}),
    capturedAt: typeof value.capturedAt === "string" ? value.capturedAt : "",
    sourceTimestamps: Object.fromEntries(Object.entries(sourceTimestamps).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    catalog: Array.isArray(value.catalog) ? value.catalog as CourseSection[] : [],
    nces: Array.isArray(value.nces) ? value.nces as NcesCourseEvidence[] : [],
    sourceStatuses: projectSourceStatuses(record(value.sourceStatuses)),
  });
}

export async function writeSourceCache(path: string, cache: AdvisorSourceCache, overwrite = false): Promise<string> {
  assertSourceCacheSafe(cache);
  return writeJsonExclusive(path, cache, overwrite);
}

export function assertSourceCacheSafe(value: unknown, key = ""): void {
  if (key && FORBIDDEN_CACHE_KEYS.has(normalizeKey(key))) throw new Error(`Unsafe key is not allowed in source cache: ${key}`);
  if (Array.isArray(value)) {
    for (const item of value) assertSourceCacheSafe(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) assertSourceCacheSafe(child, childKey);
  }
}

function projectNces(value: unknown): NcesCourseEvidence | undefined {
  const item = record(value);
  const grading = record(item.grading);
  if (![item.code, item.semester, item.teacher, grading.label].every((field) => typeof field === "string")) return undefined;
  if (![grading.pct, item.rating, item.reviewCount].every((field) => typeof field === "number" && Number.isFinite(field))) return undefined;
  const directUrl = safePublicUrl(item.directUrl);
  return {
    code: String(item.code), semester: String(item.semester), teacher: String(item.teacher),
    grading: { pct: Number(grading.pct), label: String(grading.label) },
    rating: Number(item.rating), reviewCount: Number(item.reviewCount),
    ...(directUrl ? { directUrl } : {}),
  };
}

function projectSourceStatuses(value: unknown): Record<string, { ok: boolean; message?: string }> {
  const statuses = record(value);
  return Object.fromEntries(Object.entries(statuses).flatMap(([name, raw]) => {
    if (!SOURCE_NAMES.has(name)) return [];
    const status = record(raw);
    if (typeof status.ok !== "boolean") return [];
    return [[name, { ok: status.ok, ...(typeof status.message === "string" ? { message: status.message } : {}) }]];
  }));
}

function projectSourceTimestamps(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([name, timestamp]) => SOURCE_NAMES.has(name)
    ? [[name, validTimestamp(timestamp, `source timestamp ${name}`)]]
    : []));
}

function safePublicUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) return undefined;
    for (const key of url.searchParams.keys()) if (FORBIDDEN_CACHE_KEYS.has(normalizeKey(key))) return undefined;
    return url.toString();
  } catch { return undefined; }
}

function normalizeKey(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function validTimestamp(value: string, name: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error(`Source cache ${name} must be a valid ISO timestamp.`);
  return new Date(Date.parse(value)).toISOString();
}
