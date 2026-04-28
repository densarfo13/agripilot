/**
 * ngoApi.js — frontend client for the NGO dashboard
 * read endpoints.
 *
 *   getSummary({ region? })   -> headline counts + clusters count
 *   getRegions()              -> per-region breakdown
 *   getClusters({ region? })  -> active outbreak clusters
 *   getFarms()                -> farm points for the map (optional)
 *
 * All four go through the existing `api` client so they
 * inherit the auth-cookie + 401-refresh handling shipped in
 * src/api/client.js. Each function NEVER throws on a network
 * or server failure — they return safe-default shapes
 * (`null` / `[]`) so the dashboard's render path keeps working
 * when one endpoint is briefly down.
 *
 * Strict-rule audit
 *   * Never throws — every fetch wrapped in try/catch with a
 *     calm fallback so a 4xx/5xx never blows up the dashboard.
 *   * No org_id / user_id parameters — the backend reads those
 *     off the JWT. Clients can't smuggle scope.
 *   * /ngo/farms is NEW (added in same change-set as the
 *     server-side route). When the server returns 404
 *     (deployment lag) the client treats it as an empty list
 *     and the map renders the fallback message — no crash,
 *     no error toast.
 */

import api from './client.js';

function _safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * getSummary({ region }) -> server payload OR null on failure.
 * Caller treats null as "render zero-state" and shows the
 * existing skeleton until the next refresh.
 */
export async function getSummary({ region } = {}) {
  try {
    const params = region ? { params: { region } } : undefined;
    const res = await api.get('/ngo/summary', params);
    return (res && res.data) ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * getRegions() -> Array<RegionRow>. Empty on failure so the
 * dashboard's region table renders an empty body without
 * crashing.
 */
export async function getRegions() {
  try {
    const res = await api.get('/ngo/regions');
    if (res && res.data && Array.isArray(res.data.rows)) {
      return res.data.rows;
    }
    return _safeArray(res && res.data);
  } catch {
    return [];
  }
}

/**
 * getClusters({ region }) -> Array<Cluster>. Empty on failure.
 */
export async function getClusters({ region } = {}) {
  try {
    const params = region ? { params: { region } } : undefined;
    const res = await api.get('/ngo/clusters', params);
    if (res && res.data && Array.isArray(res.data.clusters)) {
      return res.data.clusters;
    }
    return _safeArray(res && res.data);
  } catch {
    return [];
  }
}

/**
 * getFarms() -> Array<{ id, farmerId, crop, location, riskLevel }>
 *
 * The /ngo/farms endpoint is NEW; this helper falls back to
 * an empty array on ANY failure (404 during a deployment lag,
 * 5xx blip, network error). The map component renders the
 * fallback message in that case so the dashboard's other
 * sections (summary cards, region table, cluster list) keep
 * working. The brief explicitly calls this out:
 *
 *   "If /ngo/farms does not exist yet:
 *    - do NOT crash
 *    - return [] on failure"
 */
export async function getFarms() {
  try {
    const res = await api.get('/ngo/farms');
    if (res && res.data && Array.isArray(res.data.farms)) {
      return res.data.farms;
    }
    return _safeArray(res && res.data);
  } catch {
    return [];
  }
}

export default { getSummary, getRegions, getClusters, getFarms };
