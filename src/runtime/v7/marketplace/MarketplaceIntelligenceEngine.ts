/**
 * Farroway · Marketplace Intelligence Engine (marketplace-intelligence-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates.
 *
 * It produces COARSE, buyer-facing marketplace readiness/trust signals derived
 * only from data that already exists on this device + a few health probes.
 * If the inputs are insufficient it returns an honest "Not enough data yet"
 * fallback rather than inventing numbers.
 *
 * BUYER PRIVACY — HARD BOUNDARY:
 *   A buyer-facing signal MUST expose NO private farmer scan details.
 *   This engine NEVER reads or surfaces disease names, pest names, severity,
 *   scan notes, or any PII (id / name / phone / email / coordinates / device /
 *   filename). It only counts the PRESENCE of fields (photo / name / data
 *   completeness) and reads coarse, non-identifying readiness + trust labels.
 *   No payments, escrow, checkout, prices, currency, or fabricated buyer
 *   demand are computed here — none of those concepts exist in this file.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

type HarvestReadiness = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
type ListingQuality = 'basic' | 'good' | 'strong' | 'unknown';
type TrustStatus = 'verified' | 'limited' | 'unverified';

export interface MarketplaceIntelligenceEnvelope {
  runtimeVersion: 'marketplace-intelligence-v1';
  initialized: true;
  value: {
    harvestReadiness: HarvestReadiness;
    cropListingQuality: ListingQuality;
    buyerMatchScore: number | null;
    distanceScore: number | null;
    freshnessScore: number | null;
    trustStatus: TrustStatus;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export const MARKETPLACE_INTELLIGENCE_ENGINE_VERSION = 'marketplace-intelligence-v1';

// --- coarse, non-identifying readers (never throw) ------------------------

/** Clamp to an integer 0..100. */
function _pct(n: number): number {
  const x = Math.round(n);
  return x < 0 ? 0 : x > 100 ? 100 : x;
}

/** Read a millisecond timestamp from a known-safe recency field only. */
function _whenMs(entry: any): number {
  return _safe(() => {
    const o = _obj(entry);
    if (!o) return 0;
    // Only coarse recency fields — never identifying content.
    const raw =
      o.updatedAt ?? o.createdAt ?? o.timestamp ?? o.scannedAt ?? o.at ?? null;
    if (raw == null) return 0;
    if (typeof raw === 'number') return raw > 0 ? raw : 0;
    const t = Date.parse(String(raw));
    return Number.isFinite(t) ? t : 0;
  }, 0);
}

/** Newest recency timestamp across a list (0 when none). */
function _newestMs(list: any[]): number {
  return _safe(() => {
    let best = 0;
    for (const e of list) {
      const t = _whenMs(e);
      if (t > best) best = t;
    }
    return best;
  }, 0);
}

/**
 * Map newest-entry recency to a coarse freshness score.
 * Pure decay from "today" — no fabrication, returns null with no real entry.
 */
function _freshness(newestMs: number): number | null {
  return _safe(() => {
    if (!(newestMs > 0)) return null;
    const now = Date.now();
    const ageDays = (now - newestMs) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays < 0) return null;
    if (ageDays <= 1) return 100;
    if (ageDays >= 30) return 5;
    // Linear coarse decay across the 1..30 day window.
    return _pct(100 - ((ageDays - 1) / 29) * 95);
  }, null);
}

/**
 * Coarse listing-quality from PRESENCE of fields only.
 * Counts whether a photo / a name / structured data exist — NEVER reads the
 * scan's disease / pest / severity / note content.
 */
function _listingQuality(plants: any[], scans: any[]): ListingQuality {
  return _safe(() => {
    const pool = plants.length > 0 ? plants : scans;
    if (pool.length === 0) return 'unknown';

    let hasPhoto = false;
    let hasName = false;
    let hasData = false;

    for (const raw of pool) {
      const o = _obj(raw);
      if (!o) continue;
      // Presence checks only — values are never read or exposed.
      if (o.photo != null || o.image != null || o.imageUrl != null || o.thumbnail != null)
        hasPhoto = true;
      if (
        (typeof o.cropName === 'string' && o.cropName.trim().length > 0) ||
        (typeof o.name === 'string' && o.name.trim().length > 0) ||
        (typeof o.species === 'string' && o.species.trim().length > 0)
      )
        hasName = true;
      if (o.stage != null || o.plantedAt != null || o.variety != null || o.quantity != null)
        hasData = true;
      if (hasPhoto && hasName && hasData) break;
    }

    const completeness = (hasPhoto ? 1 : 0) + (hasName ? 1 : 0) + (hasData ? 1 : 0);
    if (completeness >= 3) return 'strong';
    if (completeness === 2) return 'good';
    if (completeness === 1) return 'basic';
    return 'unknown';
  }, 'unknown');
}

/** Map any coarse readiness probe label/score to LOW/MEDIUM/HIGH/UNKNOWN. */
function _readinessFrom(...sources: any[]): HarvestReadiness {
  return _safe(() => {
    for (const src of sources) {
      const o = _obj(src);
      if (!o) continue;
      const v = o.value ?? o;
      // Coarse label first.
      const label = String(
        (v && (v.readiness ?? v.level ?? v.status ?? v.harvestReadiness)) ?? '',
      ).toUpperCase();
      if (label === 'HIGH' || label === 'MEDIUM' || label === 'LOW') return label as HarvestReadiness;
      // Else a coarse numeric score, if present.
      const score = v && (v.score ?? v.readinessScore);
      if (typeof score === 'number' && Number.isFinite(score)) {
        if (score >= 67) return 'HIGH';
        if (score >= 34) return 'MEDIUM';
        return 'LOW';
      }
    }
    return 'UNKNOWN';
  }, 'UNKNOWN');
}

/** Map a coarse trust probe to verified / limited / unverified — no PII read. */
function _trustFrom(trust: any): TrustStatus {
  return _safe(() => {
    const o = _obj(trust);
    if (!o) return 'unverified';
    const v = _obj(o.value) ?? o;
    // Read ONLY coarse booleans / labels — never any private field.
    const label = String((v.status ?? v.trustStatus ?? v.level) ?? '').toLowerCase();
    if (label === 'verified') return 'verified';
    if (label === 'limited') return 'limited';
    if (label === 'unverified') return 'unverified';
    if (v.verified === true) return 'verified';
    if (v.limited === true || v.partiallyVerified === true) return 'limited';
    return 'unverified';
  }, 'unverified');
}

export function marketplaceIntelligenceHealth(): MarketplaceIntelligenceEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ---
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));

      // --- probes (any may be null) ---
      const harvestProbe = _probe('__harvestReadinessHealth');
      const yieldProbe = _probe('__yieldReadinessHealth');
      const buyerTrustProbe = _probe('__buyerTrustHealth');

      const dataSources: string[] = [];

      // --- harvest readiness (coarse) ---
      const harvestReadiness = _readinessFrom(harvestProbe, yieldProbe);
      if (_obj(harvestProbe)) dataSources.push('__harvestReadinessHealth');
      if (_obj(yieldProbe)) dataSources.push('__yieldReadinessHealth');

      // --- listing quality (presence counts only, no scan content) ---
      const cropListingQuality = _listingQuality(managedPlants, scanHistory);
      if (managedPlants.length > 0) dataSources.push('farroway_managed_plants');
      if (scanHistory.length > 0) dataSources.push('farroway_scan_history_v1');

      // --- freshness (recency of newest on-device entry) ---
      const newestMs = Math.max(_newestMs(managedPlants), _newestMs(scanHistory));
      const freshnessScore = _freshness(newestMs);

      // --- trust (coarse status only) ---
      const trustStatus = _trustFrom(buyerTrustProbe);
      if (_obj(buyerTrustProbe)) dataSources.push('__buyerTrustHealth');

      // --- buyerMatchScore: coarse composite of non-PII signals ----------
      // Combines readiness + trust + freshness only. NOT real buyer demand —
      // we never invent buyers, orders, or demand numbers. null when the
      // inputs are too thin to support an honest signal.
      const readinessPts =
        harvestReadiness === 'HIGH'
          ? 100
          : harvestReadiness === 'MEDIUM'
            ? 60
            : harvestReadiness === 'LOW'
              ? 25
              : null;
      const trustPts =
        trustStatus === 'verified'
          ? 100
          : trustStatus === 'limited'
            ? 55
            : 20;
      const parts: number[] = [];
      if (readinessPts != null) parts.push(readinessPts);
      if (freshnessScore != null) parts.push(freshnessScore);
      // Trust always contributes (it is a coarse, always-derivable label).
      parts.push(trustPts);
      const realSignalCount =
        (readinessPts != null ? 1 : 0) +
        (freshnessScore != null ? 1 : 0) +
        (_obj(buyerTrustProbe) ? 1 : 0);
      const buyerMatchScore =
        realSignalCount >= 2 && parts.length > 0
          ? _pct(parts.reduce((a, b) => a + b, 0) / parts.length)
          : null;

      // --- distanceScore: ONLY with real coarse location on both sides ---
      // No coarse two-sided location signal is available on-device here, and
      // we never fabricate one. Default null (reported as 'unknown').
      const distanceScore: number | null = null;

      // --- confidence scales with how many real inputs exist -------------
      const inputs =
        (_obj(harvestProbe) ? 1 : 0) +
        (_obj(yieldProbe) ? 1 : 0) +
        (_obj(buyerTrustProbe) ? 1 : 0) +
        (managedPlants.length > 0 ? 1 : 0) +
        (scanHistory.length > 0 ? 1 : 0);
      const confidence: Confidence = inputs >= 4 ? 'high' : inputs >= 2 ? 'medium' : 'low';

      const haveAny =
        harvestReadiness !== 'UNKNOWN' ||
        cropListingQuality !== 'unknown' ||
        buyerMatchScore != null ||
        freshnessScore != null ||
        dataSources.length > 0;

      const explanation = haveAny
        ? 'Coarse, non-identifying marketplace readiness and trust signals derived ' +
          'from on-device listing/scan data and health probes. No private scan ' +
          'details (disease, pest, severity, notes, PII) are ever exposed to buyers.'
        : 'Not enough data yet — add a crop listing or scan on this device to ' +
          'build a marketplace readiness signal.';

      const limitations =
        'Buyer-facing signals are coarse and intentionally exclude all private ' +
        'scan details and personal information. buyerMatchScore reflects ' +
        'readiness and trust signals, not real buyer demand; distanceScore is ' +
        'omitted unless real coarse location exists for both sides. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: 'marketplace-intelligence-v1',
        initialized: true as const,
        value: Object.freeze({
          harvestReadiness,
          cropListingQuality,
          buyerMatchScore,
          distanceScore,
          freshnessScore,
          trustStatus,
        }),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as MarketplaceIntelligenceEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'marketplace-intelligence-v1',
      initialized: true as const,
      value: Object.freeze({
        harvestReadiness: 'UNKNOWN' as HarvestReadiness,
        cropListingQuality: 'unknown' as ListingQuality,
        buyerMatchScore: null,
        distanceScore: null,
        freshnessScore: null,
        trustStatus: 'unverified' as TrustStatus,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — add a crop listing or scan on this device to ' +
        'build a marketplace readiness signal.',
      limitations:
        'Buyer-facing signals are coarse and intentionally exclude all private ' +
        'scan details and personal information. ' +
        GUIDANCE_TAIL,
    }) as MarketplaceIntelligenceEnvelope,
  );
}

export function installMarketplaceIntelligenceHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__marketplaceIntelligenceHealth !== 'function') {
      w.__marketplaceIntelligenceHealth = function () {
        const out = marketplaceIntelligenceHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Marketplace Intelligence]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
