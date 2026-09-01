import type { ProxyMode } from "./sustech.js";

export type ExecutionMode = "live" | "cached" | "render-only";
export type CacheStatus = "written" | "fresh" | "stale" | "not-used";

export interface WorkflowStage {
  name: string;
  durationMs: number;
  retries: number;
}

export interface WorkflowReport {
  kind: "sustech-advisor-workflow-report";
  schemaVersion: "1";
  mode: ExecutionMode;
  startedAt: string;
  completedAt: string;
  totalWallClockMs: number;
  proxyMode: ProxyMode | "unused";
  sourceTimestamps: Record<string, string>;
  cache: {
    status: CacheStatus;
    capturedAt?: string;
    ageMs?: number;
    maxAgeMs?: number;
  };
  stages: WorkflowStage[];
}

export class WorkflowRecorder {
  readonly startedAt: string;
  readonly startedMs: number;
  readonly stages: WorkflowStage[] = [];
  readonly sourceTimestamps: Record<string, string> = {};
  private cache: WorkflowReport["cache"] = { status: "not-used" };

  constructor(readonly mode: ExecutionMode, readonly proxyMode: ProxyMode | "unused", private readonly now: () => number = Date.now) {
    this.startedMs = now();
    this.startedAt = new Date(this.startedMs).toISOString();
  }

  async stage<T>(name: string, operation: (retry: () => void) => Promise<T>): Promise<T> {
    const started = this.now();
    let retries = 0;
    try {
      return await operation(() => { retries += 1; });
    } finally {
      this.stages.push({ name, durationMs: Math.max(0, this.now() - started), retries });
    }
  }

  source(name: string, timestamp = new Date(this.now()).toISOString()): void {
    this.sourceTimestamps[name] = timestamp;
  }

  cacheStatus(value: WorkflowReport["cache"]): void {
    this.cache = value;
  }

  report(): WorkflowReport {
    const completedMs = this.now();
    return {
      kind: "sustech-advisor-workflow-report",
      schemaVersion: "1",
      mode: this.mode,
      startedAt: this.startedAt,
      completedAt: new Date(completedMs).toISOString(),
      totalWallClockMs: Math.max(0, completedMs - this.startedMs),
      proxyMode: this.proxyMode,
      sourceTimestamps: { ...this.sourceTimestamps },
      cache: { ...this.cache },
      stages: this.stages.map((stage) => ({ ...stage })),
    };
  }
}

export function cacheFreshness(capturedAt: string, maxAgeMs: number, nowMs = Date.now()): WorkflowReport["cache"] {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) throw new Error("Cache capturedAt must be a valid ISO timestamp.");
  const ageMs = Math.max(0, nowMs - capturedMs);
  return { status: ageMs <= maxAgeMs ? "fresh" : "stale", capturedAt, ageMs, maxAgeMs };
}
