import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AdvisorProfile, AdvisorResult } from "../types.js";

export async function loadProfile(path: string): Promise<AdvisorProfile> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as AdvisorProfile;
  if (value.kind !== "sustech-advisor-profile" || value.schemaVersion !== "1") throw new Error("Unsupported advisor profile schema.");
  return value;
}

export async function loadResult(path: string): Promise<AdvisorResult> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as AdvisorResult;
  if (value.kind !== "sustech-advisor-result" || value.schemaVersion !== "1") throw new Error("Unsupported advisor result schema.");
  return value;
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
