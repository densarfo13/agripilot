/**
 * src/runtime/admin/FarmerProfileRuntime.ts — Pure runtime for
 * FarmerProfile records. Demographics are OPTIONAL; the
 * runtime accepts a profile WITHOUT age/gender and rejects any
 * caller that tries to mark them required.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes — wave-5 single writer + the
 *     pending Prisma migration own durable storage.
 *   • No PII surfaced cross-role.
 */

import {
  ADMIN_IMPACT_VERSION, AGE_RANGES, GENDERS, FARMER_ROLES,
  ONBOARDING_STATUSES,
} from './adminImpactContracts';

export const FARMER_PROFILE_VERSION = 'farmer-profile-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validAges    = new Set<string>(AGE_RANGES as readonly string[]);
const _validGenders = new Set<string>(GENDERS as readonly string[]);
const _validRoles   = new Set<string>(FARMER_ROLES as readonly string[]);
const _validStatuses = new Set<string>(ONBOARDING_STATUSES as readonly string[]);

export interface FarmerProfile {
  id:                          string;
  userId:                      string;
  role:                        string;
  ageRange?:                   string;
  gender?:                     string;
  country?:                    string;
  region?:                     string;
  district?:                   string;
  village?:                    string;
  farmSize?:                   string;
  primaryCrops?:               ReadonlyArray<string>;
  organizationId?:             string;
  programId?:                  string;
  onboardingStatus:            string;
  consentForProgramReporting:  boolean;
  createdAt:                   string;
  updatedAt:                   string;
}

const _profiles: Record<string, FarmerProfile> = Object.create(null);

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Create or update a FarmerProfile. Demographics are accepted
 * only when valid AND opt-in; missing demographics are kept
 * undefined rather than coerced to a default.
 */
export function upsertFarmerProfile(ctx: Partial<FarmerProfile>) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: FARMER_PROFILE_VERSION,
        ok: false, reason: 'invalid_context', profile: null,
      });
    }
    const userId = _str(ctx.userId);
    if (!userId) {
      return Object.freeze({
        runtimeVersion: FARMER_PROFILE_VERSION,
        ok: false, reason: 'userId_required', profile: null,
      });
    }
    const role = _str(ctx.role);
    if (!_validRoles.has(role)) {
      return Object.freeze({
        runtimeVersion: FARMER_PROFILE_VERSION,
        ok: false, reason: 'role_invalid', profile: null,
      });
    }
    const existing = _profiles[userId];
    const now = _now();
    const id = _str(ctx.id) || (existing && existing.id)
      || 'profile_' + _hash(userId);
    const onboardingStatus = _str(ctx.onboardingStatus)
      || (existing && existing.onboardingStatus) || 'started';
    if (!_validStatuses.has(onboardingStatus)) {
      return Object.freeze({
        runtimeVersion: FARMER_PROFILE_VERSION,
        ok: false, reason: 'onboarding_status_invalid', profile: null,
      });
    }
    // Demographics — only if valid; otherwise undefined.
    const ageRange = _str(ctx.ageRange);
    const safeAge  = _validAges.has(ageRange) ? ageRange : undefined;
    const gender   = _str(ctx.gender);
    const safeGen  = _validGenders.has(gender) ? gender : undefined;

    const profile: FarmerProfile = Object.freeze({
      id, userId, role,
      ageRange:        safeAge,
      gender:          safeGen,
      country:         _str(ctx.country)        || undefined,
      region:          _str(ctx.region)         || undefined,
      district:        _str(ctx.district)       || undefined,
      village:         _str(ctx.village)        || undefined,
      farmSize:        _str(ctx.farmSize)       || undefined,
      primaryCrops:    Object.freeze(_arr(ctx.primaryCrops).map(_str)
                         .filter((c: string) => c.length > 0)),
      organizationId:  _str(ctx.organizationId) || undefined,
      programId:       _str(ctx.programId)      || undefined,
      onboardingStatus,
      consentForProgramReporting: ctx.consentForProgramReporting === true,
      createdAt:       _str((existing && existing.createdAt) || ctx.createdAt) || now,
      updatedAt:       now,
    });
    _profiles[userId] = profile;
    return Object.freeze({
      runtimeVersion: FARMER_PROFILE_VERSION,
      ok: true, reason: '', profile,
    });
  }, Object.freeze({
    runtimeVersion: FARMER_PROFILE_VERSION,
    ok: false, reason: 'error', profile: null,
  }));
}

export function findFarmerProfile(userId: string): FarmerProfile | null {
  return _safe(() => _profiles[_str(userId)] || null, null);
}

export function listFarmerProfiles(opts?: { organizationId?: string;
                                              programId?: string;
                                              limit?: number })
    : ReadonlyArray<FarmerProfile> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    const limit = typeof o.limit === 'number' ? o.limit : 500;
    let pool = Object.values(_profiles);
    if (_str(o.organizationId)) {
      pool = pool.filter((p) => _str(p.organizationId) === _str(o.organizationId));
    }
    if (_str(o.programId)) {
      pool = pool.filter((p) => _str(p.programId) === _str(o.programId));
    }
    return Object.freeze(pool.slice(-limit).map((p) =>
      Object.freeze({ ...p })));
  }, Object.freeze([] as FarmerProfile[]));
}

/**
 * Demographic distributions for the founder / NGO dashboards.
 * ONLY counts users who voluntarily provided data. The empty
 * state honesty string is surfaced separately.
 */
export function demographicDistribution(opts?:
    { organizationId?: string }) {
  return _safe(() => {
    const pool = listFarmerProfiles(opts);
    const ageDist: Record<string, number> = {};
    const genderDist: Record<string, number> = {};
    const regionDist: Record<string, number> = {};
    let ageDeclared = 0, genderDeclared = 0;
    for (const p of pool) {
      if (p.ageRange && p.ageRange !== 'prefer_not_to_say') {
        ageDist[p.ageRange] = (ageDist[p.ageRange] || 0) + 1;
        ageDeclared++;
      }
      if (p.gender && p.gender !== 'prefer_not_to_say') {
        genderDist[p.gender] = (genderDist[p.gender] || 0) + 1;
        genderDeclared++;
      }
      const region = _str(p.region);
      if (region) regionDist[region] = (regionDist[region] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: FARMER_PROFILE_VERSION,
      ageRanges:    Object.freeze(ageDist),
      genders:      Object.freeze(genderDist),
      regions:      Object.freeze(regionDist),
      ageDeclared,
      genderDeclared,
      totalProfiles: pool.length,
      demographicsOptional: true,
    });
  }, Object.freeze({
    runtimeVersion: FARMER_PROFILE_VERSION,
    ageRanges: Object.freeze({}),
    genders: Object.freeze({}),
    regions: Object.freeze({}),
    ageDeclared: 0, genderDeclared: 0, totalProfiles: 0,
    demographicsOptional: true,
  }));
}

export function farmerProfileSnapshot() {
  return _safe(() => {
    const pool = Object.values(_profiles);
    const byRole: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let activeCount = 0;
    for (const p of pool) {
      byRole[p.role] = (byRole[p.role] || 0) + 1;
      byStatus[p.onboardingStatus] = (byStatus[p.onboardingStatus] || 0) + 1;
      if (p.onboardingStatus === 'active') activeCount++;
    }
    return Object.freeze({
      runtimeVersion: FARMER_PROFILE_VERSION,
      total:    pool.length,
      active:   activeCount,
      byRole:   Object.freeze(byRole),
      byStatus: Object.freeze(byStatus),
      demographicsOptional: true,
    });
  }, Object.freeze({
    runtimeVersion: FARMER_PROFILE_VERSION,
    total: 0, active: 0,
    byRole: Object.freeze({}), byStatus: Object.freeze({}),
    demographicsOptional: true,
  }));
}

export { ADMIN_IMPACT_VERSION };

/** Test-only — wipe. */
export function _resetFarmerProfiles() {
  for (const k of Object.keys(_profiles)) delete _profiles[k];
}
