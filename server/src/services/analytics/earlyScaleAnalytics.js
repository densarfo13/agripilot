/**
 * earlyScaleAnalytics.js — analytics-light service layer.
 *
 * Emits the 8 launch-critical events from the spec:
 *   install, first_action, home_view, task_completed,
 *   scan_used, listing_created, buyer_interest, day2_return
 *
 * Two destinations, both optional:
 *   1. Database (`ClientEvent` table) — always-on, durable.
 *   2. PostHog / Mixpanel via `ANALYTICS_KEY` — fire-and-forget
 *      HTTP POST when set. Missing key = warn-only; database
 *      events keep flowing.
 *
 *   import { trackLaunchEvent, EVENTS } from '.../earlyScaleAnalytics.js';
 *   await trackLaunchEvent(EVENTS.SCAN_USED, { userId, payload });
 *
 * Strict-rule audit
 *   * Never throws — every persistence path is wrapped.
 *   * Database write uses Prisma's existing `ClientEvent` model
 *     so no new table / migration is required.
 *   * External provider HTTP call uses `fetch` (Node 18+) with
 *     a 1500 ms abort timeout so a slow provider can never
 *     stall the request thread.
 *   * One in-memory ring buffer holds the last 200 events for
 *     diagnostics (`getRecentEvents()`).
 */

import { prisma } from '../../core/prisma.js';

export const EVENTS = Object.freeze({
  INSTALL:          'install',
  FIRST_ACTION:     'first_action',
  HOME_VIEW:        'home_view',
  TASK_COMPLETED:   'task_completed',
  SCAN_USED:        'scan_used',
  LISTING_CREATED:  'listing_created',
  BUYER_INTEREST:   'buyer_interest',
  DAY2_RETURN:      'day2_return',
});

const VALID_EVENTS = new Set(Object.values(EVENTS));

const RECENT_BUFFER_LIMIT = 200;
const _recent = [];

function _pushRecent(row) {
  _recent.unshift(row);
  if (_recent.length > RECENT_BUFFER_LIMIT) _recent.length = RECENT_BUFFER_LIMIT;
}

async function _writeToDatabase(row) {
  // Prisma's ClientEvent model already accepts a JSON `payload`
  // column and a free-form `type` string — perfect for analytics
  // without a new migration.
  try {
    if (!prisma || !prisma.clientEvent) return false;
    await prisma.clientEvent.create({
      data: {
        id:        row.id,
        orgId:     row.orgId   || null,
        farmerId:  row.userId  || null,
        farmId:    row.farmId  || null,
        type:      row.type,
        payload:   row.payload || null,
        createdAt: new Date(row.timestamp),
      },
    });
    return true;
  } catch { return false; }
}

async function _postToProvider(row) {
  if (!process.env.ANALYTICS_KEY) return false;
  const url = process.env.ANALYTICS_INGEST_URL
    || 'https://app.posthog.com/capture/';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const body = {
      api_key:    process.env.ANALYTICS_KEY,
      event:      row.type,
      distinct_id: row.userId || row.anonymousId || 'anon',
      properties: {
        ...(row.payload || {}),
        farmId:    row.farmId || null,
        orgId:     row.orgId  || null,
        timestamp: row.timestamp,
      },
    };
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    clearTimeout(t);
    return !!(res && res.ok);
  } catch { return false; }
}

function _uid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `evt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * trackLaunchEvent(type, ctx) — fire-and-forget; awaited only
 * when the caller wants to know the persistence outcome.
 *
 * @param {string} type           — must be one of EVENTS.*
 * @param {object} ctx            — { userId, orgId, farmId, anonymousId, payload }
 * @returns {Promise<{ ok: boolean, db: boolean, provider: boolean }>}
 */
export async function trackLaunchEvent(type, ctx = {}) {
  if (!VALID_EVENTS.has(type)) {
    return { ok: false, db: false, provider: false, error: 'unknown_event' };
  }
  const row = {
    id:           _uid(),
    type,
    userId:       ctx.userId       || null,
    anonymousId:  ctx.anonymousId  || null,
    orgId:        ctx.orgId        || null,
    farmId:       ctx.farmId       || null,
    payload:      ctx.payload      || null,
    timestamp:    new Date().toISOString(),
  };
  _pushRecent(row);

  const [db, provider] = await Promise.all([
    _writeToDatabase(row),
    _postToProvider(row),
  ]);
  return { ok: true, db, provider };
}

/** getRecentEvents() — diagnostic snapshot of the last 200 events. */
export function getRecentEvents() {
  return _recent.slice();
}

export default trackLaunchEvent;
