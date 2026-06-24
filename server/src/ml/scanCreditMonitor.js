/**
 * scanCreditMonitor.js — Kindwise scan-credit monitoring (pilot ops).
 *
 * Tracks REMAINING credits for the three Kindwise scan APIs:
 *   • plant.id    (plant identification)   — PLANT_ID_API_KEY / PLANT_API_KEY
 *   • crop.health (crop disease)           — CROP_HEALTH_API_KEY
 *   • insect.id   (insect identification)  — INSECT_ID_API_KEY
 *
 * Each exposes GET https://<host>/api/v3/usage_info (Api-Key header),
 * which returns remaining/used credits WITHOUT consuming identification
 * credits. We poll it (cached), classify an alert level, record a daily
 * snapshot, and compute a daily burn rate + estimated days remaining.
 *
 * Why this exists: if credits hit zero mid-pilot, EVERY scan silently
 * returns "service temporarily unavailable" and First Scan % craters.
 * This turns that silent outage into a visible, days-ahead warning.
 *
 * Strict rules
 *   • Never throws. Never fabricates a number — an unreachable/unconfigured
 *     provider returns honest null, not 0.
 *   • Never logs or returns the key value (only presence + first-6 fp).
 *   • usage_info is read-only; it does not spend credits.
 */

import fs from 'node:fs';
import path from 'node:path';

const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000;     // poll Kindwise at most every 30 min
const SNAPSHOT_MIN_GAP_MS = 60 * 60 * 1000; // record a history point at most hourly
const SNAPSHOT_MAX = 240;                 // ~10 days of hourly points
const HISTORY_FILE = process.env.SCAN_CREDIT_HISTORY_FILE
  || path.join(process.cwd(), '.cache', 'scan-credit-history.json');

// Alert thresholds (remaining credits).
export const CREDIT_THRESHOLDS = Object.freeze({ low: 100, warning: 50, critical: 20 });

const PROVIDERS = Object.freeze([
  { id: 'plantid',    label: 'Plant.id',     host: 'plant.id',
    envVars: ['PLANT_ID_API_KEY', 'PLANT_API_KEY'] },
  { id: 'crophealth', label: 'Crop.health',  host: 'crop.health',
    envVars: ['CROP_HEALTH_API_KEY', 'CROPHEALTH_API_KEY'] },
  { id: 'insectid',   label: 'Insect.id',    host: 'insect.id',
    envVars: ['INSECT_ID_API_KEY', 'INSECTID_API_KEY'] },
]);

function _fingerprint(v) {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, 6) : null;
}
function _resolveKey(p) {
  for (const name of p.envVars) {
    const v = (process.env[name] || '').trim();
    if (v) return { key: v, envVarUsed: name };
  }
  return { key: '', envVarUsed: null };
}
function _num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// Parse the Kindwise usage_info JSON defensively across shape variants.
function _parseUsage(json) {
  const out = { remaining: null, used: null, limit: null, active: null };
  if (!json || typeof json !== 'object') return out;
  out.active = typeof json.active === 'boolean' ? json.active : null;
  const rem = json.remaining || {};
  const used = json.used || {};
  const lim = json.credit_limits || json.credit_limit || {};
  out.remaining = _num(rem.total) ?? _num(json.remaining_total) ?? _num(json.credits_remaining);
  out.used      = _num(used.total) ?? _num(json.used_total);
  out.limit     = _num(lim.total)  ?? _num(json.credit_limit) ?? _num(json.total);
  // Derive remaining from limit - used when the API omits it.
  if (out.remaining == null && out.limit != null && out.used != null) {
    out.remaining = Math.max(0, out.limit - out.used);
  }
  return out;
}

function _alertLevel(remaining, configured, reachable) {
  if (!configured) return 'unconfigured';
  if (!reachable || remaining == null) return 'unknown';
  if (remaining < CREDIT_THRESHOLDS.critical) return 'critical'; // < 20
  if (remaining < CREDIT_THRESHOLDS.warning) return 'warning';   // < 50
  if (remaining < CREDIT_THRESHOLDS.low) return 'low';           // < 100
  return 'ok';
}

async function _fetchProvider(p) {
  const { key, envVarUsed } = _resolveKey(p);
  const base = {
    id: p.id, label: p.label, host: p.host,
    configured: !!key, envVarUsed, keyFingerprint: _fingerprint(key),
    httpStatus: null, remaining: null, used: null, limit: null,
    active: null, reachable: false, error: null,
  };
  if (!key) { base.error = 'not_configured'; return base; }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://' + p.host + '/api/v3/usage_info', {
      method: 'GET', headers: { 'Api-Key': key }, signal: ctrl.signal,
    });
    clearTimeout(t);
    base.httpStatus = res.status;
    if (!res.ok) { base.error = 'provider_http_' + res.status; return base; }
    let json = null;
    try { json = await res.json(); } catch { base.error = 'bad_json'; return base; }
    const u = _parseUsage(json);
    base.remaining = u.remaining; base.used = u.used; base.limit = u.limit;
    base.active = u.active; base.reachable = true;
    return base;
  } catch (err) {
    clearTimeout(t);
    base.error = (err && err.name === 'AbortError') ? 'timeout' : 'fetch_error';
    return base;
  } finally { clearTimeout(t); }
}

// ── Snapshot history (best-effort durable; logs are the true record) ──
function _readHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _writeHistory(arr) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr.slice(-SNAPSHOT_MAX)));
  } catch { /* ephemeral FS — logs remain the durable record */ }
}
function _recordSnapshot(providers, nowMs, nowIso) {
  const hist = _readHistory();
  const last = hist[hist.length - 1];
  if (last && (nowMs - (last.t || 0)) < SNAPSHOT_MIN_GAP_MS) return hist; // throttle
  const point = { t: nowMs, at: nowIso, credits: {} };
  for (const pr of providers) {
    if (pr.reachable && pr.remaining != null) {
      point.credits[pr.id] = { remaining: pr.remaining, used: pr.used };
    }
  }
  if (Object.keys(point.credits).length === 0) return hist; // nothing real to store
  hist.push(point);
  const trimmed = hist.slice(-SNAPSHOT_MAX);
  _writeHistory(trimmed);
  return trimmed;
}

// Daily burn + days remaining from the oldest usable snapshot (≥ ~20h old).
function _burn(providerId, remainingNow, usedNow, history) {
  const MIN_SPAN_MS = 20 * 60 * 60 * 1000;
  const nowT = history.length ? history[history.length - 1].t : Date.now();
  let anchor = null;
  for (const h of history) {
    const c = h.credits && h.credits[providerId];
    if (c && (nowT - h.t) >= MIN_SPAN_MS) { anchor = { ...c, t: h.t }; break; }
  }
  if (!anchor) return { dailyBurn: null, daysRemaining: null, basisHours: null };
  const spanDays = (nowT - anchor.t) / (24 * 60 * 60 * 1000);
  if (spanDays <= 0) return { dailyBurn: null, daysRemaining: null, basisHours: null };
  // Prefer the monotonic `used` delta; fall back to the remaining drop.
  let consumed = null;
  if (usedNow != null && anchor.used != null) consumed = usedNow - anchor.used;
  else if (remainingNow != null && anchor.remaining != null) consumed = anchor.remaining - remainingNow;
  if (consumed == null || consumed < 0) consumed = 0;
  const dailyBurn = Math.round((consumed / spanDays) * 10) / 10;
  const daysRemaining = (dailyBurn > 0 && remainingNow != null)
    ? Math.round((remainingNow / dailyBurn) * 10) / 10 : null;
  return { dailyBurn, daysRemaining, basisHours: Math.round((nowT - anchor.t) / 3.6e6) };
}

let _cache = null; // { at, data }

/** Force a fresh poll (ignores cache). */
export async function refreshScanCredits() {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const providers = [];
  for (const p of PROVIDERS) providers.push(await _fetchProvider(p)); // sequential — gentle on the API
  const history = _recordSnapshot(providers, nowMs, nowIso);

  const enriched = providers.map((pr) => {
    const alertLevel = _alertLevel(pr.remaining, pr.configured, pr.reachable);
    const b = _burn(pr.id, pr.remaining, pr.used, history);
    // Structured daily-ish log line — durable record even if the FS resets.
    console.log('[scan.credits]', pr.id,
      'configured=' + pr.configured,
      'remaining=' + (pr.remaining == null ? 'n/a' : pr.remaining),
      'used=' + (pr.used == null ? 'n/a' : pr.used),
      'dailyBurn=' + (b.dailyBurn == null ? 'n/a' : b.dailyBurn),
      'daysLeft=' + (b.daysRemaining == null ? 'n/a' : b.daysRemaining),
      'alert=' + alertLevel);
    if (alertLevel === 'critical' || alertLevel === 'warning' || alertLevel === 'low') {
      console.warn('[scan.credits.ALERT]', pr.id, 'remaining=' + pr.remaining,
        'level=' + alertLevel + ' (<' + CREDIT_THRESHOLDS[alertLevel === 'low' ? 'low' : alertLevel] + ')');
    }
    return { ...pr, alertLevel, dailyBurn: b.dailyBurn, daysRemaining: b.daysRemaining,
      burnBasisHours: b.basisHours };
  });

  const levels = enriched.map((e) => e.alertLevel);
  const worst = levels.includes('critical') ? 'critical'
    : levels.includes('warning') ? 'warning'
    : levels.includes('low') ? 'low'
    : levels.includes('unknown') ? 'unknown'
    : levels.every((l) => l === 'unconfigured') ? 'unconfigured' : 'ok';

  const data = Object.freeze({
    generatedAt: nowIso,
    thresholds: CREDIT_THRESHOLDS,
    worstAlert: worst,
    historyPoints: history.length,
    providers: Object.freeze(enriched.map((e) => Object.freeze(e))),
  });
  _cache = { at: nowMs, data };
  return data;
}

/** Cached read (polls Kindwise at most every 30 min). */
export async function getScanCredits() {
  if (_cache && (Date.now() - _cache.at) < CACHE_TTL_MS) return _cache.data;
  try { return await refreshScanCredits(); }
  catch {
    if (_cache) return _cache.data;
    return Object.freeze({ generatedAt: new Date().toISOString(), thresholds: CREDIT_THRESHOLDS,
      worstAlert: 'unknown', historyPoints: 0, providers: [] });
  }
}

export const _internal = Object.freeze({ _parseUsage, _alertLevel, _burn, PROVIDERS });
