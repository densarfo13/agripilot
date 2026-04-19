/**
 * reportsService.js — generates the three product-intelligence
 * reports on demand. The caller supplies `loadUsers` and
 * `loadFeedbackHistory` so this service has no Prisma coupling.
 *
 * Expected shapes:
 *   loadUsers(options)             → Promise<Array<{ userId, events, profile }>>
 *   loadFeedbackHistory(options)   → Promise<{ [country:crop]: { score, n, reasons } }>
 *
 * A default in-memory implementation is exported as
 * `inMemoryStore()` — useful for tests and for first-run staging
 * environments. The real caller replaces these with Prisma queries
 * against the analytics event log and a feedback-history table.
 */

import {
  buildOnboardingHealthReport,
  buildRecommendationHealthReport,
  buildTrustHealthReport,
  buildFullProductReport,
} from '../../../services/analytics/productIntelligenceReports.js';

export async function generateOnboardingReport({ loadUsers, options = {} } = {}) {
  if (typeof loadUsers !== 'function') throw new Error('loadUsers required');
  const users = await loadUsers(options);
  return buildOnboardingHealthReport(users || []);
}

export async function generateRecommendationReport({ loadUsers, loadFeedbackHistory, options = {} } = {}) {
  if (typeof loadUsers !== 'function') throw new Error('loadUsers required');
  const [users, history] = await Promise.all([
    loadUsers(options),
    typeof loadFeedbackHistory === 'function' ? loadFeedbackHistory(options) : Promise.resolve({}),
  ]);
  return buildRecommendationHealthReport(users || [], history || {});
}

export async function generateTrustReport({ loadUsers, options = {} } = {}) {
  if (typeof loadUsers !== 'function') throw new Error('loadUsers required');
  const users = await loadUsers(options);
  return buildTrustHealthReport(users || []);
}

export async function generateFullProductReport({ loadUsers, loadFeedbackHistory, options = {} } = {}) {
  if (typeof loadUsers !== 'function') throw new Error('loadUsers required');
  const [users, history] = await Promise.all([
    loadUsers(options),
    typeof loadFeedbackHistory === 'function' ? loadFeedbackHistory(options) : Promise.resolve({}),
  ]);
  return buildFullProductReport(users || [], history || {});
}

/**
 * inMemoryStore — simple persistence implementation for staging
 * and tests. Keeps events and feedback history in memory, grouped
 * by userId. Swap in Prisma versions once the DB shape is ready.
 */
export function inMemoryStore() {
  const events = new Map();       // userId → Event[]
  const history = Object.create(null);

  return {
    persistFn: async (accepted, { userId }) => {
      const key = userId || 'anon';
      const arr = events.get(key) || [];
      arr.push(...accepted);
      events.set(key, arr);
    },
    loadUsers: async () => {
      return [...events.entries()].map(([userId, evs]) => ({
        userId,
        events: [...evs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
      }));
    },
    loadFeedbackHistory: async () => ({ ...history }),
    mergeFeedbackSignal: (signal, applyFn) => {
      if (!signal || !signal.crop || !signal.country || typeof applyFn !== 'function') return;
      const next = applyFn(history, signal);
      for (const k of Object.keys(next)) history[k] = next[k];
    },
    _debug: { events, history },
  };
}
