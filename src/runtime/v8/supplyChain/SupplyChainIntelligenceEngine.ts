/**
 * Farroway · Supply Chain Intelligence Engine (supply-chain-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via the
 * `_probe()` / `_ls()` / `_winVar` helpers below, and never fabricates supply,
 * demand, price, or buyer signals.
 *
 * It composes the REAL health envelopes already published by other runtimes
 * (marketplace intelligence, harvest readiness, yield readiness, buyer trust)
 * plus device-local recency of managed plants and scans, into a calm,
 * buyer-safe "supply chain readiness" picture. When the underlying signals are
 * absent it returns an honest "Not enough data yet" fallback.
 *
 * ── BUYER-PRIVACY CONTRACT (do not weaken) ───────────────────────────────────
 * This envelope is safe to surface to a BUYER persona. It therefore exposes
 * ONLY coarse, non-identifying readiness labels. It MUST NOT expose, derive, or
 * leak:
 *   • private farmer demographics (name, location, contact, household, etc.);
 *   • private scan details (disease/pest names, severity, lesion counts,
 *     diagnostic confidence, raw scan payloads, or any PII) unless the farmer
 *     has explicitly approved sharing — which is NOT represented here, so we
 *     expose NONE of it;
 *   • real buyer demand (we have no real demand feed — buyerMatchReadiness is a
 *     coarse capability label, NOT a statement that buyers want this produce);
 *   • any price / revenue / currency figure (no real market data is available,
 *     so no price prediction is ever emitted);
 *   • any exact yield (tons/acre, bags/acre, kg/acre) — coarse labels only.
 * Scan history is read for RECENCY ONLY (how fresh listings are), never for its
 * diagnostic contents.
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
type Tier = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
type BuyerMatch = 'ready' | 'limited' | 'not_ready' | 'unknown';
type Trust = 'verified' | 'limited' | 'unverified';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const SUPPLY_CHAIN_ENGINE_VERSION = 'supply-chain-v1';

export interface SupplyChainHealthEnvelope {
  runtimeVersion: 'supply-chain-v1';
  initialized: true;
  value: {
    listingFreshness: number | null;
    harvestWindowReadiness: Tier;
    supplyReadiness: Tier;
    buyerMatchReadiness: BuyerMatch;
    logisticsReadiness: 'not_configured';
    trustStatus: Trust;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

// --- defensive readers (never throw, never assume probe shape) ------------

/** True only if a probe envelope explicitly reports initialized === true. */
function _probeReady(p: any): boolean {
  return _safe(() => !!(p && _obj(p) && (p as any).initialized === true), false);
}

/** Read a probe's `value` object defensively. */
function _probeValue(p: any): any {
  return _safe(() => _obj((p as any)?.value), null);
}

/** Newest timestamp (ms) across an array of records, scanning common fields. */
function _newestTs(rows: any[]): number {
  return _safe(() => {
    let newest = NaN;
    for (let i = 0; i < rows.length; i++) {
      const r: any = rows[i];
      if (!r || typeof r !== 'object') continue;
      const raw =
        r.timestamp ?? r.scannedAt ?? r.updatedAt ?? r.createdAt ?? r.date ?? null;
      if (raw == null) continue;
      const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
      if (Number.isFinite(n) && (!Number.isFinite(newest) || n > newest)) newest = n;
    }
    return newest;
  }, NaN);
}

/**
 * Map "days since most recent activity" → a coarse 0-100 freshness score.
 * This is a recency descriptor of what is stored on THIS device, not a forecast.
 * Returns null when there is no datable activity.
 */
function _freshnessFromRecency(newestTs: number, nowTs: number): number | null {
  return _safe(() => {
    if (!Number.isFinite(newestTs)) return null;
    const ms = nowTs - newestTs;
    if (!Number.isFinite(ms) || ms < 0) return 100; // future/now stamp → treat as fresh
    const days = ms / 86400000;
    // Coarse, deterministic step function (no noise, no randomness).
    if (days <= 1) return 100;
    if (days <= 3) return 80;
    if (days <= 7) return 60;
    if (days <= 14) return 40;
    if (days <= 30) return 20;
    return 0;
  }, null);
}

/**
 * Derive a coarse Tier from a probe's own coarse signals, WITHOUT inventing
 * numbers. We look for an explicit string status/label the source already
 * publishes; otherwise we fall back to whether the source is simply ready.
 */
function _tierFromProbe(p: any): Tier {
  return _safe(() => {
    if (!_probeReady(p)) return 'UNKNOWN';
    const v = _probeValue(p);
    // Prefer an explicit coarse label the source already exposes.
    const labelRaw =
      _safe(() => v?.readiness ?? v?.readinessTier ?? v?.tier ?? v?.status ?? v?.level, null);
    const label = labelRaw != null ? String(labelRaw).trim().toUpperCase() : '';
    if (label === 'HIGH' || label === 'READY') return 'HIGH';
    if (label === 'MEDIUM' || label === 'MODERATE' || label === 'PARTIAL') return 'MEDIUM';
    if (label === 'LOW' || label === 'NOT_READY' || label === 'EARLY') return 'LOW';
    // Fall back to the source's own confidence LABEL (never a number we coin).
    const conf =
      _safe(() => v?.confidence ?? (p as any)?.confidence, null);
    if (typeof conf === 'string') {
      const c = conf.toLowerCase();
      if (c === 'high') return 'HIGH';
      if (c === 'medium') return 'MEDIUM';
      if (c === 'low') return 'LOW';
    }
    // Source is initialized but offers no coarse label → it is at least active.
    return 'MEDIUM';
  }, 'UNKNOWN');
}

export function supplyChainHealth(): SupplyChainHealthEnvelope {
  const fallback: SupplyChainHealthEnvelope = Object.freeze({
    runtimeVersion: 'supply-chain-v1' as const,
    initialized: true as const,
    value: Object.freeze({
      listingFreshness: null,
      harvestWindowReadiness: 'UNKNOWN' as Tier,
      supplyReadiness: 'UNKNOWN' as Tier,
      buyerMatchReadiness: 'unknown' as BuyerMatch,
      logisticsReadiness: 'not_configured' as const,
      trustStatus: 'unverified' as Trust,
    }),
    confidence: 'low' as Confidence,
    dataSources: Object.freeze([]) as unknown as string[],
    explanation: 'Not enough data yet — supply readiness needs saved plants or scans first.',
    limitations:
      'This is a buyer-safe readiness summary built only from what is published ' +
      'on this device. It shows no private farmer details, no private scan ' +
      'details, no real buyer demand, and no price. ' +
      GUIDANCE_TAIL,
  }) as SupplyChainHealthEnvelope;

  return _safe(() => {
    // --- compose REAL published health envelopes (any may be null) ---
    const marketplace = _probe('__marketplaceIntelligenceHealth');
    const harvest = _probe('__harvestReadinessHealth');
    const yieldP = _probe('__yieldReadinessHealth');
    const buyerTrust = _probe('__buyerTrustHealth');

    // --- device-local stores (RECENCY ONLY for scans — never diagnostics) ---
    const managedPlants = _arr(_ls('farroway_managed_plants'));
    const scanHistory = _arr(_ls('farroway_scan_history_v1'));

    const nowTs = _safe(() => Date.now(), NaN);

    // listingFreshness: how recent the newest listing/scan activity is.
    const newestActivity = _safe(() => {
      const a = _newestTs(managedPlants);
      const b = _newestTs(scanHistory);
      const cands = [a, b].filter((n) => Number.isFinite(n)) as number[];
      return cands.length ? Math.max(...cands) : NaN;
    }, NaN);
    const listingFreshness = _freshnessFromRecency(newestActivity, nowTs);

    // harvestWindowReadiness ← harvest readiness probe (coarse).
    const harvestWindowReadiness: Tier = _tierFromProbe(harvest);

    // supplyReadiness ← yield readiness probe (coarse, NO exact yield numbers).
    const supplyReadiness: Tier = _tierFromProbe(yieldP);

    // buyerMatchReadiness: a coarse CAPABILITY label (NOT real buyer demand).
    // "ready"  → there is fresh supply AND verified trust AND a coarse harvest/supply signal
    // "limited"→ some signal exists but freshness or trust is partial
    // "not_ready" → marketplace surface is active but nothing is ready
    // "unknown" → no marketplace surface and no local signal at all
    const marketplaceReady = _probeReady(marketplace);

    // trustStatus ← buyer trust probe, mapped to a buyer-safe label.
    const trustStatus: Trust = _safe(() => {
      if (!_probeReady(buyerTrust)) return 'unverified';
      const v = _probeValue(buyerTrust);
      const raw =
        _safe(() => v?.trustStatus ?? v?.status ?? v?.trustLevel ?? v?.tier, null);
      const s = raw != null ? String(raw).trim().toLowerCase() : '';
      if (s === 'verified' || s === 'high' || s === 'trusted') return 'verified';
      if (s === 'limited' || s === 'medium' || s === 'partial') return 'limited';
      if (s === 'unverified' || s === 'low' || s === 'none') return 'unverified';
      // Trust probe is live but offers no explicit label → conservatively "limited".
      return 'limited';
    }, 'unverified');

    const hasFreshSupply =
      typeof listingFreshness === 'number' && listingFreshness >= 60;
    const hasAnyLocalSignal =
      managedPlants.length > 0 || scanHistory.length > 0;
    const hasCoarseReadiness =
      harvestWindowReadiness === 'HIGH' ||
      harvestWindowReadiness === 'MEDIUM' ||
      supplyReadiness === 'HIGH' ||
      supplyReadiness === 'MEDIUM';

    const buyerMatchReadiness: BuyerMatch = _safe(() => {
      if (!marketplaceReady && !hasAnyLocalSignal) return 'unknown';
      if (hasFreshSupply && trustStatus === 'verified' && hasCoarseReadiness) {
        return 'ready';
      }
      if (hasAnyLocalSignal || hasCoarseReadiness || trustStatus === 'limited') {
        return 'limited';
      }
      return 'not_ready';
    }, 'unknown');

    // logisticsReadiness is a fixed placeholder — no logistics integration yet.
    const logisticsReadiness = 'not_configured' as const;

    // --- honest data sources (only what we actually observed) ---
    const dataSources: string[] = [];
    if (marketplaceReady) dataSources.push('__marketplaceIntelligenceHealth');
    if (_probeReady(harvest)) dataSources.push('__harvestReadinessHealth');
    if (_probeReady(yieldP)) dataSources.push('__yieldReadinessHealth');
    if (_probeReady(buyerTrust)) dataSources.push('__buyerTrustHealth');
    if (managedPlants.length > 0) dataSources.push('farroway_managed_plants');
    if (scanHistory.length > 0) dataSources.push('farroway_scan_history_v1');

    const limitations =
      'This is a buyer-safe readiness summary built only from what is published ' +
      'on this device. It deliberately hides every private farmer detail and ' +
      'every private scan detail (no disease, pest, severity, location, or ' +
      'identity is ever shown). It reflects no real buyer demand and no price — ' +
      'logistics and pricing are not connected. Labels are coarse and may change ' +
      'as more is scanned or listed. ' +
      GUIDANCE_TAIL;

    // --- honest empty fallback: no signals at all ---
    const noSignals =
      !marketplaceReady &&
      !_probeReady(harvest) &&
      !_probeReady(yieldP) &&
      !_probeReady(buyerTrust) &&
      !hasAnyLocalSignal;

    if (noSignals) {
      return Object.freeze({
        runtimeVersion: 'supply-chain-v1' as const,
        initialized: true as const,
        value: Object.freeze({
          listingFreshness: null,
          harvestWindowReadiness: 'UNKNOWN' as Tier,
          supplyReadiness: 'UNKNOWN' as Tier,
          buyerMatchReadiness: 'unknown' as BuyerMatch,
          logisticsReadiness,
          trustStatus: 'unverified' as Trust,
        }),
        confidence: 'low' as Confidence,
        dataSources: Object.freeze([]) as unknown as string[],
        explanation:
          'Not enough data yet — list a plant or run a scan to begin building ' +
          'a buyer-safe supply picture.',
        limitations,
      }) as SupplyChainHealthEnvelope;
    }

    // --- confidence is a LABEL, derived from how many real signals exist ---
    const readySignals =
      (marketplaceReady ? 1 : 0) +
      (_probeReady(harvest) ? 1 : 0) +
      (_probeReady(yieldP) ? 1 : 0) +
      (_probeReady(buyerTrust) ? 1 : 0) +
      (hasAnyLocalSignal ? 1 : 0);

    let confidence: Confidence = 'low';
    if (readySignals >= 4 && hasFreshSupply && trustStatus === 'verified') {
      confidence = 'high';
    } else if (readySignals >= 2) {
      confidence = 'medium';
    }

    const explanation = _safe(() => {
      const bits: string[] = [];
      bits.push(
        'Buyer-safe supply readiness composed from ' +
          readySignals +
          ' live signal(s).',
      );
      if (typeof listingFreshness === 'number') {
        bits.push('Listing freshness scored ' + listingFreshness + '/100 from recent activity.');
      } else {
        bits.push('No datable listing or scan activity was found for freshness.');
      }
      bits.push('Harvest window readiness: ' + harvestWindowReadiness + '.');
      bits.push('Supply readiness (coarse, no yield figures): ' + supplyReadiness + '.');
      bits.push('Buyer-match readiness (capability label, not real demand): ' + buyerMatchReadiness + '.');
      bits.push('Trust status: ' + trustStatus + '.');
      bits.push('Logistics: not connected yet.');
      return bits.join(' ');
    }, 'Buyer-safe supply readiness summary from device signals.');

    return Object.freeze({
      runtimeVersion: 'supply-chain-v1' as const,
      initialized: true as const,
      value: Object.freeze({
        listingFreshness,
        harvestWindowReadiness,
        supplyReadiness,
        buyerMatchReadiness,
        logisticsReadiness,
        trustStatus,
      }),
      confidence,
      dataSources: Object.freeze(dataSources) as unknown as string[],
      explanation,
      limitations,
    }) as SupplyChainHealthEnvelope;
  }, fallback);
}

export function installSupplyChainHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__supplyChainHealth !== 'function') {
      w.__supplyChainHealth = function () {
        const out = supplyChainHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Supply Chain]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
