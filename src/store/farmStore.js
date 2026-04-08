import { create } from 'zustand';
import api from '../api/client.js';

export const useFarmStore = create((set, get) => ({
  // State
  profiles: [],
  currentProfile: null,
  recommendations: [],
  dashboardSummary: null,
  weather: null,
  weatherRecs: null,
  financeScore: null,
  loading: false,
  error: null,

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
      set({ profiles, loading: false });
      // Auto-select first profile if none selected
      if (profiles.length > 0 && !get().currentProfile) {
        set({ currentProfile: profiles[0] });
      }
      return profiles;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load farm profiles', loading: false });
      return [];
    }
  },

  // Create a new farm profile
  createProfile: async (data) => {
    set({ loading: true, error: null });
    try {
      const r = await api.post('/v1/farms', data);
      const profile = r.data;
      set((s) => ({
        profiles: [profile, ...s.profiles],
        currentProfile: profile,
        loading: false,
      }));
      return profile;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to create farm profile', loading: false });
      return null;
    }
  },

  // Update a farm profile
  updateProfile: async (farmId, data) => {
    set({ error: null });
    try {
      const r = await api.patch(`/v1/farms/${farmId}`, data);
      const updated = r.data;
      set((s) => ({
        profiles: s.profiles.map(p => p.id === farmId ? updated : p),
        currentProfile: s.currentProfile?.id === farmId ? updated : s.currentProfile,
      }));
      return updated;
    } catch (err) {
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
      set({ recommendations: r.data.items || [] });
      return r.data.items || [];
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load recommendations' });
      return [];
    }
  },

  // Save a recommendation to history
  saveRecommendation: async (farmId, data) => {
    try {
      const r = await api.post(`/v1/farms/${farmId}/recommendations`, data);
      set((s) => ({ recommendations: [r.data, ...s.recommendations] }));
      return r.data;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to save recommendation' });
      return null;
    }
  },

  // Update recommendation status (complete/skip with optional note)
  updateRecommendation: async (farmId, recId, data) => {
    try {
      const r = await api.patch(`/v1/farms/${farmId}/recommendations/${recId}`, data);
      set((s) => ({
        recommendations: s.recommendations.map(rec => rec.id === recId ? r.data : rec),
      }));
      return r.data;
    } catch (err) {
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
