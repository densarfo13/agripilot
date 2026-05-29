// src/runtime/organization/onboarding/CSVImportEngine.ts
// Farroway bulk onboarding CSV parser + normalizer + validator.
// Pure runtime: no React, no fetch, no localStorage, no external libs.
// Returns FROZEN envelopes. _safe wraps all fallible operations.

import {
  REQUIRED_CSV_COLUMNS,
  OPTIONAL_CSV_COLUMNS,
} from "./onboardingContracts";
import { AGE_RANGES, GENDERS } from "../../admin/adminImpactContracts";

export const CSV_IMPORT_ENGINE_VERSION = "farroway-csv-import-engine-v1";

// ---------------------------------------------------------------------------
// Standard helper trio
// ---------------------------------------------------------------------------
const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParseCSVResult {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  readonly ok: boolean;
  readonly reason: string;
}

export interface NormalizedRow {
  readonly first_name: string;
  readonly last_name: string;
  readonly phone: string;
  readonly email: string;
  readonly ageRange: string;
  readonly gender: string;
  readonly country: string;
  readonly region: string;
  readonly district: string;
  readonly village: string;
  readonly farmSize: string;
  readonly primaryCrops: ReadonlyArray<string>;
  readonly programName: string;
  readonly cohortName: string;
  readonly fieldOfficerEmail: string;
  readonly consentForProgramReporting: boolean | null;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
}

export interface CSVImportEngineSnapshot {
  readonly runtimeVersion: string;
  readonly scope: "organizationId";
  readonly parserReady: true;
  readonly normalizerReady: true;
  readonly validatorReady: true;
}

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------

/**
 * Pure CSV parser. Supports:
 *  - quoted cells: "hello, world"
 *  - escaped quotes inside quoted cells: ""double""
 *  - CRLF and LF line endings
 *  - trailing newline (ignored)
 * Returns a frozen envelope; never throws.
 */
export function parseCSV(text: unknown): ParseCSVResult {
  return _safe<ParseCSVResult>(
    () => {
      const src = _str(text);
      if (src.length === 0) {
        return Object.freeze({
          rows: Object.freeze([] as ReadonlyArray<ReadonlyArray<string>>),
          ok: false,
          reason: "empty_input",
        });
      }

      const rows: Array<ReadonlyArray<string>> = [];
      let cell = "";
      let row: string[] = [];
      let inQuotes = false;
      let i = 0;
      const n = src.length;

      while (i < n) {
        const ch = src.charCodeAt(i);

        if (inQuotes) {
          if (ch === 34 /* " */) {
            if (i + 1 < n && src.charCodeAt(i + 1) === 34) {
              // escaped quote
              cell += '"';
              i += 2;
              continue;
            }
            inQuotes = false;
            i += 1;
            continue;
          }
          cell += src[i];
          i += 1;
          continue;
        }

        if (ch === 34 /* " */) {
          inQuotes = true;
          i += 1;
          continue;
        }
        if (ch === 44 /* , */) {
          row.push(cell);
          cell = "";
          i += 1;
          continue;
        }
        if (ch === 13 /* \r */) {
          // CRLF or lone CR
          if (i + 1 < n && src.charCodeAt(i + 1) === 10) {
            i += 2;
          } else {
            i += 1;
          }
          row.push(cell);
          rows.push(Object.freeze(row.slice()));
          cell = "";
          row = [];
          continue;
        }
        if (ch === 10 /* \n */) {
          row.push(cell);
          rows.push(Object.freeze(row.slice()));
          cell = "";
          row = [];
          i += 1;
          continue;
        }

        cell += src[i];
        i += 1;
      }

      // Flush the final cell / row if any content present.
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(Object.freeze(row.slice()));
      }

      if (inQuotes) {
        return Object.freeze({
          rows: Object.freeze([] as ReadonlyArray<ReadonlyArray<string>>),
          ok: false,
          reason: "unterminated_quote",
        });
      }

      return Object.freeze({
        rows: Object.freeze(rows),
        ok: true,
        reason: "ok",
      });
    },
    Object.freeze({
      rows: Object.freeze([] as ReadonlyArray<ReadonlyArray<string>>),
      ok: false,
      reason: "parse_error",
    }),
  );
}

// ---------------------------------------------------------------------------
// normalizeHeader / normalizeRow
// ---------------------------------------------------------------------------

/** Lowercases, trims, and converts spaces / dashes to underscores. */
export function normalizeHeader(name: unknown): string {
  return _safe(() => {
    const s = _str(name).trim().toLowerCase();
    return s.replace(/[\s\-]+/g, "_");
  }, "");
}

/** Recognised CSV header names → camelCase runtime field. */
const HEADER_TO_FIELD: Readonly<Record<string, keyof NormalizedRow>> = Object.freeze({
  first_name: "first_name",
  last_name: "last_name",
  phone: "phone",
  email: "email",
  age_range: "ageRange",
  gender: "gender",
  country: "country",
  region: "region",
  district: "district",
  village: "village",
  farm_size: "farmSize",
  // primary_crop + secondary_crop both fold into primaryCrops
  primary_crop: "primaryCrops",
  secondary_crop: "primaryCrops",
  program: "programName",
  cohort: "cohortName",
  field_officer_email: "fieldOfficerEmail",
  consent_for_program_reporting: "consentForProgramReporting",
});

const EMPTY_NORMALIZED: NormalizedRow = Object.freeze({
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  ageRange: "",
  gender: "",
  country: "",
  region: "",
  district: "",
  village: "",
  farmSize: "",
  primaryCrops: Object.freeze([] as ReadonlyArray<string>),
  programName: "",
  cohortName: "",
  fieldOfficerEmail: "",
  consentForProgramReporting: null,
});

function _parseConsent(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return null;
  if (v === "true" || v === "yes" || v === "1") return true;
  if (v === "false" || v === "no" || v === "0") return false;
  return null;
}

function _normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  // Keep a single leading '+' if present, then digits only.
  const hasPlus = trimmed.charAt(0) === "+";
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalises a parsed row against a header array.
 * Returns a frozen NormalizedRow. Unknown headers are ignored silently
 * (the engine never throws on extra columns).
 */
export function normalizeRow(
  headers: ReadonlyArray<unknown>,
  row: ReadonlyArray<unknown>,
): NormalizedRow {
  return _safe<NormalizedRow>(() => {
    const acc: {
      first_name: string;
      last_name: string;
      phone: string;
      email: string;
      ageRange: string;
      gender: string;
      country: string;
      region: string;
      district: string;
      village: string;
      farmSize: string;
      primaryCrops: string[];
      programName: string;
      cohortName: string;
      fieldOfficerEmail: string;
      consentForProgramReporting: boolean | null;
    } = {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      ageRange: "",
      gender: "",
      country: "",
      region: "",
      district: "",
      village: "",
      farmSize: "",
      primaryCrops: [],
      programName: "",
      cohortName: "",
      fieldOfficerEmail: "",
      consentForProgramReporting: null,
    };

    const hdrs = _arr<unknown>(headers);
    const cells = _arr<unknown>(row);
    const len = Math.min(hdrs.length, cells.length);

    for (let i = 0; i < len; i += 1) {
      const headerKey = normalizeHeader(hdrs[i]);
      if (headerKey === "") continue;
      const field = HEADER_TO_FIELD[headerKey];
      if (!field) continue;
      const rawCell = _str(cells[i]).trim();

      switch (field) {
        case "phone":
          acc.phone = _normalizePhone(rawCell);
          break;
        case "email":
          acc.email = rawCell.toLowerCase();
          break;
        case "fieldOfficerEmail":
          acc.fieldOfficerEmail = rawCell.toLowerCase();
          break;
        case "ageRange":
          acc.ageRange = rawCell.toLowerCase();
          break;
        case "gender":
          acc.gender = rawCell.toLowerCase();
          break;
        case "primaryCrops":
          if (rawCell !== "") {
            // Allow comma-separated within a single cell too.
            const parts = rawCell
              .split(",")
              .map((p) => p.trim())
              .filter((p) => p.length > 0);
            for (const p of parts) {
              if (!acc.primaryCrops.includes(p)) acc.primaryCrops.push(p);
            }
          }
          break;
        case "consentForProgramReporting":
          acc.consentForProgramReporting = _parseConsent(rawCell);
          break;
        case "first_name":
          acc.first_name = rawCell;
          break;
        case "last_name":
          acc.last_name = rawCell;
          break;
        case "country":
          acc.country = rawCell;
          break;
        case "region":
          acc.region = rawCell;
          break;
        case "district":
          acc.district = rawCell;
          break;
        case "village":
          acc.village = rawCell;
          break;
        case "farmSize":
          acc.farmSize = rawCell;
          break;
        case "programName":
          acc.programName = rawCell;
          break;
        case "cohortName":
          acc.cohortName = rawCell;
          break;
        default:
          // exhaustive — switch covers all keyof NormalizedRow
          break;
      }
    }

    return Object.freeze({
      first_name: acc.first_name,
      last_name: acc.last_name,
      phone: acc.phone,
      email: acc.email,
      ageRange: acc.ageRange,
      gender: acc.gender,
      country: acc.country,
      region: acc.region,
      district: acc.district,
      village: acc.village,
      farmSize: acc.farmSize,
      primaryCrops: Object.freeze(acc.primaryCrops.slice()),
      programName: acc.programName,
      cohortName: acc.cohortName,
      fieldOfficerEmail: acc.fieldOfficerEmail,
      consentForProgramReporting: acc.consentForProgramReporting,
    });
  }, EMPTY_NORMALIZED);
}

// ---------------------------------------------------------------------------
// validateRow
// ---------------------------------------------------------------------------

const _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a normalized row. Returns frozen { valid, errors[] }.
 * Required: first_name + last_name + (phone OR email).
 * Enums: ageRange (admin AGE_RANGES), gender (admin GENDERS) — when present.
 * Phone: must look like digits (already normalized) with optional leading '+'.
 * Email: must match a permissive `x@y.z` shape.
 * Consent: already coerced to boolean | null by normalizeRow.
 */
export function validateRow(normalized: unknown): ValidationResult {
  return _safe<ValidationResult>(() => {
    if (!_isObj(normalized)) {
      return Object.freeze({
        valid: false,
        errors: Object.freeze(["row_not_object"]),
      });
    }
    const r = normalized as NormalizedRow;
    const errors: string[] = [];

    // Required columns
    for (const key of REQUIRED_CSV_COLUMNS.required) {
      const v = _str((r as unknown as Record<string, unknown>)[key]);
      if (v.trim() === "") errors.push(`missing_${key}`);
    }

    // requiredEither: phone OR email
    const hasPhone = _str(r.phone).trim() !== "";
    const hasEmail = _str(r.email).trim() !== "";
    if (!hasPhone && !hasEmail) {
      errors.push("missing_contact_phone_or_email");
    }

    // Phone format (when present): leading '+' optional + digits only,
    // 6–20 chars after the optional plus.
    if (hasPhone) {
      const p = _str(r.phone);
      const body = p.charAt(0) === "+" ? p.slice(1) : p;
      if (!/^\d{6,20}$/.test(body)) errors.push("invalid_phone");
    }

    // Email format (when present)
    if (hasEmail) {
      if (!_EMAIL_RE.test(_str(r.email))) errors.push("invalid_email");
    }

    // Field officer email (when present)
    const foe = _str(r.fieldOfficerEmail);
    if (foe !== "" && !_EMAIL_RE.test(foe)) {
      errors.push("invalid_field_officer_email");
    }

    // Age range enum
    const age = _str(r.ageRange);
    if (age !== "" && !(AGE_RANGES as ReadonlyArray<string>).includes(age)) {
      errors.push("invalid_age_range");
    }

    // Gender enum
    const gender = _str(r.gender);
    if (gender !== "" && !(GENDERS as ReadonlyArray<string>).includes(gender)) {
      errors.push("invalid_gender");
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors.slice()),
    });
  }, Object.freeze({ valid: false, errors: Object.freeze(["validate_error"]) }));
}

// ---------------------------------------------------------------------------
// Engine snapshot (diagnostic)
// ---------------------------------------------------------------------------

export function csvImportEngineSnapshot(): CSVImportEngineSnapshot {
  return Object.freeze({
    runtimeVersion: CSV_IMPORT_ENGINE_VERSION,
    scope: "organizationId" as const,
    parserReady: true as const,
    normalizerReady: true as const,
    validatorReady: true as const,
  });
}

// Re-export the recognized column lists for callers that want to render a
// "supported columns" UI without re-importing the contracts module.
export const RECOGNIZED_COLUMNS = Object.freeze({
  required: REQUIRED_CSV_COLUMNS.required,
  requiredEither: REQUIRED_CSV_COLUMNS.requiredEither,
  optional: OPTIONAL_CSV_COLUMNS,
});
