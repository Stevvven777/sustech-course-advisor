import { homedir } from "node:os";
import { mkdir, open, readdir, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { writeJsonExclusive } from "./store.js";

export interface DiagnosticReport {
  kind: "sustech-advisor-diagnostic";
  schemaVersion: "1";
  generatedAt: string;
  system: { platform: NodeJS.Platform; arch: string; node: string };
  readiness: { installation: boolean; authentication: boolean; personalizedPlanning: boolean };
  advisor: { packageVersion?: string; manifest: boolean; build: boolean; dependencies: boolean };
  sustech: { available: boolean; version?: string; missingCapabilities: string[]; missingConsequences: string[] };
  network: { proxyMode: string };
  credentialStore: { available: boolean; credentialAvailable: boolean; backend?: string; liveStatus?: string };
  failures: { count: number; codes: string[] };
}

export interface SupportBundle {
  kind: "sustech-advisor-support-bundle";
  schemaVersion: "1";
  files: Array<{ name: "diagnostic.json"; content: DiagnosticReport }>;
  privacy: { rawPayloads: false; credentials: false; studentIdentifiers: false; grades: false; absoluteUserPaths: false };
}

export function createDiagnosticReport(environment: Record<string, unknown>, generatedAt = new Date().toISOString()): DiagnosticReport {
  const project = object(environment.project);
  const sustech = object(environment.sustech);
  const network = object(environment.network);
  const authentication = object(environment.authentication);
  const live = object(authentication.live);
  const errors = strings(environment.errors);
  return {
    kind: "sustech-advisor-diagnostic",
    schemaVersion: "1",
    generatedAt,
    system: { platform: process.platform, arch: process.arch, node: process.version },
    readiness: {
      installation: environment.installationReady === true,
      authentication: environment.authenticationReady === true,
      personalizedPlanning: environment.readyForPersonalizedPlanning === true,
    },
    advisor: {
      ...(typeof project.packageVersion === "string" ? { packageVersion: project.packageVersion } : {}),
      manifest: project.manifestOk === true,
      build: project.buildPresent === true,
      dependencies: project.runtimeDependenciesAvailable === true,
    },
    sustech: {
      available: sustech.available === true,
      ...(typeof sustech.version === "string" ? { version: sustech.version } : {}),
      missingCapabilities: strings(sustech.missingCapabilities),
      missingConsequences: strings(sustech.missingConsequences),
    },
    network: { proxyMode: typeof network.proxyMode === "string" ? network.proxyMode : "unknown" },
    credentialStore: {
      available: authentication.backendAvailable === true,
      credentialAvailable: authentication.credentialAvailable === true,
      ...(typeof authentication.backend === "string" ? { backend: authentication.backend } : {}),
      ...(typeof live.status === "string" ? { liveStatus: live.status } : {}),
    },
    failures: { count: errors.length, codes: errors.map(errorCode) },
  };
}

export async function writeRollingDiagnostic(report: DiagnosticReport, options: { directory?: string; keep?: number } = {}): Promise<string> {
  const directory = resolve(options.directory ?? diagnosticDataDirectory());
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `diagnostic-${report.generatedAt.replace(/[:.]/g, "-")}.json`;
  const target = join(directory, filename);
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, "utf8"); }
  finally { await handle.close(); }
  const entries = (await readdir(directory)).filter((name) => /^diagnostic-.*\.json$/.test(name)).sort().reverse();
  for (const old of entries.slice(Math.max(1, options.keep ?? 10))) await unlink(join(directory, old));
  return target;
}

export async function writeSupportBundle(path: string, report: DiagnosticReport, overwrite = false): Promise<{ path: string; files: string[] }> {
  assertDiagnosticSafe(report);
  const bundle: SupportBundle = {
    kind: "sustech-advisor-support-bundle",
    schemaVersion: "1",
    files: [{ name: "diagnostic.json", content: report }],
    privacy: { rawPayloads: false, credentials: false, studentIdentifiers: false, grades: false, absoluteUserPaths: false },
  };
  return { path: basename(await writeJsonExclusive(path, bundle, overwrite)), files: bundle.files.map((file) => file.name) };
}

export function assertDiagnosticSafe(report: DiagnosticReport): void {
  const serialized = JSON.stringify(report);
  const forbidden = [homedir(), "password", "cookie", "accessToken", "refreshToken", "maskedSid", "grades", "rawPayload"];
  if (forbidden.some((value) => value && serialized.toLowerCase().includes(value.toLowerCase()))) {
    throw new Error("Diagnostic privacy scan failed; replace unsafe data with a synthetic fixture.");
  }
}

export function diagnosticDataDirectory(): string {
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "sustech-course-advisor", "debug");
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA || process.env.APPDATA || homedir(), "sustech-course-advisor", "debug");
  return join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "sustech-course-advisor", "debug");
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function errorCode(value: string): string {
  const suffix = value.includes(":") ? value.slice(value.indexOf(":") + 1) : value;
  return suffix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 64) || "UNKNOWN_ERROR";
}
