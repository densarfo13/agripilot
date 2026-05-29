// Farroway Compliance Runtime — DataRetentionPolicy
// Pure: deterministic helpers over the frozen RETENTION_POLICY config.
// No clock side-effects: callers supply nowIso for testability.

import { RETENTION_POLICY } from "../../config/retentionPolicy";
import {
  RETENTION_CATEGORIES,
  type RetentionCategory,
} from "./complianceContracts";

export const VERSION = "farroway-data-retention-policy-v1";

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

const MS_PER_DAY = 86_400_000;

const _knownCategory = (c: unknown): c is RetentionCategory =>
  typeof c === "string" &&
  (RETENTION_CATEGORIES as ReadonlyArray<string>).includes(c);

/**
 * daysRetained — returns the policy days for a category, or -1 if never
 * auto-expires, or -1 if the category is unknown (safe default: keep).
 */
export function daysRetained(category: RetentionCategory | string): number {
  return _safe(() => {
    if (!_knownCategory(category)) return -1;
    const v = (RETENTION_POLICY as Record<string, number>)[category];
    return typeof v === "number" ? v : -1;
  }, -1);
}

export interface RetentionRecord {
  readonly id?: string;
  readonly createdAt?: string;
  // No PII fields — callers must not pass phone/email/fullName/exact GPS/etc.
  readonly [k: string]: unknown;
}

/**
 * markExpiredCandidates — pure. Returns the subset of records whose createdAt
 * exceeds the retention window for the given category. Caller-supplied nowIso
 * keeps this deterministic. Records missing or with malformed createdAt are
 * never marked expired (safe default: keep).
 */
export function markExpiredCandidates(
  records: ReadonlyArray<RetentionRecord> | unknown,
  category: RetentionCategory | string,
  nowIso?: string
): ReadonlyArray<RetentionRecord> {
  return _safe(() => {
    const list = _arr<RetentionRecord>(records);
    if (list.length === 0) return Object.freeze([]) as ReadonlyArray<RetentionRecord>;

    const days = daysRetained(category);
    if (days < 0) return Object.freeze([]) as ReadonlyArray<RetentionRecord>;

    const nowStr = _str(nowIso);
    const nowMs = nowStr
      ? _safe(() => {
          const t = Date.parse(nowStr);
          return Number.isFinite(t) ? t : NaN;
        }, NaN)
      : NaN;
    if (!Number.isFinite(nowMs)) {
      return Object.freeze([]) as ReadonlyArray<RetentionRecord>;
    }

    const cutoffMs = (nowMs as number) - days * MS_PER_DAY;

    const expired: RetentionRecord[] = [];
    for (const r of list) {
      if (!_isObj(r)) continue;
      const created = _str((r as Record<string, unknown>).createdAt);
      if (!created) continue;
      const t = _safe(() => Date.parse(created), NaN);
      if (!Number.isFinite(t)) continue;
      if ((t as number) < cutoffMs) expired.push(r);
    }
    return Object.freeze(expired) as ReadonlyArray<RetentionRecord>;
  }, Object.freeze([]) as ReadonlyArray<RetentionRecord>);
}

export interface RetentionCategorySnapshotEntry {
  readonly category: RetentionCategory;
  readonly days: number;
  readonly autoDeleteEnabled: false;
}

export interface RetentionPolicySnapshot {
  readonly version: string;
  readonly autoDeleteEnabled: false;
  readonly categories: ReadonlyArray<RetentionCategorySnapshotEntry>;
  readonly emptyState: "Not enough data yet";
}

/**
 * retentionPolicySnapshot — frozen envelope listing all 8 categories with
 * their retention days. autoDeleteEnabled is always false in this surface.
 */
export function retentionPolicySnapshot(): RetentionPolicySnapshot {
  return _safe(
    () => {
      const categories = RETENTION_CATEGORIES.map((c) =>
        Object.freeze({
          category: c,
          days: daysRetained(c),
          autoDeleteEnabled: false as const,
        })
      );
      return Object.freeze({
        version: VERSION,
        autoDeleteEnabled: false as const,
        categories: Object.freeze(categories),
        emptyState: "Not enough data yet" as const,
      });
    },
    Object.freeze({
      version: VERSION,
      autoDeleteEnabled: false as const,
      categories: Object.freeze([] as ReadonlyArray<RetentionCategorySnapshotEntry>),
      emptyState: "Not enough data yet" as const,
    })
  );
}
