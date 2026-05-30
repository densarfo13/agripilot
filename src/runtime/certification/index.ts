// Farroway Production Certification — Barrel
// Pure runtime. No React.

export const FARROWAY_CERTIFICATION_BARREL_VERSION =
  "farroway-certification-barrel-v1";

export {
  PRODUCTION_CERTIFICATION_VERSION,
  VERDICTS,
  CERTIFICATION_TARGETS,
  REQUIRED_QA_DEVICES,
  REQUIRED_PRIVACY_FIELDS,
  REQUIRED_OPERATIONS,
  CERTIFICATION_STORAGE_KEY,
} from "./productionCertificationContracts";
export type {
  Verdict,
  CertificationTargets,
  RequiredQADevice,
  RequiredPrivacyField,
  RequiredOperation,
} from "./productionCertificationContracts";

export {
  MEDIA_URL_VALIDATOR_VERSION,
  validateMediaURLShape,
  validateMediaCatalog,
  mediaValidatorSnapshot,
} from "./MediaURLValidator";
export type {
  MediaURLShapeResult,
  MediaCatalogEntry,
  MediaCatalogValidationResult,
  MediaValidatorSnapshot,
} from "./MediaURLValidator";

export {
  PRODUCTION_CERTIFICATION_RUNTIME_VERSION,
  productionCertification,
  exportProductionCertificationReport,
  installProductionCertificationGlobal,
} from "./ProductionCertificationRuntime";
export type {
  CertificationQA,
  CertificationContent,
  CertificationPrivacy,
  CertificationOperations,
  ProductionCertificationEnvelope,
  ProductionCertificationReport,
} from "./ProductionCertificationRuntime";
