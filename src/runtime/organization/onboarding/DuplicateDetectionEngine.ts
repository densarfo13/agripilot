/**
 * src/runtime/organization/onboarding/DuplicateDetectionEngine.ts
 *
 *   Pure duplicate-detection rules for bulk-onboarding batch rows.
 *   Compares normalized batch rows against the canonical
 *   FarmerProfile registry passed in by the caller — the engine
 *   itself NEVER reaches into the registry directly so it stays
 *   pure and SSR-safe.
 *
 *   Hard duplicate  → same phone OR same email (case-insensitive
 *                     trim). Returned with kind: "hard".
 *   Soft duplicate  → same firstName + lastName + village; OR
 *                     same firstName + lastName + district +
 *                     primary-crop overlap. Returned with
 *                     kind: "soft".
 *
 *   The engine returns a frozen array — the caller decides what
 *   to do (block import, hold for human review, etc.). Auto-merge
 *   is OFF by design.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes. No fetch. No React.
 *   • No phone / email surfaced — only the rule fingerprint.
 */

export const DUPLICATE_DETECTION_VERSION =
  'duplicate-detection-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _norm(s: unknown): string {
  return _safe(() => _str(s).trim().toLowerCase(), '');
}

function _normPhone(s: unknown): string {
  return _safe(() => {
    const raw = _str(s).trim();
    if (!raw) return '';
    // strip any non-digit / non-plus character; keep leading +
    let cleaned = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charAt(i);
      if (ch >= '0' && ch <= '9') cleaned += ch;
      else if (ch === '+' && cleaned.length === 0) cleaned += ch;
    }
    return cleaned;
  }, '');
}

function _normEmail(s: unknown): string {
  return _norm(s);
}

function _cropSet(v: unknown): Set<string> {
  const out = new Set<string>();
  for (const c of _arr(v)) {
    const n = _norm(c);
    if (n) out.add(n);
  }
  return out;
}

function _cropOverlap(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const v of a) if (b.has(v)) return true;
  return false;
}

export interface DuplicateRowInput {
  rowNumber?:    number;
  phone?:        string;
  email?:        string;
  firstName?:    string;
  lastName?:     string;
  village?:      string;
  district?:     string;
  primaryCrops?: ReadonlyArray<string>;
  primaryCrop?:  string;
}

export interface ExistingFarmerInput {
  id?:           string;
  userId?:       string;
  phone?:        string;
  email?:        string;
  firstName?:    string;
  lastName?:     string;
  village?:      string;
  district?:     string;
  primaryCrops?: ReadonlyArray<string>;
}

export interface DuplicateMatch {
  rowNumber:     number;
  kind:          'hard' | 'soft';
  reason:        string;
  matchedUserId: string;
}

interface DetectArgs {
  rows?:            ReadonlyArray<DuplicateRowInput>;
  existingFarmers?: ReadonlyArray<ExistingFarmerInput>;
}

/**
 * Run the rule cascade. Returns a frozen array — empty when
 * nothing matches. The caller decides what to do with matches.
 */
export function detectDuplicates(ctx: DetectArgs)
    : ReadonlyArray<DuplicateMatch> {
  return _safe(() => {
    if (!_isObj(ctx)) return Object.freeze([] as DuplicateMatch[]);
    const rows      = _arr(ctx.rows) as DuplicateRowInput[];
    const existing  = _arr(ctx.existingFarmers) as ExistingFarmerInput[];
    if (rows.length === 0 || existing.length === 0) {
      return Object.freeze([] as DuplicateMatch[]);
    }

    // Index the existing pool once.
    const byPhone = new Map<string, ExistingFarmerInput>();
    const byEmail = new Map<string, ExistingFarmerInput>();
    interface SoftRec {
      farmer:    ExistingFarmerInput;
      firstName: string;
      lastName:  string;
      village:   string;
      district:  string;
      crops:     Set<string>;
    }
    const softIndex: SoftRec[] = [];

    for (const f of existing) {
      if (!_isObj(f)) continue;
      const ph = _normPhone((f as any).phone);
      const em = _normEmail((f as any).email);
      if (ph) byPhone.set(ph, f);
      if (em) byEmail.set(em, f);
      const firstName = _norm((f as any).firstName);
      const lastName  = _norm((f as any).lastName);
      if (firstName && lastName) {
        softIndex.push(Object.freeze({
          farmer:    f,
          firstName,
          lastName,
          village:   _norm((f as any).village),
          district:  _norm((f as any).district),
          crops:     _cropSet((f as any).primaryCrops),
        }));
      }
    }

    const out: DuplicateMatch[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!_isObj(r)) continue;
      const rowNumber = typeof (r as any).rowNumber === 'number'
        ? (r as any).rowNumber as number
        : i + 1;

      // ── Hard rules first — bail on the first hard hit per row.
      const ph = _normPhone(r.phone);
      if (ph && byPhone.has(ph)) {
        const m = byPhone.get(ph) as ExistingFarmerInput;
        out.push(Object.freeze({
          rowNumber,
          kind:          'hard',
          reason:        'phone_match',
          matchedUserId: _str(m.userId) || _str(m.id),
        }));
        continue;
      }
      const em = _normEmail(r.email);
      if (em && byEmail.has(em)) {
        const m = byEmail.get(em) as ExistingFarmerInput;
        out.push(Object.freeze({
          rowNumber,
          kind:          'hard',
          reason:        'email_match',
          matchedUserId: _str(m.userId) || _str(m.id),
        }));
        continue;
      }

      // ── Soft rules — pick the first matching soft signal.
      const rFirst = _norm(r.firstName);
      const rLast  = _norm(r.lastName);
      if (!rFirst || !rLast) continue;
      const rVillage  = _norm(r.village);
      const rDistrict = _norm(r.district);
      const rCrops    = _cropSet(_arr(r.primaryCrops).length > 0
        ? r.primaryCrops
        : (r.primaryCrop ? [r.primaryCrop] : []));

      let soft: DuplicateMatch | null = null;
      for (const s of softIndex) {
        if (s.firstName !== rFirst || s.lastName !== rLast) continue;

        // Rule A — firstName + lastName + village.
        if (rVillage && s.village && rVillage === s.village) {
          soft = Object.freeze({
            rowNumber,
            kind:          'soft',
            reason:        'name_village_match',
            matchedUserId: _str(s.farmer.userId) || _str(s.farmer.id),
          });
          break;
        }

        // Rule B — firstName + lastName + district + crop overlap.
        if (rDistrict && s.district && rDistrict === s.district
            && _cropOverlap(rCrops, s.crops)) {
          soft = Object.freeze({
            rowNumber,
            kind:          'soft',
            reason:        'name_district_crop_match',
            matchedUserId: _str(s.farmer.userId) || _str(s.farmer.id),
          });
          break;
        }
      }
      if (soft) out.push(soft);
    }

    return Object.freeze(out);
  }, Object.freeze([] as DuplicateMatch[]));
}

/** Diagnostic snapshot — surfaced through bulk-onboarding health. */
export function duplicateDetectionSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion: DUPLICATE_DETECTION_VERSION,
    scope:          "organizationId" as const,
    hardRulesReady: true,
    softRulesReady: true,
    autoMerge:      false,
  }), Object.freeze({
    runtimeVersion: DUPLICATE_DETECTION_VERSION,
    scope:          "organizationId" as const,
    hardRulesReady: false,
    softRulesReady: false,
    autoMerge:      false,
  }));
}
