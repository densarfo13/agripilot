import { useEffect, useCallback, useRef, useState } from 'react';
import { useIntelligenceStore } from '../store/intelligenceStore.js';
import { structureError } from '../api/apiClient.js';

/**
 * useRegionalRisk — regional risk map + outbreak clusters.
 */
export function useRegionalRisk() {
  const regions = useIntelligenceStore(s => s.regionalRisk);
  const clusters = useIntelligenceStore(s => s.outbreakClusters);
  const loading = useIntelligenceStore(s => !!s.loading.regionalRisk);
  const error = useIntelligenceStore(s => s.errors.regionalRisk);
  const fetch = useIntelligenceStore(s => s.fetchRegionalRisk);
  const triggerRegion = useIntelligenceStore(s => s.triggerRegionScore);
  const didFetch = useRef(false);

  const refetch = useCallback(() => fetch(), [fetch]);
  const rescore = useCallback((regionKey) => triggerRegion(regionKey).then(() => fetch()), [triggerRegion, fetch]);

  useEffect(() => {
    if (!didFetch.current) { didFetch.current = true; fetch().catch(() => {}); }
  }, [fetch]);

  return { regions, clusters, loading, error, refetch, rescore };
}

/**
 * useHighRiskFarms — paginated high-risk farm list.
 */
export function useHighRiskFarms(initialFilters = {}) {
  const farms = useIntelligenceStore(s => s.highRiskFarms);
  const loading = useIntelligenceStore(s => !!s.loading.highRiskFarms);
  const error = useIntelligenceStore(s => s.errors.highRiskFarms);
  const fetch = useIntelligenceStore(s => s.fetchHighRiskFarms);
  const triggerScore = useIntelligenceStore(s => s.triggerFarmScore);
  const [filters, setFilters] = useState({ page: 1, limit: 20, ...initialFilters });
  const [pagination, setPagination] = useState(null);

  const refetch = useCallback((newFilters) => {
    const f = newFilters ? { ...filters, ...newFilters } : filters;
    if (newFilters) setFilters(f);
    return fetch(f).then(res => {
      if (res?.pagination) setPagination(res.pagination);
      return res;
    });
  }, [filters, fetch]);

  const rescore = useCallback((profileId) =>
    triggerScore(profileId).then(() => refetch()), [triggerScore, refetch]);

  useEffect(() => { refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { farms, loading, error, refetch, rescore, filters, setFilters: (f) => refetch(f), pagination };
}

/**
 * useAdminHotspots — hotspot list with filtering + status actions.
 */
export function useAdminHotspots(initialFilters = {}) {
  const hotspots = useIntelligenceStore(s => s.adminHotspots);
  const loading = useIntelligenceStore(s => !!s.loading.adminHotspots);
  const error = useIntelligenceStore(s => s.errors.adminHotspots);
  const fetch = useIntelligenceStore(s => s.fetchAdminHotspots);
  const updateStatus = useIntelligenceStore(s => s.updateHotspotStatus);
  const [filters, setFilters] = useState(initialFilters);

  const refetch = useCallback((newFilters) => {
    const f = newFilters ? { ...filters, ...newFilters } : filters;
    if (newFilters) setFilters(f);
    return fetch(f);
  }, [filters, fetch]);

  const markStatus = useCallback((hotspotId, status) =>
    updateStatus(hotspotId, status), [updateStatus]);

  useEffect(() => { refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { hotspots, loading, error, refetch, markStatus, filters, setFilters: (f) => refetch(f) };
}

/**
 * useAdminAlerts — paginated alert list with suppress action.
 *
 * Returns a `errorType` field alongside the legacy `error`
 * string so AlertControlCenter can render the v3 named state
 * components (SessionExpired / MfaRequired / NetworkError /
 * generic Error). The classifier handles either an Error
 * object or a flat string from the store — strings collapse
 * to `API_ERROR` since we can't infer status from text.
 */
export function useAdminAlerts(initialFilters = {}) {
  const { data: alerts, pagination } = useIntelligenceStore(s => s.adminAlerts);
  const loading = useIntelligenceStore(s => !!s.loading.adminAlerts);
  const error = useIntelligenceStore(s => s.errors.adminAlerts);
  const fetch = useIntelligenceStore(s => s.fetchAdminAlerts);
  const suppress = useIntelligenceStore(s => s.suppressAlert);
  const [filters, setFilters] = useState({ page: 1, limit: 20, ...initialFilters });

  const refetch = useCallback((newFilters) => {
    const f = newFilters ? { ...filters, ...newFilters } : filters;
    if (newFilters) setFilters(f);
    return fetch(f);
  }, [filters, fetch]);

  const suppressAlertAction = useCallback((alertId, reason) =>
    suppress(alertId, reason), [suppress]);

  useEffect(() => { refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute stats from current data
  const stats = {
    active: alerts.filter(a => a.sentStatus === 'pending' || a.sentStatus === 'sent').length,
    suppressed: alerts.filter(a => a.sentStatus === 'suppressed').length,
    total: pagination?.total || alerts.length,
  };

  // Classify the error for the v3 stability layer. The store
  // may surface either an Error object or a flat string; both
  // are handled by structureError without throwing.
  const classified = error ? _classifyAlertError(error) : null;

  return {
    alerts, loading, error,
    errorType:    classified ? classified.errorType : null,
    refetch,
    suppressAlert: suppressAlertAction,
    pagination, stats,
    filters, setFilters: (f) => refetch(f),
  };
}

function _classifyAlertError(err) {
  // structureError accepts any shape and never throws.
  try {
    if (err && typeof err === 'object') return structureError(err);
    if (typeof err === 'string') {
      // Best-effort sniff for common server messages — the
      // store currently surfaces a flat string so we have to
      // pattern-match instead of reading status/code.
      const upper = err.toUpperCase();
      if (/SESSION|UNAUTHORIZED|401/.test(upper))
        return { errorType: 'SESSION_EXPIRED', message: err };
      if (/MFA|STEP[ _-]?UP/.test(upper))
        return { errorType: 'MFA_REQUIRED',    message: err };
      if (/NETWORK|OFFLINE|ECONN/.test(upper))
        return { errorType: 'NETWORK_ERROR',   message: err };
    }
    return { errorType: 'API_ERROR', message: String(err || 'Request failed') };
  } catch {
    return { errorType: 'API_ERROR', message: String(err || 'Request failed') };
  }
}

/**
 * useInterventionData — intervention effectiveness analytics.
 */
export function useInterventionData() {
  const data = useIntelligenceStore(s => s.interventionData);
  const loading = useIntelligenceStore(s => !!s.loading.interventions);
  const error = useIntelligenceStore(s => s.errors.interventions);
  const fetch = useIntelligenceStore(s => s.fetchInterventionData);
  const didFetch = useRef(false);

  const refetch = useCallback(() => fetch(), [fetch]);

  useEffect(() => {
    if (!didFetch.current) { didFetch.current = true; fetch().catch(() => {}); }
  }, [fetch]);

  return { data, loading, error, refetch };
}
