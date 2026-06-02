/**
 * OutcomeIntelligencePlatformTracker.ts — single client wrapper
 * over the /api/outcomes/* endpoints.
 *
 * Pure / never throws / returns frozen envelopes.
 */

const _safe = <T,>(fn: () => Promise<T>, fb: T): Promise<T> => {
  return (async () => { try { return await fn(); } catch { return fb; } })();
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function _post(url: string, body: any) {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null);
}

async function _get(url: string) {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url, { credentials: 'include' });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null);
}

export async function recordTaskOutcome(args: {
  taskId: string;
  completion: 'yes' | 'partial' | 'no';
  scanId?: string;
  recommendation?: string;
  note?: string;
}) {
  return _post('/api/outcomes/task', args);
}

export async function recordFollowUpOutcome(args: {
  scanId: string;
  recommendation: string;
  dayOffset: 3 | 7 | 14;
  result: 'improved' | 'same' | 'worse';
  category?: 'disease' | 'pest' | 'soil' | 'other';
  crop?: string;
  region?: string;
  season?: string;
  taskId?: string;
  note?: string;
}) {
  return _post('/api/outcomes/follow-up', args);
}

export async function recordPhotoPair(args: {
  scanId: string;
  beforeUrl: string;
  afterUrl?: string;
  improvementNote?: string;
  verdict?: 'better' | 'same' | 'worse';
}) {
  return _post('/api/outcomes/photo-pair', args);
}

export async function fetchRecommendationRanking(query: {
  category?: string;
  crop?: string;
  region?: string;
  season?: string;
  days?: number;
}) {
  const qs = Object.entries(query)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
  return _get('/api/outcomes/recommendation-ranking' + (qs ? '?' + qs : ''));
}

export async function fetchFarmerDashboard() {
  return _get('/api/outcomes/farmer-dashboard');
}

export async function fetchOrgDashboard() {
  return _get('/api/outcomes/organization');
}

export async function fetchCommandCenterMetrics(days = 30) {
  return _get('/api/outcomes/command-center?days=' + String(days));
}

export default recordTaskOutcome;
