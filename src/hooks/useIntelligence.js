import { useEffect, useCallback, useRef } from 'react';
import { useIntelligenceStore } from '../store/intelligenceStore.js';

/**
 * useFarmRisk — fetch and cache the current farm's pest risk score.
 * @param {string|null} profileId
 */
export function useFarmRisk(profileId) {
  const farmRisk = useIntelligenceStore(s => s.farmRisk);
  const loading = useIntelligenceStore(s => !!s.loading.farmRisk);
  const error = useIntelligenceStore(s => s.errors.farmRisk);
  const fetch = useIntelligenceStore(s => s.fetchFarmRisk);
  const didFetch = useRef(false);

  const refetch = useCallback(() => {
    if (profileId) return fetch(profileId);
  }, [profileId, fetch]);

  useEffect(() => {
    if (profileId && !didFetch.current) {
      didFetch.current = true;
      fetch(profileId).catch(() => {});
    }
  }, [profileId, fetch]);

  return { risk: farmRisk, loading, error, refetch };
}

/**
 * useFarmHotspots — fetch hotspot zones for a farm.
 * @param {string|null} profileId
 */
export function useFarmHotspots(profileId) {
  const hotspots = useIntelligenceStore(s => s.hotspots);
  const loading = useIntelligenceStore(s => !!s.loading.hotspots);
  const error = useIntelligenceStore(s => s.errors.hotspots);
  const fetch = useIntelligenceStore(s => s.fetchHotspots);
  const didFetch = useRef(false);

  const refetch = useCallback(() => {
    if (profileId) return fetch(profileId);
  }, [profileId, fetch]);

  useEffect(() => {
    if (profileId && !didFetch.current) {
      didFetch.current = true;
      fetch(profileId).catch(() => {});
    }
  }, [profileId, fetch]);

  return { hotspots, loading, error, refetch };
}

/**
 * useMyAlerts — fetch farmer's personal alerts.
 */
export function useMyAlerts() {
  const alerts = useIntelligenceStore(s => s.alerts);
  const loading = useIntelligenceStore(s => !!s.loading.alerts);
  const error = useIntelligenceStore(s => s.errors.alerts);
  const fetch = useIntelligenceStore(s => s.fetchAlerts);
  const didFetch = useRef(false);

  const refetch = useCallback(() => fetch(), [fetch]);

  useEffect(() => {
    if (!didFetch.current) {
      didFetch.current = true;
      fetch().catch(() => {});
    }
  }, [fetch]);

  return { alerts, loading, error, refetch };
}

/**
 * usePestReportSubmit — handles multi-step pest report submission.
 */
export function usePestReportSubmit() {
  const submit = useIntelligenceStore(s => s.submitPestReport);
  const result = useIntelligenceStore(s => s.pestReportResult);
  const loading = useIntelligenceStore(s => !!s.loading.pestReport);
  const error = useIntelligenceStore(s => s.errors.pestReport);

  return { submit, result, loading, error };
}

/**
 * useTreatmentSubmit — handles treatment log + outcome submission.
 */
export function useTreatmentSubmit() {
  const submitTreatment = useIntelligenceStore(s => s.submitTreatment);
  const submitOutcome = useIntelligenceStore(s => s.submitOutcome);
  const treatmentLoading = useIntelligenceStore(s => !!s.loading.treatment);
  const outcomeLoading = useIntelligenceStore(s => !!s.loading.outcome);
  const treatmentError = useIntelligenceStore(s => s.errors.treatment);
  const outcomeError = useIntelligenceStore(s => s.errors.outcome);

  return {
    submitTreatment,
    submitOutcome,
    loading: treatmentLoading || outcomeLoading,
    error: treatmentError || outcomeError,
  };
}

/**
 * useFeedbackSubmit — diagnosis feedback hook.
 */
export function useFeedbackSubmit() {
  const submit = useIntelligenceStore(s => s.submitFeedback);
  const loading = useIntelligenceStore(s => !!s.loading.feedback);
  const error = useIntelligenceStore(s => s.errors.feedback);

  return { submit, loading, error };
}
