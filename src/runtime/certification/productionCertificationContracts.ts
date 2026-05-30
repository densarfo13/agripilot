// Farroway Production Certification — Contracts
// Pure runtime constants. No React, no fetch, no localStorage writes.

export const PRODUCTION_CERTIFICATION_VERSION =
  "farroway-production-certification-v1";

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

void _isObj;
void _arr;
void _str;
void _safe;

export const VERDICTS = Object.freeze(["GREEN", "YELLOW", "RED"] as const);
export type Verdict = (typeof VERDICTS)[number];

export const CERTIFICATION_TARGETS = Object.freeze({
  plants: 200,
  diseases: 15,
  pests: 15,
  scanSuccessRate: 0.9,
  brokenImages: 0,
  mediaFlower: 100,
  mediaVegetable: 50,
  mediaFruit: 50,
  mediaHerb: 50,
  mediaHouseplant: 50,
  mediaCrop: 50,
  mediaDisease: 100,
  mediaPest: 100,
} as const);

export const REQUIRED_QA_DEVICES = Object.freeze([
  "iphone_safari",
  "iphone_pwa_or_testflight",
  "android_chrome",
  "android_pwa",
] as const);

export const REQUIRED_PRIVACY_FIELDS = Object.freeze([
  "policyReady",
  "termsReady",
  "cameraDisclosureReady",
  "photoDisclosureReady",
  "locationDisclosureReady",
  "appStoreNutritionReady",
] as const);

export const REQUIRED_OPERATIONS = Object.freeze([
  "monitoringReady",
  "backupRestoreDocumented",
  "rollbackPlanReady",
] as const);

export const CERTIFICATION_STORAGE_KEY = "farroway_production_certification_v1";

export type CertificationTargets = typeof CERTIFICATION_TARGETS;
export type RequiredQADevice = (typeof REQUIRED_QA_DEVICES)[number];
export type RequiredPrivacyField = (typeof REQUIRED_PRIVACY_FIELDS)[number];
export type RequiredOperation = (typeof REQUIRED_OPERATIONS)[number];
