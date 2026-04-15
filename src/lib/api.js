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

// ─── Refresh lock ─────────────────────────────────────────
// Prevents multiple concurrent 401 responses from each triggering
// their own /refresh call. The first 401 acquires the lock, refreshes,
// and all other waiters reuse the same refresh result.
let _refreshPromise = null;

async function refreshOnce() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = fetch(`${API_BASE}/api/v2/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function request(path, options = {}, allowRefresh = true) {
  // Destructure headers out so ...rest doesn't overwrite the merged headers
  const { headers: optHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(optHeaders || {}),
    },
  });

  if (res.status === 401 && allowRefresh) {
    const refreshRes = await refreshOnce();

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
  }, false); // login 401 = wrong password, not an expired session
}

export function verifyMfaCode(payload) {
  return request('/api/v2/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
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

export function saveFarmerType(farmerType) {
  return request('/api/v2/farm-profile/farmer-type', {
    method: 'POST',
    body: JSON.stringify({ farmerType }),
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

// Task engine version — bump to invalidate cached tasks and force regeneration.
// Incrementing this causes the server to regenerate tasks instead of serving stale cache.
const TASK_ENGINE_VERSION = 2;

export function getFarmTasks(farmId, stage) {
  const params = new URLSearchParams();
  if (stage) params.set('stage', stage);
  params.set('v', String(TASK_ENGINE_VERSION));
  const qs = params.toString();
  return request(`/api/v2/farm-tasks/${farmId}/tasks?${qs}`);
}

export function completeTask(farmId, taskId, body = {}) {
  return request(`/api/v2/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateFarm(farmId, payload) {
  return request(`/api/v2/farm-profile/${farmId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateCropStage(farmId, cropStage, plantedAt) {
  const body = { cropStage };
  if (plantedAt !== undefined) body.plantedAt = plantedAt;
  return request(`/api/v2/farm-profile/${farmId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getFarmStage(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/stage`);
}

export function getSeasonalTiming(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/seasonal-timing`);
}

export function updateSeasonalTiming(farmId, payload) {
  return request(`/api/v2/farm-profile/${farmId}/seasonal-timing`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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

export function getFarmWeather(farmId) {
  return request(`/api/v2/farm-weather/${encodeURIComponent(farmId)}`);
}

export function getFarmRisks(farmId) {
  return request(`/api/v2/farm-risks/${encodeURIComponent(farmId)}`);
}

export function getFarmInputs(farmId) {
  return request(`/api/v2/farm-inputs/${encodeURIComponent(farmId)}`);
}

export function getFarmHarvest(farmId) {
  return request(`/api/v2/farm-harvest/${encodeURIComponent(farmId)}`);
}

// ─── Harvest Records (yield logging) ─────────────────────
export function getHarvestRecords(farmId) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(farmId)}`);
}

export function createHarvestRecord(payload) {
  return request('/api/v2/harvest-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHarvestRecord(id, payload) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteHarvestRecord(id) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Farm Costs (expense tracking) ───────────────────────
export function getFarmCosts(farmId) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(farmId)}`);
}

export function createFarmCost(payload) {
  return request('/api/v2/farm-costs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateFarmCost(id, payload) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteFarmCost(id) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getFarmEconomics(farmId) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(farmId)}/economics`);
}

// ─── Weekly Summary (decision digest) ───────────────────
export function getWeeklySummary(farmId) {
  return request(`/api/v2/weekly-summary/${encodeURIComponent(farmId)}`);
}

// ─── Farm Benchmarks (season-over-season) ────────────────
export function getFarmBenchmarks(farmId, mode = 'season') {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : '';
  return request(`/api/v2/farm-benchmarks/${encodeURIComponent(farmId)}${qs}`);
}

export function getActiveSeason(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/seasons/active${qs}`);
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

// Legacy completeTask (V2Task model) — kept for backward compat
export function completeV2Task(taskId) {
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
export function getLandBoundaries(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/land-boundaries${qs}`);
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
export function getSeedScans(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/seed-scans${qs}`);
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

// ─── Buyer Trust (buyer-ready farm view) ────────────────────────
export function getBuyerTrustFarms(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return request(`/api/v2/buyer-trust/farms${q ? '?' + q : ''}`);
}

export function getBuyerTrustFarm(farmerId) {
  return request(`/api/v2/buyer-trust/farms/${farmerId}`);
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
