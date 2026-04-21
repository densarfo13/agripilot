/**
 * topAlertPicker.js — deterministic "one top alert at a time" selector
 * (spec §10).
 *
 * Problem:
 *   A farmer home page can show three things at once: a risk/outbreak
 *   banner, a weather banner, and the generic daily reminder. Stacking
 *   all three erodes trust and creates duplicate copy ("it's going to
 *   rain" from the weather card AND from the reminder). Dedup is
 *   currently ad-hoc in FarmerTodayPage.
 *
 * Fix:
 *   pickTopAlert({ critical, weather, reminder, dismissed }) →
 *     one alert OR null
 *
 *   Priority:
 *     1. critical risk / outbreak
 *     2. weather alert (severe or high-confidence)
 *     3. generic reminder
 *
 *   Any alert already in `dismissed` for the current cycle is skipped
 *   so the next-highest wins. Content hash + cycleKey semantics are
 *   supplied by farrowayLocal's dismiss helpers — this picker doesn't
 *   own storage.
 *
 *   isDuplicateOfTop(summary, top) — returns true when `summary` is
 *   the below-the-fold echo of whatever `top` is showing. Callers
 *   suppress it when true so the farmer sees one message, not two.
 */

export const ALERT_PRIORITY = Object.freeze({
  CRITICAL: 1,   // outbreak / high risk
  WEATHER:  2,   // severe or significant weather
  REMINDER: 3,   // daily / missed-day / routine nudge
});

/** Normalise an alert input into the frozen shape the picker emits. */
function shape(kind, raw, priority) {
  if (!raw) return null;
  // Pass-through for objects already in the target shape.
  if (raw.kind === kind && raw.priority === priority) return raw;
  return Object.freeze({
    id:           raw.id || raw.alertId || `${kind}_${Date.now()}`,
    kind,
    priority,
    severity:     raw.severity || raw.level || (kind === 'critical' ? 'high' : 'info'),
    messageKey:   raw.messageKey || raw.key || null,
    message:      raw.message || raw.text || raw.fallback || null,
    contentHash:  raw.contentHash || null,
    // Anything the caller wants to preserve for rendering.
    meta:         raw.meta || null,
  });
}

/**
 * pickTopAlert — returns exactly one alert (or null) for the top of
 * the screen. Signature intentionally loose so callers can feed it
 * the output of the reminder engine, the outbreak engine, and the
 * weather summary without reshaping.
 *
 * Inputs (all optional):
 *   critical:  the highest-priority risk/outbreak alert (already
 *              selected by the caller — typically a cluster alert).
 *   weather:   the current weather banner if it should fire.
 *   reminder:  output from `evaluateReminder` (or a compatible shape).
 *   isDismissed: (id, content?) → boolean — same semantics as
 *                farrowayLocal.isAlertDismissed. Optional; default: no-op.
 */
export function pickTopAlert({
  critical    = null,
  weather     = null,
  reminder    = null,
  isDismissed = () => false,
} = {}) {
  const candidates = [
    shape('critical', critical, ALERT_PRIORITY.CRITICAL),
    shape('weather',  weather,  ALERT_PRIORITY.WEATHER),
    shape('reminder', reminder, ALERT_PRIORITY.REMINDER),
  ].filter(Boolean);

  for (const c of candidates) {
    // A reminder with show=false should never be a candidate — the
    // reminder engine already returns that for suppressed daily
    // reminders / criticalAlertsOnly modes.
    if (c.kind === 'reminder' && reminder && reminder.show === false) continue;
    try {
      if (isDismissed(c.id, { hash: c.contentHash })) continue;
    } catch { /* isDismissed must never throw; swallow and treat as not-dismissed */ }
    return c;
  }
  return null;
}

/**
 * isDuplicateOfTop — predicate for below-the-fold panels. When the
 * top banner is a weather alert, any "weather summary chip" in a
 * panel below is a duplicate. Same for outbreak/critical vs a
 * redundant risk panel.
 *
 * Accepts strings ('weather', 'risk', 'reminder') or objects with a
 * `.kind` or `.type` property.
 */
export function isDuplicateOfTop(summary, top) {
  if (!summary || !top) return false;
  const sumKind = typeof summary === 'string'
    ? summary
    : String(summary.kind || summary.type || '').toLowerCase();
  const topKind = typeof top === 'string'
    ? top
    : String(top.kind || '').toLowerCase();
  if (!sumKind || !topKind) return false;
  if (sumKind === topKind) return true;
  // "risk" summary duplicates a "critical" top alert (both describe
  // risk). "weather" summary duplicates a "weather" top alert.
  if (sumKind === 'risk' && topKind === 'critical') return true;
  if (sumKind === 'high_risk' && topKind === 'critical') return true;
  return false;
}

export const _internal = Object.freeze({ shape });
