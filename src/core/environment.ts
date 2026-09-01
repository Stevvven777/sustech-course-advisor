import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { array, proxyModeFromEnv, record, runSustech } from "./sustech.js";

const MINIMUM_NODE = "20.18.0";

export const REQUIRED_CAPABILITIES = [
  "version",
  "capabilities",
  "consequences",
  "auth status",
  "auth check",
  "tis courses search",
  "tis courses available",
  "tis degree progress",
  "nces search",
  "tis selection preview",
  "curriculum sources",
  "curriculum fetch",
] as const;

export const REQUIRED_CONSEQUENCES = ["tis.enroll", "tis.cart.update", "curriculum.fetch"] as const;

type Runner = (args: string[]) => Promise<unknown>;

export interface EnvironmentOptions {
  profile?: string;
  live?: boolean;
  run?: Runner;
}

export async function inspectEnvironment(options: EnvironmentOptions = {}): Promise<Record<string, unknown>> {
  const runner = options.run ?? ((args) => runSustech(args));
  const profile = options.profile?.trim() || "default";
  const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const packageData = await readProjectPackage(projectRoot);
  const manifestOk = packageData.name === "sustech-course-advisor" && typeof packageData.version === "string";
  const buildPresent = await exists(resolve(projectRoot, "dist/cli.js"));
  const runtimeDependenciesAvailable = await canLoadRuntimeDependencies();
  const runtimeOk = versionAtLeast(process.versions.node, MINIMUM_NODE);
  const executable = process.env.SUSTECH_BIN?.trim() || "sustech";
  const proxyMode = proxyModeFromEnv(process.env);

  let version: Record<string, unknown> = {};
  let capabilities: Record<string, unknown> = {};
  let consequences: Record<string, unknown> = {};
  let auth: Record<string, unknown> = {};
  const installationErrors: string[] = [];
  const authenticationErrors: string[] = [];

  for (const [name, args, assign, errorTarget] of [
    ["version", ["version"], (value: unknown) => { version = record(value); }, installationErrors],
    ["capabilities", ["capabilities"], (value: unknown) => { capabilities = record(value); }, installationErrors],
    ["consequences", ["consequences"], (value: unknown) => { consequences = record(value); }, installationErrors],
    ["auth status", ["auth", "status", "--profile", profile], (value: unknown) => { auth = record(value); }, authenticationErrors],
  ] as const) {
    try { assign(await runner([...args])); }
    catch (error) { errorTarget.push(`${name}: ${message(error)}`); }
  }

  const availableCapabilities = new Set(array<Record<string, unknown>>(capabilities.capabilities).map((item) => String(item.command)));
  const availableConsequences = new Set(array<Record<string, unknown>>(consequences.consequences).map((item) => String(item.operation)));
  const missingCapabilities = REQUIRED_CAPABILITIES.filter((name) => !availableCapabilities.has(name));
  const missingConsequences = REQUIRED_CONSEQUENCES.filter((name) => !availableConsequences.has(name));
  const credentialAvailable = auth.credentialAvailable === true;
  const backendAvailable = auth.backendAvailable === true;

  let liveAuthentication: Record<string, unknown> = { requested: options.live === true, status: "not-requested" };
  if (options.live) {
    if (!credentialAvailable) liveAuthentication = { requested: true, status: "skipped", reason: "No credential source is available for this profile." };
    else {
      try {
        await runner(["auth", "check", "--service", "tis", "--profile", profile]);
        liveAuthentication = { requested: true, status: "passed" };
      } catch (error) {
        const code = message(error);
        liveAuthentication = { requested: true, status: "failed", error: code };
        authenticationErrors.push(`auth check: ${code}`);
      }
    }
  }

  const liveOk = !options.live || liveAuthentication.status === "passed";
  const errors = [...installationErrors, ...authenticationErrors];
  const installationReady = runtimeOk && manifestOk && buildPresent && runtimeDependenciesAvailable && installationErrors.length === 0
    && missingCapabilities.length === 0 && missingConsequences.length === 0;
  const authenticationReady = authenticationErrors.length === 0 && credentialAvailable && backendAvailable && liveOk;
  const ok = installationReady && authenticationReady;
  const remediation: string[] = [];
  if (!runtimeOk) remediation.push(`Use Node.js ${MINIMUM_NODE} or newer.`);
  if (!manifestOk) remediation.push(`Use a complete sustech-course-advisor checkout or installation; package.json is missing or does not identify the advisor.`);
  if (!buildPresent) remediation.push(`Build the advisor project at ${projectRoot} with npm run build.`);
  if (!runtimeDependenciesAvailable) remediation.push(`Install the advisor runtime dependencies at ${projectRoot} before planning or exporting.`);
  if (installationErrors.length || missingCapabilities.length || missingConsequences.length) remediation.push("Install or select a compatible sustech CLI, then rerun doctor.");
  if (!backendAvailable) remediation.push("Use an available supported credential source for sustech.");
  if (!credentialAvailable) remediation.push(`Run sustech auth login --profile ${profile} --service tis in an interactive terminal; never put the password in chat or command arguments.`);
  if (options.live && liveAuthentication.status === "failed") remediation.push("Resolve the reported TIS authentication or network issue; do not repeatedly retry an interactive CAS challenge.");

  return {
    ok,
    installationReady,
    authenticationReady,
    readyForPersonalizedPlanning: ok,
    project: {
      root: projectRoot,
      packageVersion: packageData.version,
      nodeRequirement: packageData.engines?.node,
      manifestOk,
      buildPresent,
      runtimeDependenciesAvailable,
    },
    runtime: { node: process.version, minimumNode: MINIMUM_NODE, ok: runtimeOk },
    sustech: {
      executable,
      available: Object.keys(version).length > 0,
      version: version.version,
      runtime: version.runtime,
      missingCapabilities,
      missingConsequences,
    },
    network: {
      proxyMode,
      defaultProxyMode: "direct",
      switch: "SUSTECH_ADVISOR_PROXY_MODE=direct|inherit",
    },
    authentication: {
      profile,
      configured: auth.configured === true,
      credentialAvailable,
      maskedSid: auth.maskedSid,
      backend: auth.backend,
      backendAvailable,
      persistent: auth.persistent === true,
      reason: auth.reason,
      live: liveAuthentication,
    },
    errors,
    installationErrors,
    authenticationErrors,
    remediation,
  };
}

export function versionAtLeast(actual: string, minimum: string): boolean {
  const current = actual.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(current.length, required.length); index++) {
    const difference = (current[index] ?? 0) - (required[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

async function readProjectPackage(projectRoot: string): Promise<{ name?: string; version?: string; engines?: { node?: string } }> {
  try { return JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8")) as { name?: string; version?: string; engines?: { node?: string } }; }
  catch { return {}; }
}

async function canLoadRuntimeDependencies(): Promise<boolean> {
  try { await import("exceljs"); return true; }
  catch { return false; }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch { return false; }
}

function message(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) return String(error.code).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "UNKNOWN_ERROR";
  return "UNKNOWN_ERROR";
}
