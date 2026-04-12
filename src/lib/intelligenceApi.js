/**
 * Intelligence API helpers — pest risk, hotspots, alerts, treatment tracking.
 *
 * Follows the same request pattern as api.js but scoped to /api/v2/pest-risk.
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

// ─── Pest Image Upload ───────────────────────────────────────
export function uploadPestImage({ profileId, imageType, imageUrl, gpsLat, gpsLng, metadata }) {
  return request('/api/v2/pest-risk/images', {
    method: 'POST',
    body: JSON.stringify({ profileId, imageType, imageUrl, gpsLat, gpsLng, metadata }),
  });
}

// ─── Pest Report ─────────────────────────────────────────────
export function createPestReport({ profileId, imageIds, cropCycleId, verificationAnswers, notes }) {
  return request('/api/v2/pest-risk/report', {
    method: 'POST',
    body: JSON.stringify({ profileId, imageIds, cropCycleId, verificationAnswers, notes }),
  });
}

// ─── Farm Risk ───────────────────────────────────────────────
export function getFarmRisk(profileId) {
  return request(`/api/v2/pest-risk/farms/${profileId}/risk`);
}

// ─── Farm Hotspots ───────────────────────────────────────────
export function getFarmHotspots(profileId) {
  return request(`/api/v2/pest-risk/farms/${profileId}/hotspots`);
}

// ─── My Alerts ───────────────────────────────────────────────
export function getMyAlerts() {
  return request('/api/v2/pest-risk/alerts/me');
}

// ─── Diagnosis Feedback ──────────────────────────────────────
export function submitDiagnosisFeedback(reportId, feedback) {
  return request(`/api/v2/pest-risk/reports/${reportId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

// ─── Treatment Logging ───────────────────────────────────────
export function logTreatment(reportId, data) {
  return request(`/api/v2/pest-risk/reports/${reportId}/treatment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Treatment Outcome ───────────────────────────────────────
export function logTreatmentOutcome(treatmentId, data) {
  return request(`/api/v2/pest-risk/treatments/${treatmentId}/outcome`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
