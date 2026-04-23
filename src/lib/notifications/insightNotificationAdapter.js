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
export const MAX_WA_CHARS  = 640;        // WhatsApp cap (looser than SMS)
export const WA_DAILY_CAP  = 3;          // slightly higher than SMS
export const VOICE_DAILY_CAP = 1;        // calls are intrusive — one/day
export const MAX_INSIGHTS_AS_NOTIFS = 5; // cap to match dashboard

// Channels in the order the router prefers when multiple are allowed
// and the insight is high priority.
export const CHANNELS = f(['in_app', 'whatsapp', 'sms', 'voice']);

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

  // ─── 4. External-channel fan-out (spec §6 channel routing) ──
  // The router decides, per insight, which external channels to
  // clone into. Rules (see pickChannels):
  //   • high priority + literacyMode=voice → voice (first choice)
  //   • high priority + whatsapp enabled   → whatsapp
  //   • high priority + sms enabled        → sms (fallback)
  //   • medium + whatsapp enabled          → whatsapp only
  //   • low priority                        → in_app only
  //   • no phone number                     → in_app only
  //   • dedup: if WhatsApp slot filled, skip SMS for same alert
  //     (spec §8 — "don't send both WA + SMS for same low-priority")
  const phone = derivePhoneNumber(primaryFarm, ctx);
  const caps = {
    sms:      Math.max(0, SMS_DAILY_CAP   - countChannelSent(sent, 'sms',   date)),
    whatsapp: Math.max(0, WA_DAILY_CAP    - countChannelSent(sent, 'whatsapp', date)),
    voice:    Math.max(0, VOICE_DAILY_CAP - countChannelSent(sent, 'voice', date)),
  };

  const withChannels = [];
  for (const n of ordered) {
    withChannels.push(n);
    if (!phone) continue;
    if (n.type !== 'in_app') continue;
    const picks = pickChannels({
      priority: n.priority, prefs, caps,
    });
    for (const channel of picks) {
      if (caps[channel] <= 0) continue;
      const id = n.id.replace(/^in_app:/, `${channel}:`);
      if (sent.has(id)) continue;
      withChannels.push(f({
        ...n,
        id,
        type: channel,
        channel,
        maxChars: channel === 'sms' ? MAX_SMS_CHARS
                : channel === 'whatsapp' ? MAX_WA_CHARS : 240,
        fallbackMessage: truncate(n.fallbackMessage,
          channel === 'sms' ? MAX_SMS_CHARS
          : channel === 'whatsapp' ? MAX_WA_CHARS : 240),
        message: truncate(n.message,
          channel === 'sms' ? MAX_SMS_CHARS
          : channel === 'whatsapp' ? MAX_WA_CHARS : 240),
      }));
      caps[channel] -= 1;
    }
  }

  // Filter disabled channels.
  const finalOut = withChannels.filter((n) => {
    if (n.type === 'in_app'   && !prefs.receiveNotifications) return false;
    if (n.type === 'sms'      && !prefs.receiveSMS)           return false;
    if (n.type === 'whatsapp' && !prefs.receiveWhatsApp)      return false;
    if (n.type === 'voice'    && !prefs.receiveVoiceAlerts)   return false;
    return true;
  });

  // Cross-channel dedup for the same insight id on the same day.
  // Spec §8: "if WhatsApp already covers the daily task reminder,
  // don't also send SMS unless WhatsApp failed". Without explicit
  // delivery-result feedback we apply the preferred-channel-wins
  // rule: keep WhatsApp when both would fire, drop SMS unless the
  // insight is priority=high.
  return f(collapseCrossChannel(finalOut).map(f));
}

/**
 * pickChannels({ priority, prefs, caps })
 *   Returns an ordered list of external channels to emit for an
 *   in_app row. Honours prefs + remaining caps + literacy mode +
 *   priority. Never emits more than one of each channel per call.
 */
function pickChannels({ priority, prefs, caps }) {
  const out = [];
  const wantVoiceFirst = prefs.literacyMode === 'voice' && prefs.receiveVoiceAlerts;
  const allowVoice     = prefs.receiveVoiceAlerts
                        && (prefs.literacyMode === 'voice'
                            || prefs.literacyMode === 'mixed');

  if (priority === 'high') {
    if (wantVoiceFirst && caps.voice > 0) out.push('voice');
    if (prefs.receiveWhatsApp && caps.whatsapp > 0) out.push('whatsapp');
    // SMS only if WhatsApp is off or capped — spec §8 dedup.
    if (!out.includes('whatsapp') && prefs.receiveSMS && caps.sms > 0) {
      out.push('sms');
    }
    if (!wantVoiceFirst && allowVoice && priority === 'high' && caps.voice > 0
        && out.length === 0) {
      // High-priority but user is literacyMode=mixed and neither
      // WA nor SMS fired — use voice as last-resort.
      out.push('voice');
    }
  } else if (priority === 'medium') {
    if (prefs.receiveWhatsApp && caps.whatsapp > 0) out.push('whatsapp');
    // Medium priority doesn't fire SMS (SMS is costly + spec §4);
    // the in_app row covers it.
  }
  // priority='low' → in_app only.
  return out;
}

/**
 * collapseCrossChannel(notifs)
 *   If an insight emitted both whatsapp + sms on the same farm/day,
 *   drop the SMS row. Voice + whatsapp can coexist when literacy
 *   mode genuinely requires voice. in_app always stays.
 */
function collapseCrossChannel(notifs) {
  const smsBlock = new Set();
  for (const n of notifs) {
    if (n.type === 'whatsapp' && (n.insightId || n.taskId)) {
      const suffix = n.id.split(':').slice(2).join(':');   // "<farmId>:<insightId>:<date>"
      smsBlock.add(suffix);
    }
  }
  return notifs.filter((n) => {
    if (n.type !== 'sms') return true;
    const suffix = n.id.split(':').slice(2).join(':');
    return !smsBlock.has(suffix);
  });
}

/**
 * derivePhoneNumber — pick a farmer's phone from the first farm or
 * the caller's context. Returns null when none is available so the
 * router collapses to in_app only (spec §12).
 */
function derivePhoneNumber(farm, ctx) {
  return (farm && (farm.phone || farm.phoneNumber
                    || farm.contactPhone || farm.farmerPhone))
      || (ctx && (ctx.phoneNumber || ctx.phone))
      || null;
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
  const literacyMode = ['text', 'voice', 'mixed'].includes(p.literacyMode)
    ? p.literacyMode : 'text';
  return f({
    receiveSMS:            p.receiveSMS !== false,            // default true
    receiveNotifications:  p.receiveNotifications !== false,
    // New external channels default OFF — users opt in explicitly so
    // we don't start calling farmers who never agreed to it.
    receiveWhatsApp:       p.receiveWhatsApp === true,
    receiveVoiceAlerts:    p.receiveVoiceAlerts === true,
    literacyMode,
    preferredLanguage:     p.preferredLanguage || 'en',
    preferredReminderTime: p.preferredReminderTime || p.preferredTime || 'morning',
  });
}

function countSmsSent(sent, date) {
  return countChannelSent(sent, 'sms', date);
}
function countChannelSent(sent, channel, date) {
  if (!sent || sent.size === 0) return 0;
  let n = 0;
  const prefix = `${channel}:`;
  for (const id of sent) {
    if (id && typeof id === 'string' && id.startsWith(prefix) && id.endsWith(`:${date}`)) n += 1;
  }
  return n;
}

// Update the truncate helper so the SMS pass keeps the 160-char
// cap but WhatsApp/voice can use larger budgets when appropriate.
const _truncate = truncate;

export const _internal = f({
  truncate: _truncate, buildInsightFallback, normalisePrefs,
  countSmsSent, countChannelSent, pickChannels, collapseCrossChannel,
  derivePhoneNumber, PRI,
});
