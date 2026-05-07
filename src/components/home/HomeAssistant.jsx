/**
 * HomeAssistant — calm full-screen home surface.
 *
 * Supports two user modes:
 *   userType = "backyard"  → plant / garden / soil / water language
 *   userType = "farmer"    → crop / farm / field / inspect language
 *
 * Data sources (priority order):
 *   1. decisionOverride prop — pre-fetched by Dashboard (no extra fetch)
 *   2. GET /api/decision/today — standalone path when no override supplied
 *   3. FALLBACK constants — shown when API is unreachable or slow
 *
 * API contract (GET /api/decision/today):
 *   { decisionId, primaryAction, primaryCta, reason,
 *     priority, confidence, tomorrowHook, weatherSummary }
 *
 * POST /api/decision/complete  — fired on CTA click, UI updated optimistically.
 *
 * Animations: all defined in HomeAssistant.css.
 *   • hero fade-in (staggered children)
 *   • orb slow pulse (3.5 s, ease-in-out)
 *   • CTA press scale(0.98)
 *   • success slide-up
 *   • weather pill fade-in
 *   Timing: 150–250 ms. No bounce.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./HomeAssistant.css";

// ── Weather condition → display string ──────────────────────────
// Spec §2: map raw condition keywords to user-facing messages.
// Matching is intentionally loose (includes) so variants like
// "light rain", "heavy rain", "showers" all hit the rain bucket.

const WEATHER_MAP = [
  {
    keys: ["rain", "storm", "shower", "drizzle", "thunder"],
    msg:  "🌧️ Rain expected — hold watering today",
  },
  {
    keys: ["dry", "drought"],
    msg:  "☀️ Dry today — check soil early",
  },
  {
    keys: ["hot", "heat", "warm", "scorch"],
    msg:  "🔥 Hot today — water early if soil is dry",
  },
  {
    keys: ["humid", "moist", "fog", "dew"],
    msg:  "💧 Humidity is high — check leaves",
  },
];

const WEATHER_FALLBACK = "🌤️ Good day for a quick check";

/**
 * Derive a human-readable weather pill string.
 *   1. If the caller supplies a pre-formatted string (has an emoji or
 *      is longer than a bare keyword), return it as-is.
 *   2. Otherwise match against WEATHER_MAP keywords.
 *   3. Fall back to WEATHER_FALLBACK.
 */
function deriveWeatherMsg(rawCondition) {
  if (!rawCondition) return WEATHER_FALLBACK;
  const s = String(rawCondition).trim();
  if (!s) return WEATHER_FALLBACK;

  // Heuristic: if the string already contains an emoji (code-point
  // outside ASCII) or is a sentence (>30 chars), treat it as
  // pre-formatted and pass through unchanged.
  const isFormatted = s.length > 30 || /[^\u0000-\u007F]/.test(s);
  if (isFormatted) return s;

  const lower = s.toLowerCase();
  for (const entry of WEATHER_MAP) {
    if (entry.keys.some((k) => lower.includes(k))) return entry.msg;
  }
  return WEATHER_FALLBACK;
}

// ── Mode-specific copy ───────────────────────────────────────────
// Spec §1: backyard = plant/garden language; farmer = crop/field language.

const COPY = {
  backyard: {
    fallbackTitle:   "Check your plant today",
    fallbackReason:  "A quick check keeps your garden thriving",
    fallbackCta:     "Check now ✓",
    successMsg:      "Nice — you stayed ahead today 🌱",
    successHook:     "Check again tomorrow morning",
    scanLabel:       "📷 Scan your plant",
    orb:             "🪴",
  },
  farmer: {
    fallbackTitle:   "Inspect your crop today",
    fallbackReason:  "Early inspection reduces risk and improves yield",
    fallbackCta:     "Inspect now ✓",
    successMsg:      "Nice — you reduced risk today 🚜",
    successHook:     "Check again tomorrow morning",
    scanLabel:       "📷 Scan crop",
    orb:             "🌾",
  },
};

function getCopy(userType) {
  return COPY[userType] === undefined ? COPY.farmer : COPY[userType];
}

// ── Main component ───────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {"backyard"|"farmer"} [props.userType="farmer"]
 *   Controls all mode-specific copy: plant vs crop, garden vs farm,
 *   success message, illustration emoji, scan label.
 *
 * @param {object}   [props.decisionOverride]
 *   Pre-fetched decision from Dashboard loop. Shape:
 *     { title, reason, cta, weather }
 *   When supplied, skips the /api/decision/today fetch entirely.
 *
 * @param {string}   [props.weatherCondition]
 *   Raw condition keyword from the loop (e.g. "rain", "dry", "hot",
 *   "humid"). Takes priority over decisionOverride.weather for the
 *   pill mapping. Pass this from loop.weather?.condition.
 *
 * @param {boolean}  [props.isOnline=true]
 *   Drives the Online / Offline indicator in the top bar.
 *
 * @param {string}   [props.language="English"]
 *   Language label shown in the top bar.
 *
 * @param {function} [props.onComplete]
 *   Called on primary CTA tap. When omitted, POSTs to
 *   /api/decision/complete (standalone path).
 *
 * @param {function} [props.onScan]
 *   Called on scan button tap. When omitted, navigates to the
 *   mode-appropriate scan route (/scan or /scan-crop).
 */
export default function HomeAssistant({
  userType        = "farmer",
  decisionOverride = null,
  weatherCondition = null,
  isOnline        = true,
  language        = "English",
  onComplete,
  onScan,
}) {
  const copy = getCopy(userType);

  // Build the mode-specific FALLBACK from copy so it's always in sync.
  const FALLBACK = {
    title:   copy.fallbackTitle,
    reason:  copy.fallbackReason,
    cta:     copy.fallbackCta,
    weather: WEATHER_FALLBACK,
  };

  const [decision,  setDecision]  = useState(
    decisionOverride ? _normalizeDecision(decisionOverride, FALLBACK) : null
  );
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();

  // ── Data loading ──────────────────────────────────────────────
  useEffect(() => {
    // Skip fetch when Dashboard already supplies decision data.
    if (decisionOverride) {
      setDecision(_normalizeDecision(decisionOverride, FALLBACK));
      return;
    }

    let cancelled = false;
    fetch("/api/decision/today")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // API shape: { decisionId, primaryAction, primaryCta, reason,
        //              priority, confidence, tomorrowHook, weatherSummary }
        // Normalise into internal shape { title, reason, cta, weather }.
        const normalised = _normalizeApiResponse(data, FALLBACK);
        setDecision(normalised);
      })
      .catch(() => {
        if (!cancelled) setDecision(FALLBACK);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync when Dashboard pushes new loop data.
  useEffect(() => {
    if (decisionOverride) {
      setDecision(_normalizeDecision(decisionOverride, FALLBACK));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionOverride]);

  // Reset completed state when a new decision arrives (day change).
  useEffect(() => {
    setCompleted(false);
  }, [decision?.title]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (completing || completed) return;
    setCompleting(true);

    // Optimistic update — show success immediately.
    setCompleted(true);
    setCompleting(false);

    if (typeof onComplete === "function") {
      try { onComplete(); } catch { /* swallow */ }
      // Don't POST — Dashboard owns the server call.
      return;
    }

    // Standalone path: fire-and-forget POST.
    try {
      await fetch("/api/decision/complete", { method: "POST" });
    } catch {
      // Offline is fine — local completed state already shows success.
    }
  }, [completing, completed, onComplete]);

  const handleScan = useCallback(() => {
    if (typeof onScan === "function") {
      try { onScan(); } catch { /* swallow */ }
      return;
    }
    // Standalone fallback: route by mode.
    try {
      navigate(userType === "backyard" ? "/scan" : "/scan-crop");
    } catch { /* swallow */ }
  }, [onScan, navigate, userType]);

  // ── Weather pill string ───────────────────────────────────────
  // Priority: explicit weatherCondition keyword > decisionOverride.weather
  // > decision.weather from API > FALLBACK.
  const weatherMsg = weatherCondition
    ? deriveWeatherMsg(weatherCondition)
    : deriveWeatherMsg(decision?.weather ?? null) || WEATHER_FALLBACK;

  // ── Loading — show nothing until first data arrives ───────────
  if (!decision) {
    return (
      <div
        className="home-assistant home-assistant--loading"
        data-testid="home-assistant-loading"
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="home-assistant" data-testid="home-assistant">

      {/* TOP BAR */}
      <div className="home-topbar" data-testid="home-topbar">
        {isOnline ? (
          <span className="home-topbar__online">
            <span className="home-topbar__online-dot" aria-hidden="true" />
            Online
          </span>
        ) : (
          <span className="home-topbar__offline">
            ● Offline
          </span>
        )}
        <span className="home-topbar__lang">{language}</span>
      </div>

      {/* HERO */}
      <div className="home-hero" data-testid="home-hero">

        {/* WEATHER PILL — always visible (spec §2) */}
        <div
          className="home-weather-pill"
          data-testid="home-weather-pill"
          aria-label="Weather summary"
        >
          {weatherMsg}
        </div>

        {/* ILLUSTRATION ORB */}
        <div className="home-orb" aria-hidden="true" data-testid="home-orb">
          <span className="home-orb__emoji">
            {completed ? "🌱" : copy.orb}
          </span>
        </div>

        {/* HEADLINE */}
        <h1
          className="home-title"
          data-testid="home-title"
        >
          {completed ? copy.successMsg : decision.title}
        </h1>

        {/* SUBTEXT — hidden in completed state (home-success carries that copy) */}
        {!completed && (
          <p
            className="home-subtitle"
            data-testid="home-subtitle"
          >
            {decision.reason}
          </p>
        )}

        {/* PRIMARY CTA or SUCCESS STATE */}
        {completed ? (
          <div className="home-success" data-testid="home-success">
            <span className="home-success__msg">✓ Done for today</span>
            <span className="home-success__hook">{copy.successHook}</span>
          </div>
        ) : (
          <button
            className="home-primary"
            data-testid="home-primary"
            onClick={handleComplete}
            disabled={completing}
            aria-label={decision.cta}
          >
            {completing ? "…" : decision.cta}
          </button>
        )}

        {/* SECONDARY — scan action (hidden when completed) */}
        {!completed && (
          <button
            className="home-secondary"
            data-testid="home-secondary"
            onClick={handleScan}
            aria-label={copy.scanLabel}
          >
            {copy.scanLabel}
          </button>
        )}

      </div>
    </div>
  );
}

// ── Normalisation helpers ────────────────────────────────────────

/**
 * Normalise a decisionOverride object (Dashboard shape) into the
 * internal { title, reason, cta, weather } shape. Falls back field-
 * by-field so a partially-populated override still renders cleanly.
 */
function _normalizeDecision(override, fallback) {
  if (!override || typeof override !== "object") return fallback;
  return {
    title:   _str(override.title)   || fallback.title,
    reason:  _str(override.reason)  || fallback.reason,
    cta:     _str(override.cta)     || fallback.cta,
    weather: _str(override.weather) || fallback.weather,
  };
}

/**
 * Normalise a /api/decision/today API response into the internal shape.
 * The API returns { primaryAction, primaryCta, reason, weatherSummary }.
 */
function _normalizeApiResponse(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  return {
    title:   _str(data.primaryAction) || fallback.title,
    reason:  _str(data.reason)        || fallback.reason,
    cta:     _str(data.primaryCta)    || fallback.cta,
    weather: _str(data.weatherSummary)|| fallback.weather,
  };
}

/** Safe string coercion — returns empty string for null/undefined. */
function _str(v) {
  return v != null && String(v).trim() ? String(v).trim() : "";
}
