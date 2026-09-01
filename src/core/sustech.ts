import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type ProxyMode = "direct" | "inherit";

export async function runSustech(args: string[], options: { executable?: string; proxyMode?: ProxyMode } = {}): Promise<unknown> {
  const executable = options.executable ?? process.env.SUSTECH_BIN ?? "sustech";
  const proxyMode = options.proxyMode ?? proxyModeFromEnv(process.env);
  const commandArgs = [...args, "--json"];
  const isWindowsScript = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable);
  const command = isWindowsScript ? (process.env.ComSpec || "cmd.exe") : executable;
  const finalArgs = isWindowsScript ? ["/d", "/s", "/c", windowsCommandLine(executable, commandArgs)] : commandArgs;
  const { stdout } = await exec(command, finalArgs, {
    env: sustechChildEnv(process.env, proxyMode),
    maxBuffer: 16 * 1024 * 1024,
    windowsVerbatimArguments: isWindowsScript,
  });
  const envelope = JSON.parse(stdout) as { ok?: boolean; data?: unknown; error?: unknown };
  if (!envelope.ok) throw new Error(`sustech command failed: ${JSON.stringify(envelope.error)}`);
  return envelope.data;
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
