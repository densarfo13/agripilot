import { create } from 'zustand';
import api from '../api/client.js';
import { enqueue, isOnline } from '../utils/offlineQueue.js';
import { generateUUID, generateOfflineId } from '../utils/generateId.js';

/** Generate an idempotency key for safe retry — delegates to shared UUID utility */
function generateIdempotencyKey() {
  return generateUUID();
}

/** Queue a mutation for later sync if offline */
async function queueIfOffline(method, url, data, { headers = null, entityType = null, actionType = null, idempotencyKey = null } = {}) {
  await enqueue({
    method, url, data,
    ...(headers ? { headers } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actionType ? { actionType } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

function isNetworkError(err) {
  return !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !navigator.onLine);
}

// ─── localStorage cache for offline dashboard rendering ──────
const CACHE_KEY = 'farroway:farmCache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached._ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return cached;
  } catch { return null; }
}

function saveCache(slice) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...slice, _ts: Date.now() }));
  } catch { /* quota exceeded — non-critical */ }
}

const cached = loadCached();

export const useFarmStore = create((set, get) => ({
  // State — hydrate from localStorage cache for offline rendering
  profiles: cached?.profiles || [],
  currentProfile: cached?.currentProfile || null,
  recommendations: cached?.recommendations || [],
  dashboardSummary: cached?.dashboardSummary || null,
  weather: cached?.weather || null,
  weatherRecs: cached?.weatherRecs || null,
  financeScore: cached?.financeScore || null,
  loading: false,
  error: null,
  _fromCache: !!cached, // true if data is stale cache, cleared on first successful fetch

  // Actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Fetch all farm profiles for the current farmer
  fetchProfiles: async () => {
    set({ loading: true, error: null });
    try {
      const r = await api.get('/v1/farms');
      const profiles = r.data.items || [];
      set({ profiles, loading: false, _fromCache: false });
      // Auto-select first profile if none selected
      if (profiles.length > 0 && !get().currentProfile) {
        set({ currentProfile: profiles[0] });
      }
      // Persist to cache for offline rendering
      saveCache({ profiles, currentProfile: get().currentProfile, recommendations: get().recommendations, dashboardSummary: get().dashboardSummary, weather: get().weather, weatherRecs: get().weatherRecs, financeScore: get().financeScore });
      return profiles;
    } catch (err) {
      // If offline and we have cached data, surface it silently
      if (isNetworkError(err) && get().profiles.length > 0) {
        set({ loading: false, _fromCache: true });
        return get().profiles;
      }
      set({ error: err.response?.data?.error || 'Failed to load farm profiles', loading: false });
      return [];
    }
  },

  // Create a new farm profile (with duplicate-submit guard)
  _createInFlight: false,
  createProfile: async (data) => {
    // Prevent duplicate submission from rapid taps/retries
    if (get()._createInFlight) return null;
    set({ _createInFlight: true, loading: true, error: null });
    // Generate idempotency key upfront — reused if queued for offline sync
    const idempotencyKey = generateIdempotencyKey();
    try {
      const r = await api.post('/v1/farms', data, {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      });
      const body = r.data;
      // Atomic setup returns { success, farmProfileComplete, nextRoute, profile }
      const profile = body.profile || body;
      set((s) => ({
        profiles: [profile, ...s.profiles],
        currentProfile: profile,
        loading: false,
        _createInFlight: false,
      }));
      // Return the full response so callers can access farmProfileComplete + nextRoute
      return body.success ? body : profile;
    } catch (err) {
      if (isNetworkError(err)) {
        // Queue for offline sync — include idempotency key for dedup on replay
        await queueIfOffline('POST', '/v1/farms', data, {
          headers: { 'X-Idempotency-Key': idempotencyKey },
          entityType: 'profile',
          actionType: 'create',
          idempotencyKey,
        });
        set({ loading: false, _createInFlight: false, error: 'Saved offline — will sync when reconnected.' });
        return { _offline: true, ...data };
      }
      set({ error: err.response?.data?.error || 'Failed to create farm profile', loading: false, _createInFlight: false });
      return null;
    }
  },

  // Update a farm profile (optimistic + offline queue)
  updateProfile: async (farmId, data) => {
    set({ error: null });
    // Optimistic: apply changes locally immediately
    const prev = get().profiles.find(p => p.id === farmId);
    const optimistic = prev ? { ...prev, ...data } : null;
    if (optimistic) {
      set((s) => ({
        profiles: s.profiles.map(p => p.id === farmId ? optimistic : p),
        currentProfile: s.currentProfile?.id === farmId ? optimistic : s.currentProfile,
      }));
    }
    try {
      const r = await api.patch(`/v1/farms/${farmId}`, data);
      const updated = r.data;
      set((s) => ({
        profiles: s.profiles.map(p => p.id === farmId ? updated : p),
        currentProfile: s.currentProfile?.id === farmId ? updated : s.currentProfile,
      }));
      return updated;
    } catch (err) {
      if (isNetworkError(err)) {
        const key = generateIdempotencyKey();
        await queueIfOffline('PATCH', `/v1/farms/${farmId}`, data, {
          entityType: 'profile',
          actionType: 'update',
          idempotencyKey: key,
        });
        return optimistic; // keep optimistic state
      }
      // Revert optimistic on server error
      if (prev) {
        set((s) => ({
          profiles: s.profiles.map(p => p.id === farmId ? prev : p),
          currentProfile: s.currentProfile?.id === farmId ? prev : s.currentProfile,
        }));
      }
      set({ error: err.response?.data?.error || 'Failed to update farm profile' });
      return null;
    }
  },

  // Fetch a single profile
  fetchProfile: async (farmId) => {
    try {
      const r = await api.get(`/v1/farms/${farmId}`);
      set({ currentProfile: r.data });
      return r.data;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load farm profile' });
      return null;
    }
  },

  // Fetch recommendations for a farm profile
  fetchRecommendations: async (farmId) => {
    try {
      const r = await api.get(`/v1/farms/${farmId}/recommendations`);
      const recs = r.data.items || [];
      set({ recommendations: recs });
      saveCache({ profiles: get().profiles, currentProfile: get().currentProfile, recommendations: recs, dashboardSummary: get().dashboardSummary, weather: get().weather, weatherRecs: get().weatherRecs, financeScore: get().financeScore });
      return recs;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load recommendations' });
      return [];
    }
  },

  // Save a recommendation to history (offline-aware)
  saveRecommendation: async (farmId, data) => {
    try {
      const r = await api.post(`/v1/farms/${farmId}/recommendations`, data);
      set((s) => ({ recommendations: [r.data, ...s.recommendations] }));
      return r.data;
    } catch (err) {
      if (isNetworkError(err)) {
        const key = generateIdempotencyKey();
        await queueIfOffline('POST', `/v1/farms/${farmId}/recommendations`, data, {
          entityType: 'recommendation',
          actionType: 'create',
          idempotencyKey: key,
        });
        // Optimistic: add a placeholder
        const placeholder = { ...data, id: generateOfflineId('rec'), status: 'pending', _offline: true };
        set((s) => ({ recommendations: [placeholder, ...s.recommendations] }));
        return placeholder;
      }
      set({ error: err.response?.data?.error || 'Failed to save recommendation' });
      return null;
    }
  },

  // Update recommendation status (optimistic + offline queue)
  updateRecommendation: async (farmId, recId, data) => {
    // Optimistic update
    const prevRec = get().recommendations.find(r => r.id === recId);
    const optimistic = prevRec ? { ...prevRec, ...data } : null;
    if (optimistic) {
      set((s) => ({
        recommendations: s.recommendations.map(rec => rec.id === recId ? optimistic : rec),
      }));
    }
    try {
      const r = await api.patch(`/v1/farms/${farmId}/recommendations/${recId}`, data);
      set((s) => ({
        recommendations: s.recommendations.map(rec => rec.id === recId ? r.data : rec),
      }));
      return r.data;
    } catch (err) {
      if (isNetworkError(err)) {
        const key = generateIdempotencyKey();
        await queueIfOffline('PATCH', `/v1/farms/${farmId}/recommendations/${recId}`, data, {
          entityType: 'recommendation',
          actionType: 'update',
          idempotencyKey: key,
        });
        return optimistic;
      }
      // Revert
      if (prevRec) {
        set((s) => ({
          recommendations: s.recommendations.map(rec => rec.id === recId ? prevRec : rec),
        }));
      }
      set({ error: err.response?.data?.error || 'Failed to update recommendation' });
      return null;
    }
  },

  // Fetch dashboard summary
  fetchDashboardSummary: async (farmId) => {
    try {
      const r = await api.get(`/v1/farms/${farmId}/dashboard-summary`);
      set({ dashboardSummary: r.data });
      return r.data;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load dashboard summary' });
      return null;
    }
  },

  // Fetch weather for a farm profile
  fetchWeather: async (farmId) => {
    try {
      const r = await api.get(`/v1/farms/${farmId}/weather`);
      set({ weather: r.data });
      return r.data;
    } catch (err) {
      set({ weather: null });
      return null;
    }
  },

  // Fetch weather-enriched recommendations
  fetchWeatherRecs: async (farmId) => {
    try {
      const r = await api.post('/v1/insights/recommend', { farmProfileId: farmId });
      set({ weatherRecs: r.data });
      return r.data;
    } catch (err) {
      set({ weatherRecs: null });
      return null;
    }
  },

  // Fetch finance score for a farm profile
  fetchFinanceScore: async (farmId) => {
    try {
      const r = await api.get(`/v1/farms/${farmId}/finance-score`);
      set({ financeScore: r.data });
      saveCache({ profiles: get().profiles, currentProfile: get().currentProfile, recommendations: get().recommendations, dashboardSummary: get().dashboardSummary, weather: get().weather, weatherRecs: get().weatherRecs, financeScore: r.data });
      return r.data;
    } catch (err) {
      set({ financeScore: null });
      return null;
    }
  },

  // Recalculate finance score
  recalculateFinanceScore: async (farmId) => {
    try {
      const r = await api.post(`/v1/farms/${farmId}/finance-score/recalculate`);
      set({ financeScore: r.data });
      return r.data;
    } catch (err) {
      set({ financeScore: null });
      return null;
    }
  },

  // Submit feedback on a recommendation
  submitRecFeedback: async (farmId, recId, helpful, note) => {
    try {
      await api.post(`/v1/farms/${farmId}/recommendations/${recId}/feedback`, { helpful, note: note || null });
      return true;
    } catch {
      return false;
    }
  },

  // Referral
  referral: null,
  fetchReferral: async () => {
    try {
      const r = await api.get('/v1/referral');
      set({ referral: r.data });
      return r.data;
    } catch {
      set({ referral: null });
      return null;
    }
  },
  applyReferral: async (code) => {
    const r = await api.post('/v1/referral/apply', { code });
    return r.data;
  },

  // Analytics (fire-and-forget)
  trackEvent: async (event, metadata) => {
    try {
      await api.post('/v1/analytics/track', { event, metadata });
    } catch {
      // silent
    }
  },

  // Select a profile
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
}));
