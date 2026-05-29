// Farroway Compliance Runtime — Contracts
// Pure runtime: no React, no fetch, no localStorage writes.

export const COMPLIANCE_RUNTIME_VERSION = "farroway-compliance-runtime-v1";
export const VERSION = COMPLIANCE_RUNTIME_VERSION;

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

export type RetentionCategory =
  | "audit_logs"
  | "scan_photos"
  | "artifacts"
  | "reports"
  | "user_profiles"
  | "diagnostics"
  | "buyer_interests"
  | "organization_records";

export const RETENTION_CATEGORIES: ReadonlyArray<RetentionCategory> = Object.freeze([
  "audit_logs",
  "scan_photos",
  "artifacts",
  "reports",
  "user_profiles",
  "diagnostics",
  "buyer_interests",
  "organization_records",
] as const);

export { _isObj, _arr, _str, _safe };
