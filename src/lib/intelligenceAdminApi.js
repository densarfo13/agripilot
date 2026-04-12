/**
 * Intelligence Admin API helpers — regional risk, outbreak clusters,
 * high-risk farms, hotspots, alerts, interventions, ingestion & scoring.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
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
