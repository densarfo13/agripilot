/**
 * Intelligence Admin API helpers — regional risk, outbreak clusters,
 * high-risk farms, hotspots, alerts, interventions, ingestion & scoring.
 */

import { classifyAdminApiError } from './intelligenceAdminError.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// 2026-07-05 fix: these calls previously sent ONLY the httpOnly cookie (credentials:
// 'include') and NO Authorization header — the sole outlier in the app, where every other
// admin call attaches the Bearer token from the store. When the admin is authenticated by
// token (no cookie), the server saw no credentials → 401/403 → the UI showed "Session
// expired". We now ALSO send the Bearer token (canonical `farroway_token`), matching the
// rest of the app, while keeping the cookie for cookie-auth sessions.
function _authHeader() {
  try {
    const tok = typeof localStorage !== 'undefined' ? localStorage.getItem('farroway_token') : null;
    return tok ? { Authorization: 'Bearer ' + tok } : {};
  } catch { return {}; }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ..._authHeader(),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Propagate the REAL status so callers distinguish 401 (session expired) from 403
    // (access denied) — no more text pattern-matching. The message stays farmer-invisible;
    // this is an admin surface.
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.errorType = classifyAdminApiError(res.status);
    err.body = body;
    throw err;
  }

  return res.json();
}

// ─── Admin Read Endpoints ───────────────────────────────────

export function getRegionalRisk() {
  return request('/api/v2/intelligence-admin/regions/risk');
}

export function getOutbreakClusters(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/outbreak-clusters${q ? `?${q}` : ''}`);
}

export function getHighRiskFarms(page = 1, limit = 20) {
  return request(`/api/v2/intelligence-admin/farms/high-risk?page=${page}&limit=${limit}`);
}

export function getAdminHotspots(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/hotspots${q ? `?${q}` : ''}`);
}

export function getAdminAlerts(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/alerts${q ? `?${q}` : ''}`);
}

export function getInterventionEffectiveness() {
  return request('/api/v2/intelligence-admin/interventions/effectiveness');
}

// ─── Admin Queue Endpoints ──────────────────────────────────

export function getQueueSummary() {
  return request('/api/v2/intelligence-admin/queues/summary');
}

export function getFalsePositiveQueue(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/queues/false-positive${q ? `?${q}` : ''}`);
}

export function getBoundaryReviewQueue(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/queues/boundary-review${q ? `?${q}` : ''}`);
}

export function getAlertReviewQueue(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`/api/v2/intelligence-admin/queues/alert-review${q ? `?${q}` : ''}`);
}

export function autoValidateBoundary(boundaryId) {
  return request(`/api/v2/intelligence-admin/boundaries/${boundaryId}/auto-validate`, {
    method: 'POST',
  });
}

// ─── Admin Write Endpoints ──────────────────────────────────

export function validateBoundary(profileId, data) {
  return request(`/api/v2/intelligence-admin/boundaries/${profileId}/validate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function reviewPestReport(reportId, data) {
  return request(`/api/v2/intelligence-admin/reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function suppressAlert(alertId, reason) {
  return request(`/api/v2/intelligence-admin/alerts/${alertId}/suppress`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function updateHotspotStatus(hotspotId, status) {
  return request(`/api/v2/intelligence-admin/hotspots/${hotspotId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ─── Ingestion Endpoints ────────────────────────────────────

export function ingestSatelliteScan(data) {
  return request('/api/v2/intelligence-ingest/satellite/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function ingestDroneScan(data) {
  return request('/api/v2/intelligence-ingest/drone/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Scoring Endpoints ──────────────────────────────────────

export function triggerFarmScoring(profileId) {
  return request('/api/v2/intelligence-ingest/score/farm', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export function triggerRegionScoring(regionKey) {
  return request('/api/v2/intelligence-ingest/score/region', {
    method: 'POST',
    body: JSON.stringify({ regionKey }),
  });
}
