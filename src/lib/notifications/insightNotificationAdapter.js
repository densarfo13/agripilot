/**
 * insightNotificationAdapter.js — turns insightEngine output +
 * daily tasks into a prioritised list of spec-shape notifications.
 *
 *   buildNotifications({
 *     userId, farms, insights, tasks,
 *     timeOfDay?, userPreferences?, now?,
 *     recentlySent?,     // Set<string> of dedup keys from last 24h
 *     language?,         // reserved; telemetry only — UI renders via t()
 *   }) → Notification[]
 *
 *   Notification = {
 *     id,                    // stable dedup key
 *     userId, farmId,
 *     type:    'sms' | 'in_app',
 *     priority:'high' | 'medium' | 'low',
 *     messageKey,            // i18n key (what UI should render)
 *     fallbackMessage,       // English fallback, already <=160 chars
 *     message,               // == fallbackMessage (spec contract) — the
 *                            //   dispatcher resolves via t(messageKey)
 *                            //   before delivery
 *     source:  'insight' | 'task' | 'digest',
 *     insightId?, taskId?,
 *     timestamp,             // ISO string
 *   }
 *
 * Contract
 *   • Pure. Never throws. Returns deduped + prioritised list.
 *   • Respects userPreferences.receiveSMS / receiveNotifications
 *     (returns fewer types when disabled).
 *   • SMS ONLY for priority='high'. Max SMS_DAILY_CAP per user.
 *   • Every message is ≤160 chars (truncates with ellipsis if a
 *     language translation goes long — the caller substitutes via
 *     t(messageKey) and the dispatcher re-truncates before sending).
 *   • Deduplicates via stable id ("<type>:<source>:<farmId>:<date>")
 *     against `recentlySent` so we never repeat an identical alert.
 */

const f = Object.freeze;

export const SMS_DAILY_CAP = 2;          // spec §4 — "max 1–2 SMS per day"
export const MAX_SMS_CHARS = 160;        // spec §4
export const MAX_INSIGHTS_AS_NOTIFS = 5; // cap to match dashboard

const PRI = f({ high: 3, medium: 2, low: 1 });

// ─── Helpers ───────────────────────────────────────────────────
function ymd(d) {
  const date = d instanceof Date ? d : new Date(d || Date.now());
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function truncate(msg, max = MAX_SMS_CHARS) {
  if (msg == null) return '';
  const s = String(msg);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}\u2026`;
}

/**
 * buildNotifications — main entry point.
 */
export function buildNotifications(rawCtx) {
  const ctx = (rawCtx && typeof rawCtx === 'object') ? rawCtx : {};
  const prefs = normalisePrefs(ctx.userPreferences);
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now || Date.now());
  const date = ymd(now);
  const timestamp = now.toISOString();
  const userId = ctx.userId || null;
  const sent = ctx.recentlySent instanceof Set ? ctx.recentlySent : new Set(ctx.recentlySent || []);
  const farms = Array.isArray(ctx.farms) ? ctx.farms : [];
  // Single-farm shorthand: UI often has only one farm in scope.
  const primaryFarm = farms[0] || ctx.farm || null;
  const farmId = primaryFarm && (primaryFarm.id || primaryFarm._id || primaryFarm.farmId);

  const out = [];

  // ─── 1. Insight-derived alerts ──────────────────────────────
  // Insights come from the new insightEngine; each carries a
  // priority we honour directly. We emit in_app rows for all, and
  // mirror to SMS only for priority='high' (spec §4).
  const insights = Array.isArray(ctx.insights) ? ctx.insights : [];
  for (const insight of insights.slice(0, MAX_INSIGHTS_AS_NOTIFS)) {
    if (!insight || !insight.id) continue;
    const notif = notifFromInsight({
      insight, userId, farmId, date, timestamp,
    });
    if (!notif) continue;
    if (!sent.has(notif.id)) out.push(notif);
  }

  // ─── 2. Daily task reminder ─────────────────────────────────
  const tasks = Array.isArray(ctx.tasks) ? ctx.tasks : [];
  const openTasks = tasks.filter((t) => t && (t.status === 'pending'
                                          || t.status === 'open'
                                          || t.status === undefined));
  if (openTasks.length > 0) {
    const first = openTasks[0];
    const taskMsg = first.title || first.name
      || (first.templateId ? `Task: ${first.templateId}` : 'Open farm task');
    const id = `in_app:task:${farmId || 'nofarm'}:${date}`;
    if (!sent.has(id)) {
      out.push(f({
        id,
        userId,
        farmId: farmId || null,
        type: 'in_app',
        priority: 'medium',
        messageKey: 'notif.task.daily',
        fallbackMessage: truncate(openTasks.length === 1
          ? `Today: ${taskMsg}`
          : `Today: ${openTasks.length} farm tasks to complete`),
        message: truncate(openTasks.length === 1
          ? `Today: ${taskMsg}`
          : `Today: ${openTasks.length} farm tasks to complete`),
        source:  'task',
        taskId:  first.id || first.templateId || null,
        timestamp,
      }));
    }
  }

  // ─── 3. Sort + dedup + cap ──────────────────────────────────
  const seen = new Set();
  const ordered = out
    .filter((n) => {
      if (!n || !n.id) return false;
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    })
    .sort((a, b) => (PRI[b.priority] || 0) - (PRI[a.priority] || 0)
                 || a.id.localeCompare(b.id));

  // ─── 4. SMS pass: clone high-priority rows as sms type ──────
  // We emit a separate sms record for each high-priority in_app
  // notification up to SMS_DAILY_CAP. The dispatcher is free to
  // skip sending when prefs.receiveSMS=false — we emit the row so
  // ops can audit intent. The cap respects what's already been
  // sent today by subtracting matching ids from `sent`.
  const smsCap = Math.max(0, SMS_DAILY_CAP - countSmsSent(sent, date));
  let smsEmitted = 0;
  const withSms = [];
  for (const n of ordered) {
    withSms.push(n);
    if (!prefs.receiveSMS) continue;
    if (n.type !== 'in_app') continue;
    if (n.priority !== 'high') continue;
    if (smsEmitted >= smsCap) continue;
    const smsId = n.id.replace(/^in_app:/, 'sms:');
    if (sent.has(smsId)) continue;
    withSms.push(f({
      ...n,
      id: smsId,
      type: 'sms',
      // SMS bodies stay in English fallback for the dispatcher to
      // localise via t(messageKey) before handing to Twilio; we do a
      // defensive truncate so we never hand a >160-char string
      // downstream.
      fallbackMessage: truncate(n.fallbackMessage),
      message:         truncate(n.message),
    }));
    smsEmitted += 1;
  }

  // Filter out in_app rows when user has disabled them entirely.
  const finalOut = withSms.filter((n) => {
    if (n.type === 'in_app' && !prefs.receiveNotifications) return false;
    if (n.type === 'sms'    && !prefs.receiveSMS)           return false;
    return true;
  });

  return f(finalOut.map(f));
}

function notifFromInsight({ insight, userId, farmId, date, timestamp }) {
  const priority = ['high', 'medium', 'low'].includes(insight.priority)
    ? insight.priority : 'medium';
  // The composite id makes dedup stable across the day per farm +
  // insight id, so "water stress" sent at 07:00 won't fire again
  // at 11:00.
  const id = `in_app:insight:${farmId || 'nofarm'}:${insight.id}:${date}`;
  const fallback = buildInsightFallback(insight);
  return f({
    id,
    userId,
    farmId: farmId || null,
    type: 'in_app',
    priority,
    messageKey:      insight.messageKey || null,
    fallbackMessage: truncate(fallback),
    message:         truncate(fallback),
    source:    'insight',
    insightId: insight.id,
    timestamp,
  });
}

function buildInsightFallback(insight) {
  const msg = insight.fallbackMessage || '';
  const act = insight.recommendedAction || '';
  // Combine message + action into a single SMS-friendly line when
  // room allows. Format: "<msg>. <action>".
  if (!act) return msg;
  if (!msg) return act;
  const combined = `${msg}. ${act}`;
  return combined.length <= MAX_SMS_CHARS ? combined : msg;
}

function normalisePrefs(raw) {
  const p = (raw && typeof raw === 'object') ? raw : {};
  return f({
    receiveSMS:            p.receiveSMS !== false,       // default true
    receiveNotifications:  p.receiveNotifications !== false,
    preferredLanguage:     p.preferredLanguage || 'en',
    preferredTime:         p.preferredTime     || 'morning',
  });
}

function countSmsSent(sent, date) {
  if (!sent || sent.size === 0) return 0;
  let n = 0;
  for (const id of sent) {
    if (id && typeof id === 'string' && id.startsWith('sms:') && id.endsWith(`:${date}`)) n += 1;
  }
  return n;
}

export const _internal = f({
  truncate, buildInsightFallback, normalisePrefs, countSmsSent, PRI,
});
