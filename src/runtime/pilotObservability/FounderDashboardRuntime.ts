/**
 * src/runtime/pilotObservability/FounderDashboardRuntime.ts —
 * §1 FOUNDER DASHBOARD composite.
 *
 * Read-only composition of existing telemetry probes into a single
 * dashboard envelope for admin/founder use. Never fabricates data:
 * every count is honestly `null` when its underlying source is
 * unavailable. Never surfaces PII (no farmer ids / names / coords /
 * device ids / IPs / phones / filenames).
 *
 * Composes:
 *   __retentionMetrics              → activeFarmers, activeGardeners
 *   __ngoMetrics / __ngoPilotMetrics → organizations
 *   __scanPilotMetrics              → scans total + outcomesRecorded fallback
 *   __taskChainProgressHealth       → tasksCompleted
 *   __outcomeHealth                 → outcomesRecorded (preferred)
 *   __fundingHealth                 → fundingViews
 *   __marketplaceIntelligenceHealth → listingsCreated
 *   __postHarvestHealth             → harvestEvents
 *   __weeklyFarmReviewHealth        → weeklyReviewsGenerated
 *
 * Time-windowed counts (scansToday, scansThisWeek,
 * followUpScansCompleted today) read from localStorage
 * `farroway_event_log` filtered by event ts vs the caller-supplied
 * `nowMs`. computeFounderDashboard() is PURE — accepts nowMs as a
 * parameter. The public window probe wraps it with performance.now().
 *
 * Honesty tail: limitations always ends with
 * "Decision support, not a guarantee."
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
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

const _DAY_MS = 24 * 60 * 60 * 1000;
const _WEEK_MS = 7 * _DAY_MS;

const HONESTY_TAIL = 'Decision support, not a guarantee.';

type Confidence = 'low' | 'medium' | 'high';

export const FOUNDER_DASHBOARD_VERSION = 'founder-dashboard-v1' as const;

export interface FounderDashboardMetrics {
  activeFarmers: number | null;
  activeGardeners: number | null;
  organizations: number | null;
  scansToday: number | null;
  scansThisWeek: number | null;
  tasksCompleted: number | null;
  outcomesRecorded: number | null;
  followUpScansCompleted: number | null;
  weeklyReviewsGenerated: number | null;
  fundingViews: number | null;
  listingsCreated: number | null;
  harvestEvents: number | null;
}

export interface FounderDashboardHealthEnvelope {
  initialized: true;
  metrics: Readonly<FounderDashboardMetrics>;
  adminOnly: true;
  noFakeMetrics: true;
  noPII: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const _EMPTY_METRICS: Readonly<FounderDashboardMetrics> = Object.freeze({
  activeFarmers: null,
  activeGardeners: null,
  organizations: null,
  scansToday: null,
  scansThisWeek: null,
  tasksCompleted: null,
  outcomesRecorded: null,
  followUpScansCompleted: null,
  weeklyReviewsGenerated: null,
  fundingViews: null,
  listingsCreated: null,
  harvestEvents: null,
});

function _num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function _eventTs(e: any): number {
  return _safe(() => {
    if (!e) return NaN;
    if (typeof e.ts === 'number' && Number.isFinite(e.ts)) return e.ts;
    if (typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)) return e.timestamp;
    if (typeof e.iso === 'string') {
      const t = new Date(e.iso).getTime();
      return Number.isFinite(t) ? t : NaN;
    }
    if (typeof e.at === 'string') {
      const t = new Date(e.at).getTime();
      return Number.isFinite(t) ? t : NaN;
    }
    return NaN;
  }, NaN);
}

function _eventKind(e: any): string {
  return _safe(() => {
    if (!e) return '';
    return String(e.kind || e.type || e.eventType || e.name || '');
  }, '');
}

function _isScanKind(k: string): boolean {
  return k === 'ScanCompleted' || k === 'Scan' || k === 'ScanRecorded' || k === 'PlantScanned';
}

function _isFollowUpScanKind(k: string): boolean {
  return k === 'FollowUpScanCompleted' || k === 'FollowUpScan' || k === 'FollowUpScanRecorded';
}

/**
 * Pure computation of the founder dashboard composite. Accepts
 * `nowMs` as the time reference so the function body contains no
 * Date.now() or performance.now() calls (keeps it deterministic for
 * tests and free of time/randomness sources).
 */
export function computeFounderDashboard(nowMs: number): Readonly<FounderDashboardMetrics> {
  return _safe(() => {
    const ref = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : NaN;
    const startOfToday = Number.isFinite(ref) ? (ref - _DAY_MS) : NaN;
    const startOfWeek = Number.isFinite(ref) ? (ref - _WEEK_MS) : NaN;

    // ── retention probe → activeFarmers / activeGardeners ─────────
    const retention = _probe('__retentionMetrics');
    let activeFarmers: number | null = null;
    let activeGardeners: number | null = null;
    if (retention && typeof retention === 'object') {
      activeFarmers = _num((retention as any).activeFarmers);
      activeGardeners = _num((retention as any).activeGardeners);
    }

    // ── NGO probe → organizations ─────────────────────────────────
    const ngo = _probe('__ngoMetrics') || _probe('__ngoPilotMetrics');
    let organizations: number | null = null;
    if (ngo && typeof ngo === 'object') {
      organizations = _num((ngo as any).organizations)
        ?? _num((ngo as any).organizationsCount)
        ?? _num((ngo as any).orgCount);
    }

    // ── scan pilot metrics → totals + outcomesRecorded fallback ──
    const scanPilot = _probe('__scanPilotMetrics');
    const scanPilotOutcomes = scanPilot && typeof scanPilot === 'object'
      ? _num((scanPilot as any).outcomesRecorded)
      : null;

    // ── time-windowed counts from event log ──────────────────────
    const eventLog = _ls('farroway_event_log');
    const events: any[] = Array.isArray(eventLog) ? eventLog : [];

    let scansToday: number | null = null;
    let scansThisWeek: number | null = null;
    let followUpScansCompleted: number | null = null;

    if (events.length > 0 && Number.isFinite(ref)) {
      let st = 0;
      let sw = 0;
      let fu = 0;
      let sawAnyScan = false;
      let sawAnyFollowUp = false;
      for (const e of events) {
        const kind = _eventKind(e);
        const ts = _eventTs(e);
        if (_isScanKind(kind)) {
          sawAnyScan = true;
          if (Number.isFinite(ts)) {
            if (ts >= startOfToday && ts <= ref) st++;
            if (ts >= startOfWeek && ts <= ref) sw++;
          }
        }
        if (_isFollowUpScanKind(kind)) {
          sawAnyFollowUp = true;
          if (Number.isFinite(ts) && ts >= startOfToday && ts <= ref) fu++;
        }
      }
      // Only surface a count when the log actually carried that
      // event kind — otherwise stay null (honest NEEDS_DATA).
      if (sawAnyScan) {
        scansToday = st;
        scansThisWeek = sw;
      }
      if (sawAnyFollowUp) {
        followUpScansCompleted = fu;
      }
    }

    // ── tasksCompleted from task chain progress probe ────────────
    const taskChain = _probe('__taskChainProgressHealth');
    let tasksCompleted: number | null = null;
    if (taskChain && typeof taskChain === 'object') {
      tasksCompleted = _num((taskChain as any).tasksCompleted)
        ?? _num((taskChain as any).completed)
        ?? (taskChain as any).metrics
          ? _num(((taskChain as any).metrics || {}).tasksCompleted)
          : null;
    }

    // ── outcomesRecorded — prefer __outcomeHealth, else scan pilot
    const outcomeHealth = _probe('__outcomeHealth');
    let outcomesRecorded: number | null = null;
    if (outcomeHealth && typeof outcomeHealth === 'object') {
      outcomesRecorded = _num((outcomeHealth as any).outcomesRecorded)
        ?? _num((outcomeHealth as any).recorded)
        ?? _num((outcomeHealth as any).count);
    }
    if (outcomesRecorded == null && scanPilotOutcomes != null) {
      outcomesRecorded = scanPilotOutcomes;
    }

    // ── weekly farm reviews generated ────────────────────────────
    const weekly = _probe('__weeklyFarmReviewHealth');
    let weeklyReviewsGenerated: number | null = null;
    if (weekly && typeof weekly === 'object') {
      weeklyReviewsGenerated = _num((weekly as any).weeklyReviewsGenerated)
        ?? _num((weekly as any).reviewsGenerated)
        ?? _num((weekly as any).generated);
    }

    // ── funding views ────────────────────────────────────────────
    const funding = _probe('__fundingHealth');
    let fundingViews: number | null = null;
    if (funding && typeof funding === 'object') {
      fundingViews = _num((funding as any).fundingViews)
        ?? _num((funding as any).views);
    }

    // ── marketplace listings created ─────────────────────────────
    const market = _probe('__marketplaceIntelligenceHealth');
    let listingsCreated: number | null = null;
    if (market && typeof market === 'object') {
      listingsCreated = _num((market as any).listingsCreated)
        ?? _num((market as any).listings);
    }

    // ── post-harvest events ──────────────────────────────────────
    const postHarvest = _probe('__postHarvestHealth');
    let harvestEvents: number | null = null;
    if (postHarvest && typeof postHarvest === 'object') {
      harvestEvents = _num((postHarvest as any).harvestEvents)
        ?? _num((postHarvest as any).events)
        ?? _num((postHarvest as any).harvestsRecorded);
    }

    return Object.freeze<FounderDashboardMetrics>({
      activeFarmers,
      activeGardeners,
      organizations,
      scansToday,
      scansThisWeek,
      tasksCompleted,
      outcomesRecorded,
      followUpScansCompleted,
      weeklyReviewsGenerated,
      fundingViews,
      listingsCreated,
      harvestEvents,
    });
  }, _EMPTY_METRICS);
}

export function founderDashboardReady(): boolean {
  return _safe(() => typeof window !== 'undefined', false);
}

const _FALLBACK_HEALTH: Readonly<FounderDashboardHealthEnvelope> = Object.freeze<FounderDashboardHealthEnvelope>({
  initialized: true as const,
  metrics: _EMPTY_METRICS,
  adminOnly: true as const,
  noFakeMetrics: true as const,
  noPII: true as const,
  composedFrom: Object.freeze([]) as ReadonlyArray<string>,
  confidence: 'low' as Confidence,
  explanation: 'Founder dashboard runtime initialized.',
  limitations: 'Not enough data yet. ' + HONESTY_TAIL,
});

export function founderDashboardHealth(): Readonly<FounderDashboardHealthEnvelope> {
  return _safe(() => {
    const now = _safe(() => (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.timeOrigin + performance.now()
      : NaN, NaN);
    // Use a monotonic-ish nowMs derived from performance.timeOrigin
    // when available; computeFounderDashboard remains pure so a
    // NaN reference simply means no time-windowed counts.
    const metrics = computeFounderDashboard(now);

    const populated = [
      metrics.activeFarmers, metrics.activeGardeners, metrics.organizations,
      metrics.scansToday, metrics.scansThisWeek, metrics.tasksCompleted,
      metrics.outcomesRecorded, metrics.followUpScansCompleted,
      metrics.weeklyReviewsGenerated, metrics.fundingViews,
      metrics.listingsCreated, metrics.harvestEvents,
    ].filter((v) => v != null).length;

    const confidence: Confidence =
      populated >= 6 ? 'high' : populated >= 2 ? 'medium' : 'low';

    return Object.freeze<FounderDashboardHealthEnvelope>({
      initialized: true as const,
      metrics,
      adminOnly: true as const,
      noFakeMetrics: true as const,
      noPII: true as const,
      composedFrom: Object.freeze([
        '__retentionMetrics',
        '__ngoMetrics',
        '__ngoPilotMetrics',
        '__scanPilotMetrics',
        '__taskChainProgressHealth',
        '__outcomeHealth',
        '__fundingHealth',
        '__marketplaceIntelligenceHealth',
        '__postHarvestHealth',
        '__weeklyFarmReviewHealth',
        'localStorage:farroway_event_log',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        'Admin-only founder dashboard composite. Surfaces 12 honest ' +
        'counts (active farmers/gardeners, organizations, scans today/week, ' +
        'tasks completed, outcomes recorded, follow-up scans completed, ' +
        'weekly reviews generated, funding views, listings created, harvest ' +
        'events) composed strictly from existing sibling probes and the ' +
        'persisted farroway_event_log. Any count returns null when its ' +
        'source is unavailable — never a fabricated 0. No PII is read or ' +
        'surfaced (no farmer ids, names, coords, device ids, IPs, phones, ' +
        'or filenames). Time-windowed counts honor a caller-supplied nowMs.',
      limitations:
        'Counts reflect locally available probe data and persisted event ' +
        'logs; missing values mean the upstream source has not been wired ' +
        'or has no data yet, never that the underlying activity is zero. ' +
        HONESTY_TAIL,
    });
  }, _FALLBACK_HEALTH);
}

export function installFounderDashboardGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__founderDashboardHealth !== 'function') {
      w.__founderDashboardHealth = function () {
        const out = founderDashboardHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Founder Dashboard]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
