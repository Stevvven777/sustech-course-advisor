import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function runSustech(args: string[], options: { executable?: string } = {}): Promise<unknown> {
  const { stdout } = await exec(options.executable ?? process.env.SUSTECH_BIN ?? "sustech", [...args, "--json"], { maxBuffer: 16 * 1024 * 1024 });
  const envelope = JSON.parse(stdout) as { ok?: boolean; data?: unknown; error?: unknown };
  if (!envelope.ok) throw new Error(`sustech command failed: ${JSON.stringify(envelope.error)}`);
  return envelope.data;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function array<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
