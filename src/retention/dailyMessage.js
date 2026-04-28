/**
 * dailyMessage.js — top-of-Today retention banner generator.
 *
 *   getDailyMessage({ weather, risks, farm }) -> {
 *     kind,         // 'weather' | 'risk' | 'fallback'
 *     icon,         // emoji glyph
 *     messageKey,   // i18n key
 *     fallback,     // English fallback string
 *     vars,         // optional placeholders for tSafe(key, fb, vars)
 *     tone,         // 'info' | 'warning'
 *   }
 *
 * Priority order (most actionable first)
 *   1. HIGH risk      -> "Pest risk today. Check your crops."
 *                        / "Drought risk today. Check soil."
 *   2. Weather signal -> "Heavy rain expected today."
 *                        / "Hot day ahead. Water early."
 *                        / "Rain expected this week."
 *   3. Fallback       -> "Check your farm today."
 *
 * The function is PURE — caller passes the context, it returns
 * the descriptor. The Today screen + a future SMS cron can
 * share the same logic without coupling to React.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals, no side effects
 *   * Never throws on missing / partial context (returns
 *     fallback)
 *   * tSafe friendly: always returns messageKey + English
 *     fallback so callers route through tSafe
 *   * No fake alarm: HIGH risk wording stays calm + actionable;
 *     weather wording is informational, not alarmist
 *   * Six locales covered via the overlay registered in
 *     src/i18n/index.js (added in the same commit)
 */

const ICON = Object.freeze({
  pest:    '\uD83D\uDC1B',           // 🐛
  drought: '\uD83C\uDF35',           // 🌵
  rain:    '\uD83C\uDF27\uFE0F',     // 🌧️
  heavyRain: '\u26C8\uFE0F',         // ⛈️
  heat:    '\u2600\uFE0F',           // ☀️
  farm:    '\uD83D\uDC40',           // 👀
});

function _isHigh(level) {
  return String(level || '').toUpperCase() === 'HIGH';
}

function _normaliseRisks(risks) {
  if (!risks || typeof risks !== 'object') return { pest: 'LOW', drought: 'LOW' };
  return {
    pest:    String(risks.pest || 'LOW').toUpperCase(),
    drought: String(risks.drought || 'LOW').toUpperCase(),
  };
}

/**
 * getDailyMessage(context) → message descriptor
 *
 * context may include:
 *   weather: { rainTodayMm, rainWeekMm, temperatureC, humidityPct }
 *   risks:   { pest: 'HIGH'|'MEDIUM'|'LOW', drought: 'HIGH'|...,
 *              top: { kind, level } }
 *   farm:    full farm record (used for crop-aware copy in future)
 *
 * Any field can be missing — the function falls through to the
 * next priority tier and ultimately the fallback.
 */
export function getDailyMessage(context = {}) {
  try {
    const risks = _normaliseRisks(context.risks);
    const wx    = (context && context.weather) || {};

    // ── Tier 1: HIGH risk ──────────────────────────────────
    if (_isHigh(risks.pest)) {
      return Object.freeze({
        kind:       'risk',
        icon:       ICON.pest,
        messageKey: 'daily.message.pestRisk',
        fallback:   'Pest risk today. Check your crops.',
        vars:       null,
        tone:       'warning',
      });
    }
    if (_isHigh(risks.drought)) {
      return Object.freeze({
        kind:       'risk',
        icon:       ICON.drought,
        messageKey: 'daily.message.droughtRisk',
        fallback:   'Dry conditions today. Check soil moisture.',
        vars:       null,
        tone:       'warning',
      });
    }

    // ── Tier 2: weather signal ─────────────────────────────
    const rainToday = Number(wx.rainTodayMm);
    const rainWeek  = Number(wx.rainWeekMm);
    const tempC     = Number(wx.temperatureC);

    if (Number.isFinite(rainToday) && rainToday >= 10) {
      return Object.freeze({
        kind:       'weather',
        icon:       ICON.heavyRain,
        messageKey: 'daily.message.heavyRain',
        fallback:   'Heavy rain expected today. Plan around wet conditions.',
        vars:       null,
        tone:       'info',
      });
    }
    if (Number.isFinite(tempC) && tempC >= 32) {
      return Object.freeze({
        kind:       'weather',
        icon:       ICON.heat,
        messageKey: 'daily.message.hotDay',
        fallback:   'Hot day ahead. Water crops early.',
        vars:       null,
        tone:       'info',
      });
    }
    if (Number.isFinite(rainToday) && rainToday >= 1 && rainToday < 10) {
      return Object.freeze({
        kind:       'weather',
        icon:       ICON.rain,
        messageKey: 'daily.message.lightRain',
        fallback:   'Some rain expected today.',
        vars:       null,
        tone:       'info',
      });
    }
    if (Number.isFinite(rainWeek) && rainWeek >= 25) {
      return Object.freeze({
        kind:       'weather',
        icon:       ICON.rain,
        messageKey: 'daily.message.rainyWeek',
        fallback:   'Rain expected this week.',
        vars:       null,
        tone:       'info',
      });
    }

    // ── Tier 3: fallback ───────────────────────────────────
    return Object.freeze({
      kind:       'fallback',
      icon:       ICON.farm,
      messageKey: 'daily.message.fallback',
      fallback:   'Check your farm today.',
      vars:       null,
      tone:       'info',
    });
  } catch {
    return Object.freeze({
      kind:       'fallback',
      icon:       ICON.farm,
      messageKey: 'daily.message.fallback',
      fallback:   'Check your farm today.',
      vars:       null,
      tone:       'info',
    });
  }
}

export default getDailyMessage;
