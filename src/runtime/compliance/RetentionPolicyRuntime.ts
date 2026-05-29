// Farroway Compliance Runtime — RetentionPolicyRuntime
// Composite surface + diagnostic global. SSR-safe.

import { RETENTION_CATEGORIES } from "./complianceContracts";
import {
  daysRetained,
  retentionPolicySnapshot,
  type RetentionPolicySnapshot,
} from "./DataRetentionPolicy";

export const VERSION = "farroway-retention-policy-runtime-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

export interface RetentionHealthEnvelope {
  readonly version: string;
  readonly policyReady: boolean;
  readonly categoriesReady: boolean;
  readonly expirationDetectionReady: boolean;
  readonly autoDeleteEnabled: false;
  readonly snapshot: RetentionPolicySnapshot;
  readonly emptyState: "Not enough data yet";
}

const _emptyHealth: RetentionHealthEnvelope = Object.freeze({
  version: VERSION,
  policyReady: false,
  categoriesReady: false,
  expirationDetectionReady: false,
  autoDeleteEnabled: false as const,
  snapshot: retentionPolicySnapshot(),
  emptyState: "Not enough data yet" as const,
});

export function retentionHealth(): RetentionHealthEnvelope {
  return _safe(() => {
    const snapshot = retentionPolicySnapshot();

    const categoriesReady =
      _arr(snapshot.categories).length === RETENTION_CATEGORIES.length;

    // policyReady: every category resolves to a finite number (including -1).
    const policyReady = RETENTION_CATEGORIES.every((c) => {
      const d = daysRetained(c);
      return typeof d === "number" && Number.isFinite(d);
    });

    // expirationDetectionReady: the deterministic helper is wired in.
    const expirationDetectionReady = policyReady && categoriesReady;

    return Object.freeze({
      version: VERSION,
      policyReady,
      categoriesReady,
      expirationDetectionReady,
      autoDeleteEnabled: false as const,
      snapshot,
      emptyState: "Not enough data yet" as const,
    });
  }, _emptyHealth);
}

declare global {
  // eslint-disable-next-line no-var
  var __retentionHealth: (() => RetentionHealthEnvelope) | undefined;
}

export function installRetentionPolicyGlobal(): void {
  _safe(() => {
    if (typeof window === "undefined") return;
    try {
      (window as unknown as Record<string, unknown>).__retentionHealth =
        retentionHealth;
    } catch {
      /* noop — read-only window in some test envs */
    }
  }, undefined as unknown as void);
}
