/**
 * Farroway · Regional Network Runtime (regional-network-v13)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates
 * regional network data, outbreaks, yields, or revenue.
 *
 * It looks for coarse DISEASE / PEST signals across the region and, for each,
 * a careful trend ('increasing' | 'decreasing' | 'stable') derived from REAL
 * stored scans' OWN timestamps. A single device / farm can NEVER produce a
 * region-level signal: the engine requires MULTIPLE distinct farms AND a
 * minimum number of real scans before reporting anything. When that bar is not
 * met it returns the honest "Not enough regional data yet" reading with low
 * confidence. It never calls the network, never declares a confirmed outbreak,
 * and never emits exact yields, tonnages, or revenue.
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
type Trend = 'increasing' | 'decreasing' | 'stable';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// A single device / farm can never produce a region-level signal. We require
// at least this many distinct farms AND this many real scans before reporting
// ANY disease/pest signal. Below either bar the engine stays honestly silent.
const MIN_SCAN_COUNT = 10;
const MIN_FARM_COUNT = 2;

// --- regional-network-specific pure helpers (never throw) -----------------

function _str(v: any): string {
  return _safe(() => (v == null ? '' : String(v)), '');
}

// Reads a record timestamp into epoch ms, or NaN when absent/unparseable.
function _recordTime(rec: any): number {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return NaN;
    const raw =
      r.timestamp ?? r.createdAt ?? r.scannedAt ?? r.date ?? r.loggedAt ?? null;
    if (raw == null) return NaN;
    const n = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return Number.isFinite(n) ? n : NaN;
  }, NaN);
}

// Returns a farm/device identifier off a record, or '' when none is present.
// This is how we corroborate that signals come from MORE than one farm.
function _farmIdOf(rec: any): string {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return '';
    const raw =
      r.farmId ?? r.farm_id ?? r.farmID ?? r.farm ??
      r.orgId ?? r.org_id ?? r.organizationId ??
      r.deviceId ?? r.device_id ?? r.tenantId ?? r.userId ?? null;
    const s = _str(raw).trim();
    return s ? s : '';
  }, '');
}

// Returns a normalized disease label if a record mentions a disease finding,
// else ''. The token groups "same disease" detections across the region.
function _diseaseToken(rec: any): string {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return '';
    const hay = [
      r.category, r.conditionCategory, r.type, r.kind, r.label, r.finding,
      r.diagnosis, r.disease, r.issue, r.condition, r.name, r.result,
      r.possibleDiseaseOrPest, r.noticed,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return '';
    const m = hay.match(/(blight|mildew|rust|rot|wilt|mold|mould|fungus|fungal|lesion|spot|infection|infected|canker|smut|anthracnose|mosaic|virus|disease)/);
    return m ? m[1] : '';
  }, '');
}

// Returns a normalized pest label if a record mentions a pest finding, else ''.
function _pestToken(rec: any): string {
  return _safe(() => {
    const r = _obj(rec);
    if (!r) return '';
    const hay = [
      r.category, r.conditionCategory, r.type, r.kind, r.label, r.finding,
      r.diagnosis, r.pest, r.issue, r.condition, r.name, r.result,
      r.possibleDiseaseOrPest, r.noticed,
    ].map(_str).join(' ').toLowerCase();
    if (!hay.trim()) return '';
    const m = hay.match(/(aphid|worm|borer|beetle|caterpillar|mite|larvae|locust|weevil|thrip|whitefly|armyworm|infestation|insect|pest)/);
    return m ? m[1] : '';
  }, '');
}

export interface RegionalNetworkSignal {
  label: string;
  trend: Trend;
  count: number;
}

export interface RegionalNetworkEnvelope {
  runtimeVersion: 'regional-network-v13';
  initialized: true;
  region: string;
  crop: string;
  diseaseSignals: RegionalNetworkSignal[];
  pestSignals: RegionalNetworkSignal[];
  scanCount: number;
  farmCount: number;
  confidence: Confidence;
  limitations: string;
  explanation: string;
}

export const REGIONAL_NETWORK_RUNTIME_VERSION = 'regional-network-v13';

export function regionalNetworkHealth(): RegionalNetworkEnvelope {
  return _safe(
    () => {
      // --- real stored data (any of these may be absent) ------------------
      // Read ONLY this device/org's own slots — never another tenant's data.
      const scanHistory = _arr(_ls('farroway_scan_history_v1'));
      const eventLog = _arr(_ls('farroway_event_log'));
      const managedPlants = _arr(_ls('farroway_managed_plants'));
      const activeFarm = _obj(_ls('farroway_active_farm'));

      // --- scanCount: from real saved scans only --------------------------
      const scanCount = _safe(() => scanHistory.length, 0);

      // --- region (from active farm's region/country) ---------------------
      const region = _safe(() => {
        if (!activeFarm) return 'unknown';
        const f: any = activeFarm;
        const r = _str(f.region).trim() || _str(f.country).trim();
        return r ? r : 'unknown';
      }, 'unknown');

      // --- dominant crop (from managed plants, else scan history) ---------
      const crop = _safe(() => {
        const tally: Record<string, number> = {};
        const add = (raw: any) => {
          const c = _str(raw).trim();
          if (c) tally[c] = (tally[c] || 0) + 1;
        };
        for (let i = 0; i < managedPlants.length; i++) {
          const p = _obj(managedPlants[i]);
          if (!p) continue;
          add((p as any).crop ?? (p as any).plant ?? (p as any).plantName ?? (p as any).species ?? (p as any).cropName ?? (p as any).name);
        }
        if (Object.keys(tally).length === 0) {
          for (let i = 0; i < scanHistory.length; i++) {
            const s = _obj(scanHistory[i]);
            if (!s) continue;
            add((s as any).crop ?? (s as any).plantType ?? (s as any).plant ?? (s as any).cropName ?? (s as any).species);
          }
        }
        const names = Object.keys(tally);
        if (names.length === 0) return 'unknown';
        names.sort((a, b) => tally[b] - tally[a]);
        return names[0];
      }, 'unknown');

      // --- farmCount: distinct farm identifiers across scans + events +
      //     managed plants. On ONE device this is typically 1, which keeps
      //     every region-level signal suppressed — that is correct and honest.
      const farmCount = _safe(() => {
        const ids: Record<string, true> = {};
        const collect = (rows: any[]) => {
          for (let i = 0; i < rows.length; i++) {
            const id = _farmIdOf(rows[i]);
            if (id) ids[id] = true;
          }
        };
        collect(scanHistory);
        collect(eventLog);
        collect(managedPlants);
        return Object.keys(ids).length;
      }, 0);

      // --- limitations note (constant, honest) ----------------------------
      const limitations =
        'This only looks at what has been saved on this device and organization ' +
        'so far, and it reports coarse disease and pest signals with a simple ' +
        'trend, never exact numbers, yields, tonnages, or revenue. A single farm ' +
        'or device can never produce a region-level signal: several distinct ' +
        'farms and enough real scans are required first, so on one device every ' +
        'signal stays suppressed on purpose. It does not include other devices, ' +
        'deleted records, or anything not yet scanned or logged, and it is not a ' +
        'verified outbreak report or advice about chemicals or treatments. ' +
        GUIDANCE_TAIL;

      // --- honest fallback: require MULTIPLE farms AND enough real scans ---
      // No single-user / single-farm outbreak claim is ever possible.
      if (farmCount < MIN_FARM_COUNT || scanCount < MIN_SCAN_COUNT) {
        return Object.freeze({
          runtimeVersion: 'regional-network-v13' as const,
          initialized: true as const,
          region,
          crop,
          diseaseSignals: Object.freeze([]) as unknown as RegionalNetworkSignal[],
          pestSignals: Object.freeze([]) as unknown as RegionalNetworkSignal[],
          scanCount,
          farmCount,
          confidence: 'low' as Confidence,
          limitations,
          explanation: 'Not enough regional data yet',
        }) as RegionalNetworkEnvelope;
      }

      // --- recency split for trend: compare an OLDER half vs a RECENT half.
      // We use a record's OWN saved timestamp for recency — never a fresh
      // clock-seeded value as a data signal. The current time is used only as
      // a relative cutoff, and absence of a usable timestamp degrades safely.
      const nowMs = _safe(() => Date.now(), NaN);
      const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30-day observation window
      const HALF_MS = WINDOW_MS / 2;
      const isRecentHalf = (rec: any): boolean => {
        return _safe(() => {
          const t = _recordTime(rec);
          if (!Number.isFinite(t) || !Number.isFinite(nowMs)) return false;
          return nowMs - t <= HALF_MS;
        }, false);
      };
      const isOlderHalf = (rec: any): boolean => {
        return _safe(() => {
          const t = _recordTime(rec);
          if (!Number.isFinite(t) || !Number.isFinite(nowMs)) return false;
          const age = nowMs - t;
          return age > HALF_MS && age <= WINDOW_MS;
        }, false);
      };

      // --- tally detections per token, tracking total / recent / older and
      //     the distinct farms that contributed each token. A token only
      //     becomes a region signal when at least two distinct farms report it.
      interface Tally {
        total: number;
        recent: number;
        older: number;
        farms: Record<string, true>;
      }

      const tallyFor = (
        tokenOf: (rec: any) => string,
      ): Record<string, Tally> => {
        const out: Record<string, Tally> = {};
        const consume = (rows: any[]) => {
          for (let i = 0; i < rows.length; i++) {
            const rec = rows[i];
            const tok = tokenOf(rec);
            if (!tok) continue;
            if (!out[tok]) out[tok] = { total: 0, recent: 0, older: 0, farms: {} };
            const t = out[tok];
            t.total += 1;
            if (isRecentHalf(rec)) t.recent += 1;
            else if (isOlderHalf(rec)) t.older += 1;
            const fid = _farmIdOf(rec);
            if (fid) t.farms[fid] = true;
          }
        };
        consume(scanHistory);
        consume(eventLog);
        return out;
      };

      const trendOf = (t: Tally): Trend => {
        return _safe(() => {
          // Conservative: meaningful movement requires a clear gap between the
          // recent and older halves; otherwise we call it 'stable'.
          if (t.recent > t.older + 1) return 'increasing';
          if (t.older > t.recent + 1) return 'decreasing';
          return 'stable';
        }, 'stable');
      };

      const buildSignals = (
        tally: Record<string, Tally>,
      ): RegionalNetworkSignal[] => {
        return _safe(() => {
          const signals: RegionalNetworkSignal[] = [];
          const keys = Object.keys(tally);
          for (let i = 0; i < keys.length; i++) {
            const tok = keys[i];
            const t = tally[tok];
            // A region-level signal requires corroboration from MULTIPLE
            // distinct farms — one farm alone can never raise a signal.
            const distinctFarms = Object.keys(t.farms).length;
            if (distinctFarms < MIN_FARM_COUNT) continue;
            signals.push(
              Object.freeze({
                label: tok,
                trend: trendOf(t),
                count: t.total,
              }),
            );
          }
          signals.sort((a, b) => b.count - a.count);
          return signals;
        }, [] as RegionalNetworkSignal[]);
      };

      const diseaseSignals = buildSignals(tallyFor(_diseaseToken));
      const pestSignals = buildSignals(tallyFor(_pestToken));

      // --- confidence: scales with real scans, distinct farms, and signals.
      // Honest scaling: never 'high' without ample scans, several farms, and
      // at least one corroborated signal.
      const signalCount = diseaseSignals.length + pestSignals.length;
      let confidence: Confidence = 'low';
      if (scanCount >= 30 && farmCount >= 4 && signalCount >= 1) {
        confidence = 'high';
      } else if (scanCount >= MIN_SCAN_COUNT && farmCount >= MIN_FARM_COUNT) {
        confidence = 'medium';
      }

      // --- plain-language explanation -------------------------------------
      const explanation = _safe(() => {
        const where = region !== 'unknown' ? ('in ' + region) : 'in your area';
        const what = crop !== 'unknown' ? (' for ' + crop) : '';
        const bits: string[] = [];
        bits.push(
          'Based on ' + scanCount + ' saved scan(s) across ' + farmCount +
            ' farm(s) ' + where + what + ', here is the regional network picture:',
        );
        if (signalCount === 0) {
          bits.push('No disease or pest pattern is reported by enough farms to stand out right now.');
        } else {
          if (diseaseSignals.length > 0) {
            const top = diseaseSignals[0];
            bits.push(
              'Disease watch: "' + top.label + '" appears across multiple farms and looks ' +
                top.trend + '.',
            );
          }
          if (pestSignals.length > 0) {
            const top = pestSignals[0];
            bits.push(
              'Pest watch: "' + top.label + '" appears across multiple farms and looks ' +
                top.trend + '.',
            );
          }
          bits.push('These are likely patterns to monitor, not confirmed outbreaks.');
        }
        bits.push('Keep scanning and logging to keep this picture clear.');
        return bits.join(' ');
      }, 'Regional network signals based on the real data saved on this device.');

      return Object.freeze({
        runtimeVersion: 'regional-network-v13' as const,
        initialized: true as const,
        region,
        crop,
        diseaseSignals: Object.freeze(diseaseSignals) as unknown as RegionalNetworkSignal[],
        pestSignals: Object.freeze(pestSignals) as unknown as RegionalNetworkSignal[],
        scanCount,
        farmCount,
        confidence,
        limitations,
        explanation,
      }) as RegionalNetworkEnvelope;
    },
    // --- absolute fallback if anything above throws ---------------------
    Object.freeze({
      runtimeVersion: 'regional-network-v13' as const,
      initialized: true as const,
      region: 'unknown',
      crop: 'unknown',
      diseaseSignals: Object.freeze([]) as unknown as RegionalNetworkSignal[],
      pestSignals: Object.freeze([]) as unknown as RegionalNetworkSignal[],
      scanCount: 0,
      farmCount: 0,
      confidence: 'low' as Confidence,
      limitations:
        'This only looks at what has been saved on this device and organization ' +
        'so far, and it reports coarse disease and pest signals, never exact ' +
        'numbers, yields, or revenue. A single farm can never produce a ' +
        'region-level signal. ' +
        GUIDANCE_TAIL,
      explanation: 'Not enough regional data yet',
    }) as RegionalNetworkEnvelope,
  );
}

export function installRegionalNetworkHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__regionalNetworkHealth !== 'function') {
      w.__regionalNetworkHealth = function () {
        const out = regionalNetworkHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Regional Network]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
