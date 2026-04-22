/**
 * notificationScheduler.js — ties everything together.
 *
 *   processNotifications({ user, farm, tasks, weather, issues,
 *                          completions, now, language,
 *                          transport? }) → Report
 *
 * Pipeline:
 *   1. generateCandidates() from notificationEngine
 *   2. dedup each candidate.key against the existing store (one
 *      notification per dedup key per day)
 *   3. for each NEW candidate:
 *        a. addNotification() → in-app store (always)
 *        b. chooseChannels() for the remaining channels
 *        c. transport.send(...) per channel (default: noop-logger)
 *        d. logDeliveryAttempt() for every attempted channel
 *   4. return a Report listing created + skipped + attempts for
 *      easy debugging.
 *
 * Transport:
 *   The `transport` dependency is an object with `.send({channel,
 *   candidate, user})` that returns `{ ok, code?, messageId? }`.
 *   Default transport is a no-op that returns `{ ok: true, code:
 *   'queued' }` for in_app (already handled by the store) and `{ ok:
 *   false, code: 'not_wired' }` for email/sms — i.e. the scheduler
 *   records intent without blasting real messages. A later commit
 *   can swap in a transport that calls a server endpoint.
 */

import { addNotification, listNotifications } from './notificationStore.js';
import { generateCandidates } from './notificationEngine.js';
import { chooseChannels }      from './channelRouter.js';
import { getNotificationPreferences } from './notificationPreferences.js';
import { logDeliveryAttempt }   from './notificationDeliveryLog.js';

const DEFAULT_TRANSPORT = Object.freeze({
  send: async ({ channel }) => {
    if (channel === 'in_app') return { ok: true, code: 'queued' };
    return { ok: false, code: 'not_wired',
      reason: 'Channel transport not wired — attempt logged.' };
  },
});

/**
 * alreadyExists — dedup by id. The candidate key already embeds the
 * farm and the date (e.g. daily:farm-1:2025-05-10), so matching on
 * id alone is both necessary and sufficient: any second emit of the
 * same id on the same day is, by definition, a duplicate.
 */
function alreadyExists(key) {
  if (!key) return false;
  const list = listNotifications({ limit: 200 });
  return list.some((n) => n && n.id === key);
}

export async function processNotifications({
  user         = null,
  farm         = null,
  tasks        = [],
  completions  = [],
  issues       = [],
  weather      = null,
  now          = null,
  language     = 'en',
  preferences  = null,
  transport    = DEFAULT_TRANSPORT,
} = {}) {
  const prefs = preferences || getNotificationPreferences();
  const candidates = generateCandidates({
    user, farm, tasks, completions, issues, weather, now, language,
  });

  const report = { created: [], skippedDuplicate: [], attempts: [], errors: [] };

  for (const cand of candidates) {
    // Dedup: same key already in the store.
    if (alreadyExists(cand.key)) {
      report.skippedDuplicate.push(cand.key);
      logDeliveryAttempt({
        userId: cand.userId, farmId: cand.farmId, type: cand.type,
        channel: 'in_app', status: 'skipped', reason: 'duplicate_today',
        notificationId: cand.key,
      });
      continue;
    }

    // Persist into the in-app store. The channel router still gets
    // called so we can optionally fan-out to email/SMS; in-app is
    // always attempted so the farmer has one reliable fallback.
    const stored = addNotification({
      id:          cand.key,
      type:        cand.type,
      priority:    cand.priority || 'medium',
      messageKey:  cand.titleKey || null,
      messageVars: cand.vars || null,
      channel:     'in_app',
      data:        { ...(cand.data || {}), titleFallback: cand.titleFallback,
                     bodyFallback: cand.bodyFallback, bodyKey: cand.bodyKey,
                     ruleTag: cand.meta && cand.meta.ruleTag },
    });
    report.created.push({ key: cand.key, type: cand.type });

    const plans = chooseChannels({ candidate: cand, preferences: prefs, user });
    for (const plan of plans) {
      // In-app is the one we already persisted; treat it as sent so the
      // log reflects reality.
      if (plan.channel === 'in_app') {
        const entry = logDeliveryAttempt({
          userId: cand.userId, farmId: cand.farmId, type: cand.type,
          channel: 'in_app', status: 'sent',
          reason: plan.reason, notificationId: cand.key,
        });
        report.attempts.push(entry);
        continue;
      }

      if (!plan.canSend) {
        const entry = logDeliveryAttempt({
          userId: cand.userId, farmId: cand.farmId, type: cand.type,
          channel: plan.channel, status: 'skipped',
          reason: plan.reason === 'preference_on' ? 'target_missing' : plan.reason,
          notificationId: cand.key,
        });
        report.attempts.push(entry);
        continue;
      }

      // Try the transport — a failure must never crash the
      // scheduler; we just record it and move on.
      let result = { ok: false, code: 'transport_error' };
      try {
        result = await transport.send({ channel: plan.channel, candidate: cand, user });
      } catch (err) {
        report.errors.push({ channel: plan.channel, key: cand.key,
                             message: err && err.message ? err.message : String(err) });
        result = { ok: false, code: 'transport_threw',
                   reason: err && err.message ? err.message : 'unknown' };
      }

      const entry = logDeliveryAttempt({
        userId: cand.userId, farmId: cand.farmId, type: cand.type,
        channel: plan.channel,
        status: result.ok ? 'sent' : (result.code === 'queued' ? 'queued' : 'failed'),
        reason: result.code || plan.reason || null,
        messageId: result.messageId || null,
        notificationId: cand.key,
      });
      report.attempts.push(entry);
    }

    // Drop a small reference to the stored row onto the report (for
    // tests / debugging).
    void stored;
  }

  return report;
}

export const _internal = Object.freeze({
  DEFAULT_TRANSPORT, alreadyExists,
});
