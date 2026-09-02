import { spawn, type ChildProcess } from "node:child_process";

export const DEFAULT_SUSTECH_COMMAND_TIMEOUT_MS = 10_000;
const FORCE_KILL_GRACE_MS = 250;
const MAX_COMMAND_OUTPUT_BYTES = 16 * 1024 * 1024;

export type ProxyMode = "direct" | "inherit";

export class SustechCommandError extends Error {
  readonly code: string;
  readonly stage: "launch" | "response";

  constructor(stage: "launch" | "response", code: string) {
    super(`sustech command failed during ${stage} (${code}).`);
    this.name = "SustechCommandError";
    this.stage = stage;
    this.code = code;
  }
}

export interface SustechCommandOptions {
  executable?: string;
  proxyMode?: ProxyMode;
  timeoutMs?: number;
}

export async function runSustech(args: string[], options: SustechCommandOptions = {}): Promise<unknown> {
  const executable = options.executable ?? process.env.SUSTECH_BIN ?? "sustech";
  const proxyMode = options.proxyMode ?? proxyModeFromEnv(process.env);
  const timeoutMs = options.timeoutMs ?? DEFAULT_SUSTECH_COMMAND_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("SUSTECH command timeout must be a positive integer.");
  const commandArgs = [...args, "--json"];
  const isWindowsScript = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable);
  const command = isWindowsScript ? (process.env.ComSpec || "cmd.exe") : executable;
  const finalArgs = isWindowsScript ? ["/d", "/s", "/c", windowsCommandLine(executable, commandArgs)] : commandArgs;
  let stdout: string;
  try {
    stdout = await spawnBounded(command, finalArgs, timeoutMs, {
      env: sustechChildEnv(process.env, proxyMode),
      windowsVerbatimArguments: isWindowsScript,
    });
  } catch (error) {
    throw new SustechCommandError("launch", processErrorCode(error, true));
  }
  let envelope: { ok?: boolean; data?: unknown; error?: unknown };
  try { envelope = JSON.parse(stdout) as { ok?: boolean; data?: unknown; error?: unknown }; }
  catch { throw new SustechCommandError("response", "INVALID_JSON"); }
  if (!envelope.ok) throw new SustechCommandError("response", upstreamErrorCode(envelope.error));
  return envelope.data;
}

function spawnBounded(
  command: string,
  args: string[],
  timeoutMs: number,
  options: { env: NodeJS.ProcessEnv; windowsVerbatimArguments: boolean },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let outputBytes = 0;
    let forceKill: NodeJS.Timeout | undefined;
    let settled = false;
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const fail = (error: Error & { code?: unknown; killed?: boolean }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      forceKill = beginProcessTreeTermination(child);
      reject(error);
    };
    const collect = (chunk: string, retain: boolean): void => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_COMMAND_OUTPUT_BYTES) {
        fail(Object.assign(new Error("SUSTECH command output exceeded its buffer limit."), { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" }));
      } else if (retain) stdout += chunk;
    };
    child.stdout.on("data", (chunk: string) => collect(chunk, true));
    child.stderr.on("data", (chunk: string) => collect(chunk, false));
    child.once("error", (error) => fail(error));
    child.once("close", (code, signal) => {
      if (forceKill) clearTimeout(forceKill);
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (code === 0) resolve(stdout);
      else reject(Object.assign(new Error(`SUSTECH command exited with status ${code ?? "unknown"}.`), { code, signal, killed: child.killed }));
    });

    const deadline = setTimeout(() => {
      fail(Object.assign(new Error("SUSTECH command exceeded its execution deadline."), {
        code: "COMMAND_TIMEOUT",
        killed: true,
      }));
    }, timeoutMs);
  });
}

function beginProcessTreeTermination(child: ChildProcess): NodeJS.Timeout | undefined {
  terminateProcessTree(child, false);
  if (process.platform === "win32") return undefined;
  return setTimeout(() => terminateProcessTree(child, true), FORCE_KILL_GRACE_MS);
}

function terminateProcessTree(child: ChildProcess, force: boolean): void {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    if (force) return;
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.unref();
    return;
  }
  const signal = force ? "SIGKILL" : "SIGTERM";
  try { process.kill(-pid, signal); }
  catch {
    try { child.kill(signal); } catch { /* process already exited */ }
  }
}

function windowsCommandLine(executable: string, args: string[]): string {
  const values = [executable, ...args];
  if (values.some((value) => /[\0\r\n]/.test(value))) throw new Error("SUSTECH command arguments cannot contain control characters.");
  const quoted = values.map((value) => `"${value.replaceAll('"', '""')}"`).join(" ");
  return `"${quoted}"`;
}

export function proxyModeFromEnv(source: NodeJS.ProcessEnv): ProxyMode {
  const value = source.SUSTECH_ADVISOR_PROXY_MODE?.trim().toLowerCase();
  if (!value || value === "direct") return "direct";
  if (value === "inherit") return "inherit";
  throw new Error("SUSTECH_ADVISOR_PROXY_MODE must be direct or inherit.");
}

export function sustechChildEnv(source: NodeJS.ProcessEnv, proxyMode: ProxyMode = "direct"): NodeJS.ProcessEnv {
  const env = { ...source };
  if (proxyMode === "inherit") return env;
  const proxyKeys = new Set([
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NODE_USE_ENV_PROXY",
    "NPM_CONFIG_PROXY",
    "NPM_CONFIG_HTTPS_PROXY",
  ]);
  for (const key of Object.keys(env)) {
    if (proxyKeys.has(key.toUpperCase())) delete env[key];
  }
  env.NO_PROXY = "*";
  env.no_proxy = "*";
  return env;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function array<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }

function upstreamErrorCode(value: unknown): string {
  const item = record(value);
  const code = typeof item.code === "string" ? item.code : "UPSTREAM_ERROR";
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : "UPSTREAM_ERROR";
}

function processErrorCode(error: unknown, timeoutEnabled = false): string {
  if (timeoutEnabled && error && typeof error === "object" && "killed" in error && error.killed === true) return "COMMAND_TIMEOUT";
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === null || error.code === undefined) return "PROCESS_ERROR";
    const code = String(error.code).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (code) return code.slice(0, 64);
  }
  return "PROCESS_ERROR";
}
