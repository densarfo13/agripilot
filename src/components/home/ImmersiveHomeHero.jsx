/**
 * ImmersiveHomeHero — single full-bleed photo-backed panel that
 * absorbs the prior CropPlantHero + WeatherHeroActionCard +
 * LandHealthCard. Operator brief: "immersive agricultural
 * weather hero, real farmland imagery, atmospheric dark UI,
 * integrated layered surfaces, premium glow hierarchy".
 *
 *   <ImmersiveHomeHero
 *     mode="farm" | "garden"
 *     entity={farm}
 *     crop={cropCode}
 *     weather={weather}
 *     location={locationObj}
 *     landHealth={health}     // optional
 *     taskDone={taskDone}
 *     primaryGuidance={primaryGuidance}
 *     onUseMyLocation={() => ...}
 *     onPrimaryAction={() => ...}
 *   />
 *
 * Layout (top → bottom, single section, ~72vh on mobile)
 * ─────────────────────────────────────────────────────
 *   • Background photo  — real photograph from realVisuals
 *     resolver. Crop closeup if available; weather-state photo
 *     when conditions warrant; else regional / time-of-day
 *     fallback. onError swaps to atmospheric CSS gradient.
 *   • Atmospheric overlay — vertical gradient that darkens the
 *     lower 60% so caption text reads cleanly on any photo.
 *   • Top row — location chip + farm name (small, calm).
 *   • Center band — hero metric: temperature OR
 *     "Add location" prompt when no real weather data.
 *   • Bottom block — daily insight title, action line, single
 *     primary CTA. Land-health pill (Watch / Critical) sits
 *     inline when relevant.
 *
 * Strict-rule audit
 *   • Single photo `<img>` + single dark overlay div + three
 *     content rows. No fake SVG crop graphics. No emoji icons.
 *   • Self-suppresses nothing — even a fresh account gets a
 *     useful prompt + a CTA so the panel never reads empty.
 *   • Pure presentational. Read-only props. SSR-safe.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { resolveHeroImage, resolveCropCloseupImage } from '../../lib/realVisuals.jsx';

// Sealed status palette for the land-health pill — same tones the
// dedicated LandHealthCard used, scaled down to a chip.
const LAND_TONES = {
  healthy:  { bg: 'rgba(143,171,115,0.20)', border: 'rgba(143,171,115,0.45)', ink: '#A8C283' },
  watch:    { bg: 'rgba(214,161,61,0.22)',  border: 'rgba(214,161,61,0.48)',  ink: '#F0CB7A' },
  critical: { bg: 'rgba(198,90,75,0.24)',   border: 'rgba(198,90,75,0.52)',   ink: '#F1A89E' },
  unknown:  { bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.18)', ink: 'rgba(234,242,255,0.85)' },
};

function _LandLeafGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19c4 0 8-1 11-4s4-7 4-11c-4 0-8 1-11 4S5 15 5 19z"
            stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function _LocPinGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"
            stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round"/>
      <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
    </svg>
  );
}

function _RefreshGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 16-5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
      <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M21 12a9 9 0 0 1-16 5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
      <path d="M5 20v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function _formatTime(ts) {
  try {
    const ms = ts ? (typeof ts === 'number' ? ts : Date.parse(ts)) : NaN;
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function _ClockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Derive a calm best-time window from the weather snapshot. Rules
// kept deliberately tight — we only return a label when we have
// enough signal to be useful; otherwise null (the renderer hides
// the pill). This is what surfaces the trust-loop's "when to do it"
// answer without inventing scientific precision.
//   • Rain in the forecast → "Before rain"
//   • Hot midday (>30°)    → "Cooler hours" (early morning / evening)
//   • Before 11:00 local   → "This morning"
//   • 11:00–15:00 local    → "Midday window"
//   • 15:00–19:00 local    → "This afternoon"
//   • ≥19:00               → "This evening"
//   • No data              → null (renderer omits the chip)
function _deriveBestTime(w) {
  try {
    const safe = (w && typeof w === 'object') ? w : {};
    // Rain bias — if there's a meaningful rain chance, suggest acting
    // before it arrives. We treat ≥40% as the threshold the way most
    // farmers think about a rainy-day plan.
    const rainChance = Number(safe.rainChance ?? safe.precipChance ?? safe.pop);
    if (Number.isFinite(rainChance) && rainChance >= 40) {
      return tSafe('hero.bestTime.beforeRain', 'Before rain');
    }
    // Hot midday bias — when it's already very warm, the best window
    // is outside the heat.
    const temp = Number(safe.temp);
    const hour = (() => { try { return new Date().getHours(); } catch { return null; } })();
    if (Number.isFinite(temp) && temp >= 30 && Number.isFinite(hour) && hour >= 10 && hour < 16) {
      return tSafe('hero.bestTime.coolerHours', 'Cooler hours');
    }
    if (!Number.isFinite(hour)) return null;
    if (hour < 11) return tSafe('hero.bestTime.morning',   'This morning');
    if (hour < 15) return tSafe('hero.bestTime.midday',    'Midday window');
    if (hour < 19) return tSafe('hero.bestTime.afternoon', 'This afternoon');
    return tSafe('hero.bestTime.evening', 'This evening');
  } catch { return null; }
}

export default function ImmersiveHomeHero({
  mode = 'farm',
  entity = null,
  crop = null,
  weather = null,
  location = null,
  landHealth = null,
  taskDone = false,
  primaryGuidance = null,
  onUseMyLocation = null,
  onPrimaryAction = null,
  testId = 'immersive-home-hero',
}) {
  const isGarden = String(mode || 'farm').toLowerCase() === 'garden';
  const w = (weather && typeof weather === 'object') ? weather : {};

  // ─── Background photo resolution (session-stable) ─────────────
  // ATMOSPHERIC PERSISTENCE — the hero photo intentionally does
  // NOT depend on `weatherType`. Weather state updates every few
  // minutes (rain chance, condition refresh, etc.), and we don't
  // want the hero photo to swap mid-session as conditions shift.
  // The dynamic atmosphere (temperature, condition, feels-like)
  // lives in the center overlay and re-renders independently.
  //
  // The hour band IS used (sunrise → sunrise hero) but only when
  // ImmersiveHomeHero first mounts — recomputing on every render
  // would flicker the photo when React re-runs the useMemo for
  // unrelated reasons. We cache the resolved src in a ref so the
  // photo is stable across the full session.
  const photoRef = useRef(null);
  const photoSrc = useMemo(() => {
    // Return the cached src for the same (mode, crop, entity)
    // combination. This survives weather updates AND React's
    // own re-render churn.
    const cacheKey = `${mode}|${crop || ''}|${(entity && (entity.id || entity.name)) || ''}`;
    if (photoRef.current && photoRef.current.key === cacheKey) {
      return photoRef.current.src;
    }
    try {
      const country = entity && (entity.country || entity.countryCode || entity.countryLabel);
      const region  = entity && (entity.region  || entity.regionName);
      const hour = (() => { try { return new Date().getHours(); } catch { return null; } })();
      const closeup = crop ? resolveCropCloseupImage(crop) : null;
      const src = closeup || resolveHeroImage({
        mode, crop, country, region, hour,
        // weatherType deliberately omitted — see persistence note above.
      });
      photoRef.current = { key: cacheKey, src };
      return src;
    } catch { return null; }
  }, [mode, crop, entity]);
  const [photoErrored, setPhotoErrored] = useState(false);
  // Cinematic fade-in — opacity 0 on first paint, 1 once the
  // browser reports the image has loaded. Survives the seeded
  // pick (same key → same src → same loaded state).
  const [photoLoaded, setPhotoLoaded] = useState(false);
  useEffect(() => {
    // Reset the loaded flag whenever the resolved src changes so
    // a manual re-resolve (mode/crop swap) triggers a fresh fade.
    setPhotoLoaded(false);
  }, [photoSrc]);

  // ─── Live-data trust gate ─────────────────────────────────────
  const hasRealWeather = String(w.source || '') === 'weather-api'
    && w.temp != null && Number.isFinite(Number(w.temp))
    && typeof w.condition === 'string' && w.condition.trim()
    && w.condition !== 'Weather unavailable';

  const temp = hasRealWeather ? Math.round(Number(w.temp)) : null;
  // No fallback chatter when weather is missing — render an empty
  // string so the surrounding center block can collapse cleanly.
  // The location-prompt branch handles the no-weather UI below.
  const condition = hasRealWeather ? w.condition : '';
  const feelsLike = hasRealWeather && w.feelsLike != null && Number.isFinite(Number(w.feelsLike))
    ? Math.round(Number(w.feelsLike))
    : null;

  const locationLabel = (() => {
    const l = (w.locationLabel || w.location || '').toString().trim();
    if (l && l !== 'Your area') return l;
    if (entity && typeof entity === 'object') {
      const candidates = [entity.locationName, entity.region, entity.regionName];
      for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return tSafe('hero.yourArea', 'Your area');
  })();

  const accurateAsOf = _formatTime(w.fetchedAt || w.updatedAt || w.timestamp);

  const farmName = (() => {
    if (entity && typeof entity === 'object') {
      const candidates = [entity.name, entity.farmName, entity.label, entity.title];
      for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return isGarden
      ? tSafe('hero.defaultGarden', 'Your garden')
      : tSafe('hero.defaultFarm',   'Your farm');
  })();

  // ─── Action band copy ─────────────────────────────────────────
  // Prefer the orchestrator's primary guidance (already mode-
  // adapted + cooldown-gated). Falls back to a calm default.
  // Also derives a `bestTime` window + `estimatedMinutes` so the
  // hero band answers the spec's daily-trust-loop questions:
  //   what to do, why it matters, WHEN to do it, HOW LONG it takes.
  const action = (() => {
    if (taskDone) {
      return {
        title: tSafe('hero.onTrack',   "You’re on track today"),
        line:  tSafe('hero.checkLater', 'Check again tomorrow morning.'),
        cta:   tSafe('hero.scan',       'Scan'),
        bestTime: null,
        estimatedMinutes: null,
      };
    }
    const g = primaryGuidance && typeof primaryGuidance === 'object' ? primaryGuidance : null;
    if (g && g.title) {
      return {
        title: tSafe(g.title, g.title),
        line:  tSafe(g.message || g.reason || '', g.message || g.reason || ''),
        cta:   tSafe(g.actionLabel || 'Scan', g.actionLabel || 'Scan'),
        bestTime: _deriveBestTime(w),
        estimatedMinutes: Number.isFinite(Number(g.estimatedMinutes))
          ? Number(g.estimatedMinutes)
          : null,
      };
    }
    // No real guidance — no fallback chatter. Minimal CTA that
    // routes to Scan. Card-level surfaces (NextBestAction /
    // DailyBriefing) hide themselves when there's no real data.
    return {
      title: tSafe('hero.openScan', 'Open scan when you are ready'),
      line:  '',
      cta:   tSafe('hero.scan',    'Scan'),
      bestTime: null,
      estimatedMinutes: null,
    };
  })();

  // ─── Land-health pill — Farm mode only, only Watch/Critical ──
  const landPill = (() => {
    if (isGarden) return null;
    const status = landHealth && typeof landHealth === 'object'
      ? String(landHealth.status || '').toLowerCase()
      : '';
    if (status !== 'watch' && status !== 'critical') return null;
    const tone = LAND_TONES[status] || LAND_TONES.unknown;
    return { tone, label: status === 'critical'
      ? tSafe('hero.landCritical', 'Inspect crop today')
      : tSafe('hero.landWatch',    'Stress developing') };
  })();

  return (
    <section
      style={S.hero}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      data-has-real-weather={hasRealWeather ? 'true' : 'false'}
      data-real-photo={photoSrc && !photoErrored ? 'true' : 'false'}
    >
      {/* Background photograph — fades in over 700ms once the
          browser reports it loaded so the first paint never
          flashes the SVG fallback. Atmospheric persistence: the
          src is cached via photoRef so weather updates don't
          swap the photo, only the dynamic overlays above. */}
      {photoSrc && !photoErrored && (
        <img
          src={photoSrc}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={() => setPhotoLoaded(true)}
          onError={() => setPhotoErrored(true)}
          style={{
            ...S.photo,
            opacity: photoLoaded ? 1 : 0,
          }}
          data-testid={`${testId}-photo`}
        />
      )}

      {/* Atmospheric overlay — dark bottom half so caption reads
          on any photo. Subtle warm top tint keeps the panel from
          feeling cold. */}
      <div style={S.atmosphere} aria-hidden="true" />

      {/* TOP row — location + farm name + accurate-as-of */}
      <div style={S.topRow}>
        <span style={S.locChip}>
          <_LocPinGlyph />
          <span style={S.locText}>{locationLabel}</span>
        </span>
        {accurateAsOf && (
          <span style={S.asOfChip}>
            <_RefreshGlyph />
            <span style={S.asOfText}>{accurateAsOf}</span>
          </span>
        )}
      </div>

      {/* CENTER — hero metric or location prompt */}
      <div style={S.center}>
        {hasRealWeather ? (
          <>
            <span style={S.tempBig}>
              {temp}<span style={S.tempDeg}>°</span>
            </span>
            <span style={S.condition}>{condition}</span>
            {feelsLike != null && feelsLike !== temp && (
              <span style={S.feelsLike}>
                {tSafe('weather.feelsLike', 'Feels like')} {feelsLike}°
              </span>
            )}
          </>
        ) : (
          // No-weather state: render only a quiet single-button prompt
          // to enable location. No headline / body chatter — when real
          // weather is missing, the hero stays minimal until the user
          // grants location.
          typeof onUseMyLocation === 'function' ? (
            <button
              type="button"
              onClick={() => { try { onUseMyLocation(); } catch { /* swallow */ } }}
              style={S.promptCta}
              data-testid={`${testId}-use-my-location`}
            >
              <_LocPinGlyph />
              <span style={{ marginLeft: 6 }}>
                {tSafe('weather.useMyLocation', 'Use my location')}
              </span>
            </button>
          ) : null
        )}
      </div>

      {/* BOTTOM — action band */}
      <div style={S.bottomBand}>
        <span style={S.farmEyebrow}>{farmName}</span>
        <h2 style={S.actionTitle}>{action.title}</h2>
        <p style={S.actionLine}>{action.line}</p>
        {(action.bestTime || (action.estimatedMinutes != null)) && (
          <div style={S.metaRow} data-testid={`${testId}-meta`}>
            {action.bestTime && (
              <span style={S.metaChip} data-testid={`${testId}-best-time`}>
                <_ClockGlyph />
                <span style={{ marginLeft: 5 }}>{action.bestTime}</span>
              </span>
            )}
            {action.estimatedMinutes != null && (
              <span style={S.metaChip} data-testid={`${testId}-est-minutes`}>
                <span>
                  {action.estimatedMinutes}
                  {' '}
                  {tSafe('hero.minutesSuffix', 'min')}
                </span>
              </span>
            )}
          </div>
        )}
        <div style={S.actionRow}>
          {landPill && (
            <span
              style={{
                ...S.landPill,
                background: landPill.tone.bg,
                border: `1px solid ${landPill.tone.border}`,
                color: landPill.tone.ink,
              }}
              data-testid={`${testId}-land-pill`}
            >
              <_LandLeafGlyph />
              <span style={{ marginLeft: 4 }}>{landPill.label}</span>
            </span>
          )}
          {typeof onPrimaryAction === 'function' && (
            <button
              type="button"
              onClick={() => { try { onPrimaryAction(); } catch { /* swallow */ } }}
              style={S.cta}
              data-testid={`${testId}-cta`}
            >
              <span>{action.cta}</span>
              <span aria-hidden="true" style={S.ctaArrow}>{'→'}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const S = {
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    minHeight: '32rem',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.06) inset',
      '0 24px 48px -16px rgba(0,0,0,0.55)',
      '0 8px 18px -8px rgba(0,0,0,0.35)',
    ].join(', '),
    border: '1px solid rgba(255,255,255,0.08)',
  },
  photo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    filter: 'saturate(0.95) brightness(0.86)',
    // Cinematic fade-in — 700ms ease-out so the photo enters
    // gently after the browser reports it loaded. Pairs with
    // the photoLoaded state flag above; the inline opacity
    // override flips from 0 → 1 on load.
    transition: 'opacity 700ms ease-out',
    willChange: 'opacity',
  },
  atmosphere: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    background: [
      // Subtle warm sky glow at the top
      'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(200,148,77,0.10) 0%, rgba(0,0,0,0) 60%)',
      // Strong dark gradient at the bottom for caption legibility
      'linear-gradient(180deg, rgba(8,17,26,0.10) 0%, rgba(8,17,26,0.55) 55%, rgba(8,17,26,0.85) 100%)',
    ].join(', '),
  },
  topRow: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    gap: '0.5rem',
  },
  locChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.32rem 0.6rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    background: 'rgba(8,17,26,0.42)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 999,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  locText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '12rem',
  },
  asOfChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.28rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.78)',
    background: 'rgba(8,17,26,0.32)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 999,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  asOfText: {
    letterSpacing: '0.005em',
  },
  center: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 1.1rem',
    gap: '0.15rem',
  },
  tempBig: {
    fontSize: '5.5rem',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.0,
    color: '#FFFFFF',
    textShadow: '0 4px 24px rgba(0,0,0,0.55)',
  },
  tempDeg: {
    fontWeight: 600,
    marginLeft: -4,
  },
  condition: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.94)',
    textShadow: '0 2px 12px rgba(0,0,0,0.50)',
    marginTop: '0.25rem',
  },
  feelsLike: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.72)',
    marginTop: '0.15rem',
  },
  promptBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    maxWidth: '22rem',
  },
  promptTitle: {
    fontSize: '1.3rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: '#FFFFFF',
    textShadow: '0 2px 14px rgba(0,0,0,0.55)',
    lineHeight: 1.2,
  },
  promptBody: {
    fontSize: '0.88rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.4,
  },
  promptCta: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.55rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    color: '#FFFFFF',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  bottomBand: {
    position: 'relative',
    zIndex: 2,
    padding: '0.85rem 1.1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  farmEyebrow: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
  },
  actionTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: '#FFFFFF',
    lineHeight: 1.2,
    textShadow: '0 2px 12px rgba(0,0,0,0.50)',
  },
  actionLine: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem',
    marginTop: '0.35rem',
  },
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.22rem 0.55rem',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'rgba(234,242,255,0.88)',
    background: 'rgba(8,17,26,0.42)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999,
    letterSpacing: '0.005em',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  landPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    borderRadius: 999,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  cta: {
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.85rem 1.4rem',
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    background: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    minHeight: 48,
    minWidth: 144,
    justifyContent: 'center',
    boxShadow: '0 10px 28px rgba(185,133,63,0.45)',
    WebkitTapHighlightColor: 'transparent',
  },
  ctaArrow: {
    fontSize: '1.1rem',
    fontWeight: 800,
    lineHeight: 1,
  },
};
