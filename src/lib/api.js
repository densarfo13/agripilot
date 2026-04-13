const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function parseJson(res) {
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = res.status;
    err.fieldErrors = data?.fieldErrors || {};
    throw err;
  }

  return data;
}

async function request(path, options = {}, allowRefresh = true) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401 && allowRefresh) {
    const refreshRes = await fetch(`${API_BASE}/api/v2/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (refreshRes.ok) {
      return request(path, options, false);
    }
  }

  return parseJson(res);
}

export function registerUser(payload) {
  return request('/api/v2/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return request('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return request('/api/v2/auth/logout', {
    method: 'POST',
  }, false);
}

export function getCurrentUser() {
  return request('/api/v2/auth/me');
}

export function verifyEmail(token) {
  return request('/api/v2/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }, false);
}

export function resendVerification() {
  return request('/api/v2/auth/resend-verification', {
    method: 'POST',
  });
}

export function forgotPassword(payload) {
  return request('/api/v2/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

export function resetPassword(payload) {
  return request('/api/v2/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

export function getFarmProfile() {
  return request('/api/v2/farm-profile');
}

export function saveFarmProfile(payload, { headers } = {}) {
  return request('/api/v2/farm-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: headers || {},
  });
}

// ─── Multi-Farm Support ─────────────────────────────────
export function getFarms() {
  return request('/api/v2/farm-profile/list');
}

export function createNewFarm(payload) {
  return request('/api/v2/farm-profile/new', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function switchActiveFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/activate`, {
    method: 'POST',
  });
}

export function setDefaultFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/set-default`, {
    method: 'POST',
  });
}

export function deactivateFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/deactivate`, {
    method: 'POST',
  });
}

export function archiveFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/archive`, {
    method: 'POST',
  });
}

export function getCurrentWeather({ lat, lng, location } = {}) {
  const params = new URLSearchParams();
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  if (location) params.set('location', location);
  return request(`/api/v2/weather/current?${params.toString()}`);
}

export function getActiveSeason() {
  return request('/api/v2/seasons/active');
}

export function startSeason(payload) {
  return request('/api/v2/seasons/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completeSeason(seasonId) {
  return request(`/api/v2/seasons/${seasonId}/complete`, {
    method: 'POST',
  });
}

export function completeTask(taskId) {
  return request(`/api/v2/tasks/${taskId}/complete`, {
    method: 'POST',
  });
}

export function trackEvent(event, metadata) {
  return request('/api/v2/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ event, metadata }),
  });
}

/**
 * Fire-and-forget pilot event tracker.
 * Logs to the analytics endpoint but never throws or blocks the caller.
 */
export function trackPilotEvent(event, metadata = {}) {
  try {
    request('/api/v2/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event, metadata, source: 'pilot' }),
    }).catch(() => {});
  } catch {
    // silently ignore — analytics must never block the UI
  }
}

export function createSupportRequest(payload) {
  return request('/api/v2/support/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function healthCheck() {
  return request('/api/v2/monitoring/health', { method: 'GET' }, false);
}

// ─── Land Boundaries ──────────────────────────────────────────
export function getLandBoundaries() {
  return request('/api/v2/land-boundaries');
}

export function saveLandBoundary(payload) {
  return request('/api/v2/land-boundaries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteLandBoundary(id) {
  return request(`/api/v2/land-boundaries/${id}`, { method: 'DELETE' });
}

// ─── Seed Scans ───────────────────────────────────────────────
export function getSeedScans() {
  return request('/api/v2/seed-scans');
}

export function saveSeedScan(payload) {
  return request('/api/v2/seed-scans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Verification Signals ─────────────────────────────────────
export function getVerificationSignals() {
  return request('/api/v2/verification-signals');
}

// ─── Supply Readiness ────────────────────────────────────────
export function getMySupplyReadiness() {
  return request('/api/v2/supply-readiness/mine');
}

export function saveSupplyReadiness(payload) {
  return request('/api/v2/supply-readiness/mine', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAdminSupplyList(params = {}) {
  const qs = new URLSearchParams();
  if (params.readyOnly) qs.set('readyOnly', 'true');
  if (params.crop) qs.set('crop', params.crop);
  const q = qs.toString();
  return request(`/api/v2/supply-readiness/admin/list${q ? '?' + q : ''}`);
}

export function connectSupplyToBuyer(id) {
  return request(`/api/v2/supply-readiness/admin/${id}/connect`, { method: 'POST' });
}

export function exportSupplyCSV(params = {}) {
  const qs = new URLSearchParams();
  if (params.readyOnly) qs.set('readyOnly', 'true');
  const q = qs.toString();
  // Returns raw fetch for CSV download
  return fetch(`${API_BASE}/api/v2/supply-readiness/admin/export.csv${q ? '?' + q : ''}`, {
    credentials: 'include',
  });
}

// ─── Buyers (admin) ──────────────────────────────────────────
export function getBuyers(params = {}) {
  const qs = new URLSearchParams();
  if (params.crop) qs.set('crop', params.crop);
  if (params.search) qs.set('search', params.search);
  const q = qs.toString();
  return request(`/api/v2/buyers${q ? '?' + q : ''}`);
}

export function getBuyer(id) {
  return request(`/api/v2/buyers/${id}`);
}

export function createBuyer(payload) {
  return request('/api/v2/buyers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBuyer(id, payload) {
  return request(`/api/v2/buyers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ─── Buyer Links (admin) ─────────────────────────────────────
export function getBuyerLinks(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.supplyId) qs.set('supplyId', params.supplyId);
  if (params.buyerId) qs.set('buyerId', params.buyerId);
  const q = qs.toString();
  return request(`/api/v2/buyer-links${q ? '?' + q : ''}`);
}

export function createBuyerLink(payload) {
  return request('/api/v2/buyer-links', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBuyerLink(id, payload) {
  return request(`/api/v2/buyer-links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function exportBuyerLinksCSV(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return fetch(`${API_BASE}/api/v2/buyer-links/export.csv${q ? '?' + q : ''}`, {
    credentials: 'include',
  });
}
