/**
 * insightNotificationAdapter.js — converts insight + task data into
 * spec-aligned notification rows ready for DB insertion or in-app rendering.
 *
 * Exports:
 *   buildNotifications(ctx) → Notification[]
 *   SMS_DAILY_CAP          = 2            (max SMS rows per day per user)
 *   MAX_SMS_CHARS          = 160          (hard character limit for SMS)
 *   DEFAULT_LIVE_CHANNELS  = ['in_app']   (production channel gate)
 *   _internal              = { truncate, normalisePrefs }
 *
 * Channel routing is gated by `liveChannels` so SMS / WhatsApp / voice
 * are opt-in at the call site. The default production export only emits
 * in_app rows — other channels must be explicitly unlocked by callers
 * that own the delivery pipeline.
 */

export const SMS_DAILY_CAP = 2;
export const MAX_SMS_CHARS = 160;

/** Production gate: only in_app is live by default. */
export const DEFAULT_LIVE_CHANNELS = ['in_app'];

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

// ─── Utility helpers ──────────────────────────────────────────────

function ymd(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function truncate(s, max = MAX_SMS_CHARS) {
  if (!s) return '';
  const str = String(s);
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}\u2026`;
}

function normalisePrefs(prefs = {}) {
  const p = prefs && typeof prefs === 'object' ? prefs : {};
  return {
    receiveSMS:            p.receiveSMS            !== false,
    receiveNotifications:  p.receiveNotifications  !== false,
    receiveWhatsApp:       p.receiveWhatsApp        !== false,
    receiveVoiceAlerts:    p.receiveVoiceAlerts     !== false,
    preferredLanguage:     p.preferredLanguage      || 'en',
    literacyMode:          p.literacyMode           || 'text',
  };
}

function dedupKey(type, farmId, insightId, date) {
  return `${type}:insight:${farmId}:${insightId}:${date}`;
}

function makeId(type, farmId, insightId, date) {
  return `${type}:insight:${farmId}:${insightId}:${date}`;
}

// ─── Core builder ─────────────────────────────────────────────────

/**
 * buildNotifications({
 *   userId, farms, insights, tasks,
 *   userPreferences, now, recentlySent, liveChannels
 * }) → Notification[]
 *
 * Notification shape:
 *   { id, userId, farmId, type, source, insightId, priority,
 *     messageKey, message, fallbackMessage, timestamp }
 */
export function buildNotifications(ctx) {
  // Null / garbage guard — never throw.
  if (!ctx || typeof ctx !== 'object') return [];

  const {
    userId          = null,
    farms           = [],
    insights        = [],
    tasks           = [],
    userPreferences = {},
    now             = null,
    recentlySent    = new Set(),
    liveChannels    = DEFAULT_LIVE_CHANNELS,
  } = ctx;

  const prefs     = normalisePrefs(userPreferences);
  const date      = ymd(now);
  const sent      = recentlySent instanceof Set ? recentlySent : new Set();
  const channels  = Array.isArray(liveChannels) ? liveChannels : DEFAULT_LIVE_CHANNELS;
  const rows      = [];

  // Count already-sent SMS rows against the daily cap.
  let smsSentToday = 0;
  for (const k of sent) {
    if (k.startsWith('sms:')) smsSentToday += 1;
  }

  const farmList    = Array.isArray(farms)    ? farms    : [];
  const insightList = Array.isArray(insights) ? insights : [];
  const taskList    = Array.isArray(tasks)    ? tasks    : [];

  // Dedup guard — prevents the same insight (by id) from producing
  // two rows in the same type+farm combination when the insight list
  // contains duplicates.
  const seenPerFarm = new Map(); // farmId → Set<`type:insightId`>

  for (const farm of farmList) {
    if (!farm) continue;
    const farmId = farm.id || farm._id || 'nofarm';
    if (!seenPerFarm.has(farmId)) seenPerFarm.set(farmId, new Set());
    const seen = seenPerFarm.get(farmId);

    const ts = (now instanceof Date ? now : new Date()).toISOString();

    // ── Insight notifications ──────────────────────────────────────
    for (const insight of insightList) {
      if (!insight || !insight.id) continue;

      const insightId = insight.id;
      const priority  = insight.priority || 'medium';

      // Build the display message (fallback + action, truncated to 160).
      const rawMsg = [insight.fallbackMessage, insight.recommendedAction]
        .filter(Boolean).join('. ');
      const message         = truncate(rawMsg || insightId);
      const fallbackMessage = truncate(insight.fallbackMessage || insightId);
      const messageKey      = insight.messageKey || '';

      // ── in_app ────────────────────────────────────────────────
      if (prefs.receiveNotifications && channels.includes('in_app')) {
        const localKey = `in_app:${insightId}`;
        const sentKey  = dedupKey('in_app', farmId, insightId, date);
        if (!seen.has(localKey) && !sent.has(sentKey)) {
          seen.add(localKey);
          rows.push({
            id:              makeId('in_app', farmId, insightId, date),
            userId,
            farmId,
            type:            'in_app',
            source:          'insight',
            insightId,
            priority,
            messageKey,
            message,
            fallbackMessage,
            timestamp:       ts,
          });
        }
      }

      // ── SMS (high priority only, cap enforced) ────────────────
      if (
        priority === 'high'
        && prefs.receiveSMS
        && channels.includes('sms')
        && smsSentToday < SMS_DAILY_CAP
      ) {
        const localKey = `sms:${insightId}`;
        const sentKey  = dedupKey('sms', farmId, insightId, date);
        if (!seen.has(localKey) && !sent.has(sentKey)) {
          seen.add(localKey);
          smsSentToday += 1;
          rows.push({
            id:              makeId('sms', farmId, insightId, date),
            userId,
            farmId,
            type:            'sms',
            source:          'insight',
            insightId,
            priority,
            messageKey,
            message,
            fallbackMessage,
            timestamp:       ts,
          });
        }
      }

      // ── WhatsApp (high priority, channel-gated) ───────────────
      if (
        priority === 'high'
        && prefs.receiveWhatsApp
        && channels.includes('whatsapp')
      ) {
        const localKey = `whatsapp:${insightId}`;
        if (!seen.has(localKey)) {
          seen.add(localKey);
          rows.push({
            id:              makeId('whatsapp', farmId, insightId, date),
            userId,
            farmId,
            type:            'whatsapp',
            source:          'insight',
            insightId,
            priority,
            messageKey,
            message,
            fallbackMessage,
            timestamp:       ts,
          });
        }
      }

      // ── Voice (high priority, channel-gated) ──────────────────
      if (
        priority === 'high'
        && prefs.receiveVoiceAlerts
        && channels.includes('voice')
      ) {
        const localKey = `voice:${insightId}`;
        if (!seen.has(localKey)) {
          seen.add(localKey);
          rows.push({
            id:              makeId('voice', farmId, insightId, date),
            userId,
            farmId,
            type:            'voice',
            source:          'insight',
            insightId,
            priority,
            messageKey,
            message,
            fallbackMessage,
            timestamp:       ts,
          });
        }
      }
    }

    // ── Task daily reminder ────────────────────────────────────────
    if (channels.includes('in_app')) {
      const pending = taskList.filter((t) => t && t.status === 'pending');
      if (pending.length > 0) {
        const titles = pending.slice(0, 2).map((t) => t.title || 'task').join(', ');
        const msg    = truncate(`Today: ${titles}`);
        rows.push({
          id:              `task:${farmId}:${date}`,
          userId,
          farmId,
          type:            'in_app',
          source:          'task',
          insightId:       null,
          priority:        'medium',
          messageKey:      'notif.daily.title',
          message:         msg,
          fallbackMessage: msg,
          timestamp:       ts,
        });
      }
    }
  }

  // Sort: high → medium → low, preserving relative order within each tier.
  rows.sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));

  return rows;
}

// ─── Internals ─────────────────────────────────────────────────────
export const _internal = Object.freeze({
  truncate,
  normalisePrefs,
});
