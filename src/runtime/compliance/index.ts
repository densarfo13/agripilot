// Farroway Compliance Runtime — barrel.

export const VERSION = "farroway-compliance-index-v1";

export {
  COMPLIANCE_RUNTIME_VERSION,
  RETENTION_CATEGORIES,
  type RetentionCategory,
} from "./complianceContracts";

export {
  daysRetained,
  markExpiredCandidates,
  retentionPolicySnapshot,
  type RetentionRecord,
  type RetentionPolicySnapshot,
  type RetentionCategorySnapshotEntry,
} from "./DataRetentionPolicy";

export {
  retentionHealth,
  installRetentionPolicyGlobal,
  type RetentionHealthEnvelope,
} from "./RetentionPolicyRuntime";
