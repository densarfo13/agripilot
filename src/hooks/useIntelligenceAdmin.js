import { useEffect, useCallback, useRef, useState } from 'react';
import { useIntelligenceStore } from '../store/intelligenceStore.js';

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

  return { alerts, loading, error, refetch, suppressAlert: suppressAlertAction, pagination, stats, filters, setFilters: (f) => refetch(f) };
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
