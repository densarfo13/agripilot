/**
 * CalmHomeHero — calm full-screen assistant-style Home hero.
 *
 * Spec: REDESIGN FARROWAY HOME PAGE INSPIRED BY CALM FULL-SCREEN ASSISTANT UI
 *
 * Layout (top → bottom):
 *   1. Top status row  — online dot · language pill · mode pill · notification bell
 *   2. Weather pill    — inline, never hidden ("☀️ Dry today")
 *   3. Illustration    — large emoji with soft glow ring + gentle pulse
 *   4. Headline        — big white, task-driven or mode-fallback
 *   5. Subtext         — muted guidance from task / weather
 *   6. Primary pill CTA
 *   7. Secondary scan link  (hidden in done state)
 *   8. Completed state — "Done for today ✓" pill + "Check again tomorrow" hint
 *
 * Farmer mode (default):
 *   Illustration: 🌾  (amber glow)
 *   Headline:     "Inspect your crop today"
 *   Subtext:      "Dry conditions may affect your field."
 *   Primary CTA:  "Inspect now ✓"
 *   Secondary:    "Scan crop →"
 *
 * Garden / Backyard mode:
 *   Illustration: 🪴  (green glow)
 *   Headline:     "Check your plant today"
 *   Subtext:      "Soil may still be moist. Check before watering."
 *   Primary CTA:  "Check now ✓"
 *   Secondary:    "Scan your plant →"
 *
 * Done state (loopState COMPLETED / ALL_DONE):
 *   Illustration: 🌱  (celebration green glow)
 *   Headline:     "Nice — you stayed ahead today 🌱"
 *   Subtext:      "Check again tomorrow morning"
 *   Primary CTA:  "Done for today ✓"  (disabled, muted)
 *   Secondary:    hidden
 *
 * Strict-rule audit
 *   • Inline styles only — no CSS modules or external classes
 *   • Never throws — every data read wrapped in try/catch
 *   • tSafe() for all visible strings with English fallbacks
 *   • React hooks called unconditionally (rules-of-hooks safe)
 *   • No network I/O — purely presentational, all data via props
 *   • Animation via injected @keyframes (once per document) +
 *     inline transition strings — no external CSS dependency
 */

import { useState, useEffect } from 'react';
import NotificationBell from '../NotificationBell.jsx';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import { tSafe } from '../../i18n/tSafe.js';

// ── Animation keyframes — injected once into <head> ─────────────────────────
// Three independent animations:
//   calmGlowPulse   — slow radial glow breathe (illustration ring)
//   calmFadeSlideUp — fade + small upward slide for hero content
// Using document injection (not <style> JSX) because the keyframes
// must be global; React can't apply @keyframes via inline style props.
const _KEYFRAMES = `
@keyframes calmGlowPulse {
  0%   { transform: scale(1);    opacity: 0.50; }
  50%  { transform: scale(1.08); opacity: 0.75; }
  100% { transform: scale(1);    opacity: 0.50; }
}
@keyframes calmGlowPulseDone {
  0%   { transform: scale(1);    opacity: 0.40; }
  50%  { transform: scale(1.10); opacity: 0.65; }
  100% { transform: scale(1);    opacity: 0.40; }
}
`;

let _kfInjected = false;
function _ensureKeyframes() {
  if (_kfInjected) return;
  _kfInjected = true;
  try {
    if (typeof document === 'undefined') return;
    const existing = document.querySelector('[data-calm-home-kf]');
    if (existing) return;
    const el = document.createElement('style');
    el.setAttribute('data-calm-home-kf', '1');
    el.textContent = _KEYFRAMES;
    document.head.appendChild(el);
  } catch { /* swallow — never block render */ }
}

// ── Weather pill derivation ──────────────────────────────────────────────────
// Priority: use pre-processed weatherDecision (already in the loop's output)
// then fall back to deriving from the raw weather object. The fallback covers
// the case where weatherDecision is null (e.g. offline or API miss).
function _deriveWeatherPill(weather, weatherDecision) {
  try {
    // Prefer the loop's pre-processed decision chip (best enrichment)
    if (weatherDecision && weatherDecision.chipIcon && weatherDecision.actionLine) {
      return {
        emoji: String(weatherDecision.chipIcon),
        text:  String(weatherDecision.actionLine),
      };
    }
    if (!weather) {
      return { emoji: '🌤️', text: tSafe('home.weather.good', 'Good day today') };
    }
    const rain     = weather.rainChance ?? weather.rain ?? weather.precipChance ?? 0;
    const temp     = weather.temperatureC ?? weather.temp ?? weather.temperature ?? null;
    const humidity = weather.humidity ?? weather.relativeHumidity ?? null;
    const wind     = weather.windKmh ?? weather.wind ?? weather.windSpeed ?? null;
    if (rain >= 60)                             return { emoji: '🌧️', text: tSafe('home.weather.rain',      'Rain expected')    };
    if (rain >= 30)                             return { emoji: '🌦️', text: tSafe('home.weather.lightRain', 'Chance of rain')   };
    if (temp !== null && temp > 32)             return { emoji: '☀️',  text: tSafe('home.weather.hotDry',   'Dry and hot today') };
    if (humidity !== null && humidity > 75)     return { emoji: '💧',  text: tSafe('home.weather.humid',    'Humid today')      };
    if (wind !== null && wind > 30)             return { emoji: '💨',  text: tSafe('home.weather.windy',    'Windy today')      };
    if (temp !== null && temp > 26)             return { emoji: '🌤️', text: tSafe('home.weather.warm',     'Warm and clear')   };
    return                                             { emoji: '☀️',  text: tSafe('home.weather.good',     'Good day today')  };
  } catch {
    return { emoji: '🌤️', text: '' };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {boolean} props.isGarden        — garden/backyard mode (true) vs farmer mode (false)
 * @param {boolean} props.isDone          — primary task completed for today
 * @param {object}  props.weather         — raw weather object from useFarmerLoop
 * @param {object}  props.weatherDecision — enriched weatherDecision from useFarmerLoop
 * @param {string}  props.headline        — hero headline (pre-derived in Dashboard)
 * @param {string}  props.subtext         — hero subtext  (pre-derived in Dashboard)
 * @param {string}  props.ctaLabel        — primary CTA label (pre-derived in Dashboard)
 * @param {boolean} props.isOnline        — network state
 * @param {string}  props.language        — active language code (e.g. 'en', 'tw')
 * @param {string}  props.userId          — user id for NotificationBell (null = hide bell)
 * @param {object}  props.profile         — active farm / garden profile (null if none)
 * @param {function} props.onPrimaryAction — CTA tap handler
 * @param {function} props.onScan         — secondary scan tap handler
 */
export default function CalmHomeHero({
  isGarden       = false,
  isDone         = false,
  weather        = null,
  weatherDecision = null,
  headline       = '',
  subtext        = '',
  ctaLabel       = '',
  isOnline       = true,
  language       = 'en',
  userId         = null,
  profile        = null,
  onPrimaryAction,
  onScan,
}) {
  // Staggered mount flag drives the CSS transitions below.
  // Set to true on the next tick after mount so the browser has
  // painted the initial (invisible) state before animating in.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    _ensureKeyframes();
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  // ── Derived values ───────────────────────────────────────────
  const weatherPill = _deriveWeatherPill(weather, weatherDecision);

  // Illustration & glow adapt per mode and done state
  const illustration = isDone ? '🌱' : isGarden ? '🪴' : '🌾';
  const glowColor    = isDone
    ? 'rgba(134,239,172,0.40)'   // green celebration
    : isGarden
      ? 'rgba(52,211,153,0.35)'  // teal for garden
      : 'rgba(251,191,36,0.30)'; // amber for farmer

  // Notification bell: gated by feature flag and userId presence
  const showBell = !!(isFeatureEnabled('FEATURE_NOTIFICATIONS') && userId);

  // Language pill: show up to 2 characters ("EN", "TW", etc.)
  const langCode = language ? String(language).toUpperCase().slice(0, 2) : null;

  // ── Transition helpers ────────────────────────────────────────
  // Each hero element has a slightly different delay so they
  // cascade in smoothly rather than all popping at once.
  const t0 = 'opacity 0.55s ease 0.00s, transform 0.55s ease 0.00s';
  const t1 = 'opacity 0.60s ease 0.12s, transform 0.60s ease 0.12s';
  const t2 = 'opacity 0.60s ease 0.24s, transform 0.60s ease 0.24s';
  const t3 = 'opacity 0.55s ease 0.36s, transform 0.55s ease 0.36s';
  const t4 = 'opacity 0.50s ease 0.48s';

  const fadeIn  = { opacity: mounted ? 1 : 0, transition: t0 };
  const slide1  = { opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: t1 };
  const slide2  = { opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)',  transition: t2 };
  const slide3  = { opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: t3 };
  const fade4   = { opacity: mounted ? 1 : 0, transition: t4 };

  return (
    <div style={S.page} data-testid="calm-home-hero">

      {/* ── 1. Top status row ─────────────────────────────────── */}
      <div style={S.topRow}>
        <div style={S.topLeft}>
          {/* Online / offline dot */}
          <span
            style={{
              ...S.onlineDot,
              background: isOnline ? '#22C55E' : '#EF4444',
              boxShadow: isOnline ? '0 0 5px rgba(34,197,94,0.7)' : 'none',
            }}
            aria-hidden="true"
          />
          <span style={S.onlineLabel} aria-live="polite">
            {isOnline
              ? tSafe('home.status.online',  'Online')
              : tSafe('home.status.offline', 'Offline')}
          </span>

          {/* Language pill */}
          {langCode && (
            <span style={S.langPill} aria-label={`Language: ${language}`}>
              {langCode}
            </span>
          )}

          {/* Mode pill */}
          <span
            style={{
              ...S.modePill,
              ...(isGarden ? S.modePillGarden : S.modePillFarmer),
            }}
          >
            {isGarden
              ? tSafe('home.mode.garden', 'GARDEN')
              : tSafe('home.mode.farmer', 'FARMER')}
          </span>
        </div>

        {/* Notification bell */}
        {showBell && (
          <div style={S.topRight}>
            <NotificationBell userId={userId} testId="calm-home-bell" />
          </div>
        )}
      </div>

      {/* ── 2–8. Hero area ────────────────────────────────────── */}
      <div style={S.heroArea}>

        {/* 2. Weather pill — always visible, never hidden */}
        {weatherPill.text ? (
          <div style={{ ...S.weatherPill, ...fadeIn }} data-testid="calm-home-weather">
            <span aria-hidden="true">{weatherPill.emoji}</span>
            <span style={S.weatherPillText}>{weatherPill.text}</span>
          </div>
        ) : (
          // Even if text is empty, preserve vertical rhythm
          <div style={{ ...S.weatherPill, ...fadeIn, opacity: 0 }} aria-hidden="true">
            <span>🌤️</span>
          </div>
        )}

        {/* 3. Illustration — emoji + glow ring */}
        <div style={{ ...S.illustrationWrap, ...slide1 }} aria-hidden="true">
          {/* Glow ring — animated radial gradient */}
          <div
            style={{
              ...S.glowRing,
              background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 68%)`,
              animation: isDone
                ? 'calmGlowPulseDone 4s ease-in-out infinite'
                : 'calmGlowPulse 3.5s ease-in-out infinite',
            }}
          />
          {/* Crop / plant emoji */}
          <div style={S.illustrationEmoji}>{illustration}</div>
        </div>

        {/* 4. Headline */}
        <h1 style={{ ...S.headline, ...slide2 }} data-testid="calm-home-headline">
          {headline || (isDone
            ? tSafe('home.hero.done.headline', 'You stayed ahead today 🌱')
            : isGarden
              ? tSafe('home.hero.garden.headline', 'Check your plant today')
              : tSafe('home.hero.farmer.headline', 'Inspect your crop today')
          )}
        </h1>

        {/* 5. Subtext */}
        <p style={{ ...S.subtext, ...slide3 }} data-testid="calm-home-subtext">
          {subtext || (isDone
            ? tSafe('home.hero.done.subtext', 'Check again tomorrow morning')
            : isGarden
              ? tSafe('home.hero.garden.subtext', 'Soil may still be moist. Check before watering.')
              : tSafe('home.hero.farmer.subtext', 'Dry conditions may affect your field.')
          )}
        </p>

        {/* 6. Primary CTA — rounded pill */}
        <button
          type="button"
          onClick={() => {
            try { onPrimaryAction?.(); }
            catch { /* swallow — CTA never crashes Home */ }
          }}
          disabled={isDone}
          style={{
            ...S.primaryBtn,
            ...(isDone ? S.primaryBtnDone : {}),
            ...fade4,
          }}
          data-testid="calm-home-primary-cta"
          aria-label={ctaLabel || undefined}
        >
          {ctaLabel || (isDone
            ? tSafe('home.hero.done.cta',    'Done for today ✓')
            : isGarden
              ? tSafe('home.hero.garden.cta', 'Check now ✓')
              : tSafe('home.hero.farmer.cta', 'Inspect now ✓')
          )}
        </button>

        {/* 7. Secondary scan link (hidden in done state) */}
        {!isDone && (
          <button
            type="button"
            onClick={() => {
              try { onScan?.(); }
              catch { /* swallow */ }
            }}
            style={{ ...S.secondaryBtn, ...fade4 }}
            data-testid="calm-home-secondary-scan"
          >
            {isGarden
              ? tSafe('home.cta.scanPlant', 'Scan your plant')
              : tSafe('home.cta.scanCrop',  'Scan crop')}
            <span aria-hidden="true" style={{ marginLeft: 5 }}>{'→'}</span>
          </button>
        )}

        {/* 8. Done state: tomorrow hook */}
        {isDone && (
          <p style={{ ...S.tomorrowText, ...fade4 }} data-testid="calm-home-tomorrow">
            {tSafe('home.hero.done.tomorrow', 'Check again tomorrow morning')}
          </p>
        )}

      </div>
      {/* end heroArea */}

    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
// All inline — matches the codebase convention throughout Farroway.
// Navy-teal gradient background gives the full-screen assistant feel
// without conflicting with the card-heavy tabs (My Farm, Tasks, Progress).
const S = {

  // Full-screen page container
  page: {
    minHeight: '100vh',
    // Deep navy → dark teal: calm, alive, premium
    background: 'linear-gradient(160deg, #061424 0%, #091d2c 38%, #051b14 100%)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    // Bottom padding clears the BottomTabNav (~64px) + breathing room
    paddingBottom: '5rem',
    overflowX: 'hidden',
  },

  // ── Top status row ────────────────────────────────────────────
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem 0.5rem',
    flexShrink: 0,
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Online / offline indicator
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
    transition: 'background 0.3s ease, box-shadow 0.3s ease',
  },
  onlineLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 500,
    letterSpacing: '0.01em',
  },

  // Language pill — compact 2-char code
  langPill: {
    fontSize: '0.625rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 999,
    padding: '2px 7px',
    userSelect: 'none',
  },

  // Mode pill — FARMER (amber) or GARDEN (green)
  modePill: {
    fontSize: '0.625rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    borderRadius: 999,
    padding: '2px 9px',
    border: '1px solid',
    userSelect: 'none',
  },
  modePillFarmer: {
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.28)',
  },
  modePillGarden: {
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.28)',
  },

  // ── Hero area ─────────────────────────────────────────────────
  // Centered column; takes remaining vertical space.
  heroArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem 1.75rem 1rem',
    textAlign: 'center',
  },

  // ── Weather pill ──────────────────────────────────────────────
  // Sits directly above the illustration. Frosted-glass look.
  weatherPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999,
    padding: '0.325rem 0.9rem',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 500,
    letterSpacing: '0.01em',
    marginBottom: '1.75rem',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  weatherPillText: {
    lineHeight: 1.3,
  },

  // ── Illustration ──────────────────────────────────────────────
  // A fixed-size wrapper that positions the emoji above the glow.
  illustrationWrap: {
    position: 'relative',
    width: 148,
    height: 148,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.75rem',
    flexShrink: 0,
  },
  // Animated glow ring — a large radial gradient behind the emoji.
  // Sized larger than the wrapper so it bleeds out softly.
  glowRing: {
    position: 'absolute',
    top: '-30%',
    left: '-30%',
    width: '160%',
    height: '160%',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  // The emoji itself — large, drop-shadowed, above the glow.
  illustrationEmoji: {
    fontSize: '5.25rem',
    lineHeight: 1,
    position: 'relative',
    zIndex: 1,
    userSelect: 'none',
    // Soft drop shadow so the emoji lifts off the dark background
    filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.45))',
  },

  // ── Headline ──────────────────────────────────────────────────
  headline: {
    // Responsive: 1.6rem on small phones → 2.25rem on wider screens
    fontSize: 'clamp(1.6rem, 5.5vw, 2.25rem)',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.2,
    margin: '0 0 0.875rem',
    letterSpacing: '-0.015em',
    maxWidth: 320,
  },

  // ── Subtext ───────────────────────────────────────────────────
  subtext: {
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.52)',
    lineHeight: 1.6,
    margin: '0 0 2rem',
    maxWidth: 295,
  },

  // ── Primary CTA — rounded pill, full-width up to maxWidth ─────
  primaryBtn: {
    display: 'block',
    width: '100%',
    maxWidth: 320,
    padding: '1rem 1.5rem',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 56,
    letterSpacing: '0.01em',
    boxShadow: '0 8px 28px rgba(34,197,94,0.38)',
    fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
    marginBottom: '0.875rem',
    // Smooth press feedback
    transition: 'transform 0.1s ease, box-shadow 0.2s ease, opacity 0.55s ease 0.48s',
  },
  // Done state: muted green ghost button — action is complete, no pressure
  primaryBtnDone: {
    background: 'rgba(34,197,94,0.12)',
    boxShadow: 'none',
    cursor: 'default',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.28)',
  },

  // ── Secondary scan link ───────────────────────────────────────
  // Low-emphasis: text button below the primary CTA
  secondaryBtn: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.50)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.5rem 1rem',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.25rem',
    lineHeight: 1.4,
  },

  // ── Tomorrow hook (done state) ────────────────────────────────
  tomorrowText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.35)',
    margin: '0.625rem 0 0',
    lineHeight: 1.55,
  },
};
