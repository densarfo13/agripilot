import { create } from 'zustand';
import {
  getFarmRisk, getFarmHotspots, getMyAlerts,
  uploadPestImage, createPestReport,
  submitDiagnosisFeedback, logTreatment, logTreatmentOutcome,
} from '../lib/intelligenceApi.js';
import {
  getRegionalRisk, getOutbreakClusters, getHighRiskFarms,
  getAdminHotspots, getAdminAlerts, getInterventionEffectiveness,
  suppressAlert as apiSuppressAlert,
  updateHotspotStatus as apiUpdateHotspotStatus,
  reviewPestReport as apiReviewPestReport,
  triggerFarmScoring, triggerRegionScoring,
} from '../lib/intelligenceAdminApi.js';
import { logActivity } from '../services/activityLogger.js';

// ─── localStorage cache ──────────────────────────────
const CACHE_KEY = 'farroway:intel';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c._ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return c;
  } catch { return null; }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch { /* quota */ }
}

const cached = loadCached();

// ─── Helper: async action wrapper ────────────────────
function asyncAction(set, key, fn) {
  set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));
  return fn()
    .then(result => {
      set(s => ({ loading: { ...s.loading, [key]: false } }));
      return result;
    })
    .catch(err => {
      const msg = err?.message || 'Something went wrong';
      set(s => ({ loading: { ...s.loading, [key]: false }, errors: { ...s.errors, [key]: msg } }));
      throw err;
    });
}

export const useIntelligenceStore = create((set, get) => ({
  // ─── Farmer state ────────────────────────────
  farmRisk: cached?.farmRisk || null,
  hotspots: cached?.hotspots || [],
  alerts: cached?.alerts || [],
  pestReportResult: null,

  // ─── Admin state ─────────────────────────────
  regionalRisk: [],
  outbreakClusters: [],
  highRiskFarms: [],
  adminHotspots: [],
  adminAlerts: { data: [], pagination: null },
  interventionData: null,

  // ─── UI state ────────────────────────────────
  loading: {},
  errors: {},

  // ─── Farmer actions ──────────────────────────
  fetchFarmRisk: (profileId) => asyncAction(set, 'farmRisk', async () => {
    const raw = await getFarmRisk(profileId);
    const data = raw?.data || raw;
    set({ farmRisk: data });
    saveCache({ ...get(), farmRisk: data });
    return data;
  }),

  fetchHotspots: (profileId) => asyncAction(set, 'hotspots', async () => {
    const data = await getFarmHotspots(profileId);
    const list = data?.hotspots || data?.data || (Array.isArray(data) ? data : []);
    set({ hotspots: list });
    saveCache({ ...get(), hotspots: list });
    return list;
  }),

  fetchAlerts: () => asyncAction(set, 'alerts', async () => {
    const data = await getMyAlerts();
    const list = data?.alerts || data?.data || (Array.isArray(data) ? data : []);
    set({ alerts: list });
    return list;
  }),

  submitPestReport: (images, reportData) => asyncAction(set, 'pestReport', async () => {
    // 1. Upload images — API wraps response in { data: { imageId } }
    const imageIds = [];
    for (const img of images) {
      const res = await uploadPestImage(img);
      const unwrapped = res?.data || res;
      imageIds.push(unwrapped.imageId || unwrapped.id);
    }
    // 2. Create report with image IDs — API wraps in { data: { reportId, ... } }
    const raw = await createPestReport({ ...reportData, imageIds });
    const report = raw?.data || raw;
    set({ pestReportResult: report });
    logActivity('pest_report_submitted', { reportId: report?.reportId || report?.id }, { farmId: reportData?.farmId });
    return report;
  }),

  submitFeedback: (reportId, feedback) =>
    asyncAction(set, 'feedback', async () => {
      const raw = await submitDiagnosisFeedback(reportId, feedback);
      return raw?.data || raw;
    }),

  submitTreatment: (reportId, data) =>
    asyncAction(set, 'treatment', async () => {
      const raw = await logTreatment(reportId, data);
      return raw?.data || raw;
    }),

  submitOutcome: (treatmentId, data) =>
    asyncAction(set, 'outcome', async () => {
      const raw = await logTreatmentOutcome(treatmentId, data);
      return raw?.data || raw;
    }),

  // ─── Admin actions ───────────────────────────
  fetchRegionalRisk: () => asyncAction(set, 'regionalRisk', async () => {
    const [regions, clusters] = await Promise.all([getRegionalRisk(), getOutbreakClusters()]);
    const regionList = regions?.data || (Array.isArray(regions) ? regions : []);
    const clusterList = clusters?.data || (Array.isArray(clusters) ? clusters : []);
    set({ regionalRisk: regionList, outbreakClusters: clusterList });
    return { regions: regionList, clusters: clusterList };
  }),

  fetchHighRiskFarms: (params = {}) => asyncAction(set, 'highRiskFarms', async () => {
    const data = await getHighRiskFarms(params);
    const list = data?.data || (Array.isArray(data) ? data : []);
    set({ highRiskFarms: list });
    return data;
  }),

  fetchAdminHotspots: (params = {}) => asyncAction(set, 'adminHotspots', async () => {
    const data = await getAdminHotspots(params);
    const list = data?.data || (Array.isArray(data) ? data : []);
    set({ adminHotspots: list });
    return list;
  }),

  fetchAdminAlerts: (params = {}) => asyncAction(set, 'adminAlerts', async () => {
    const data = await getAdminAlerts(params);
    set({ adminAlerts: { data: data?.data || [], pagination: data?.pagination || null } });
    return data;
  }),

  fetchInterventionData: () => asyncAction(set, 'interventions', async () => {
    const data = await getInterventionEffectiveness();
    const result = data?.data || data;
    set({ interventionData: result });
    return result;
  }),

  suppressAlert: (alertId, reason) => asyncAction(set, 'suppressAlert', async () => {
    const result = await apiSuppressAlert(alertId, reason);
    // Update local state
    set(s => ({
      adminAlerts: {
        ...s.adminAlerts,
        data: s.adminAlerts.data.map(a =>
          a.id === alertId ? { ...a, sentStatus: 'suppressed', suppressedReason: reason } : a
        ),
      },
    }));
    return result;
  }),

  updateHotspotStatus: (hotspotId, status) => asyncAction(set, 'hotspotStatus', async () => {
    const result = await apiUpdateHotspotStatus(hotspotId, status);
    set(s => ({
      adminHotspots: s.adminHotspots.map(h =>
        h.id === hotspotId ? { ...h, status } : h
      ),
    }));
    return result;
  }),

  reviewReport: (reportId, data) =>
    asyncAction(set, 'reviewReport', () => apiReviewPestReport(reportId, data)),

  triggerFarmScore: (profileId) =>
    asyncAction(set, 'triggerScore', () => triggerFarmScoring(profileId)),

  triggerRegionScore: (regionKey) =>
    asyncAction(set, 'triggerRegion', () => triggerRegionScoring(regionKey)),

  // ─── Reset ───────────────────────────────────
  clearErrors: () => set({ errors: {} }),
  clearFarmerData: () => set({ farmRisk: null, hotspots: [], alerts: [], pestReportResult: null }),
}));
