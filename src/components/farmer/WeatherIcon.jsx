/**
 * WeatherIcon — small SVG icon driven by the WeatherContext
 * payload (or any object with the same shape).
 *
 * The icon picks one of six visual kinds:
 *   sunny / cloudy / rain / storm / hot / dry
 *
 * Why a dedicated component
 * ─────────────────────────
 * Several surfaces (FarmerHeader chip, the new Weather Intelligence
 * card on Home, the Today's-farm-action mini-card on My Farm) all
 * need a consistent visual when the same condition applies. Keeping
 * this in one component means a single change ripples everywhere.
 *
 * Inputs
 * ──────
 * Pass either:
 *   • `kind` — explicit string from the six kinds above, OR
 *   • the entire `weather` summary; the resolver below extracts the
 *     kind from the existing fields the WeatherContext exposes
 *     (`tempC`, `rainfallState`, `precip*Mm*`, `pop`).
 *
 * Strict rules honoured
 * ─────────────────────
 *   • Never throws on bad input.
 *   • Returns null when the payload says nothing (parent decides
 *     whether to show a placeholder).
 *   • No new fetch — pure derivation from the supplied data.
 */

import { useMemo } from 'react';

const KINDS = Object.freeze(['sunny', 'cloudy', 'rain', 'storm', 'hot', 'dry']);

const TONE = Object.freeze({
  sunny:  { bg: 'rgba(245,158,11,0.16)', fg: '#FCD34D', border: 'rgba(245,158,11,0.40)' },
  cloudy: { bg: 'rgba(148,163,184,0.16)', fg: '#CBD5F5', border: 'rgba(148,163,184,0.45)' },
  rain:   { bg: 'rgba(14,165,233,0.16)', fg: '#7DD3FC', border: 'rgba(14,165,233,0.45)' },
  storm:  { bg: 'rgba(168,85,247,0.18)', fg: '#D8B4FE', border: 'rgba(168,85,247,0.55)' },
  hot:    { bg: 'rgba(239,68,68,0.18)',  fg: '#FCA5A5', border: 'rgba(239,68,68,0.45)' },
  dry:    { bg: 'rgba(217,119,6,0.18)',  fg: '#FED7AA', border: 'rgba(217,119,6,0.45)' },
});

function _toFiniteNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Derive a kind from a weather summary.
 *
 *   storm  → rainfall state ∈ {storm, thunder, severe_*} OR very high pop+precip
 *   rain   → rainfall state ∈ {raining, rainingNow, rainLater, *_rain}
 *   hot    → tempC ≥ 32
 *   dry    → rainfallState === 'dry' OR low pop + low forecast precip
 *   cloudy → no rain signal but pop ≥ 30
 *   sunny  → otherwise (default for clear daylight payloads)
 */
export function pickWeatherKind(weather) {
  if (!weather || typeof weather !== 'object') return null;
  if (weather.status === 'unavailable') return null;

  const stateRaw = weather.rainfallState
                  ?? weather.rainfall
                  ?? weather.condition
                  ?? '';
  const state = String(stateRaw).toLowerCase();

  // Storm signals — explicit enums or composite "heavy + thunder" hints.
  if (state.includes('storm') || state.includes('thunder')
      || state === 'severe' || state === 'severe_rain') {
    return 'storm';
  }

  const tempC = _toFiniteNumber(weather.tempC ?? weather.temperatureC ?? weather.temp);
  if (tempC != null && tempC >= 32) return 'hot';

  // Rain signals.
  if (state === 'rain' || state === 'raining' || state === 'rainingnow'
      || state === 'rainlater' || state.endsWith('_rain')
      || state === 'heavyrain') {
    return state.includes('heavy') ? 'storm' : 'rain';
  }

  // Dry vs cloudy fallback by precipitation chance.
  const pop  = _toFiniteNumber(weather.precipitationProbability ?? weather.pop);
  const mm24 = _toFiniteNumber(weather.precipMm24h ?? weather.precipMm);
  if (state === 'dry' || state === 'verydry' || state === 'very_dry'
      || (pop != null && pop < 20 && (mm24 == null || mm24 < 1))) {
    // Hot+dry already returned above; everything else here is just dry.
    return 'dry';
  }

  if (pop != null && pop >= 30) return 'cloudy';
  return 'sunny';
}

/**
 * @param {object} props
 * @param {string} [props.kind]   explicit kind override
 * @param {object} [props.weather] WeatherContext payload (used when no `kind`)
 * @param {number} [props.size=22] pixel edge of the chip
 * @param {string} [props.title]   accessible label
 * @returns {JSX.Element|null}
 */
export default function WeatherIcon({
  kind,
  weather = null,
  size = 22,
  title,
  className = '',
}) {
  const resolved = useMemo(
    () => (kind && KINDS.includes(kind)) ? kind : pickWeatherKind(weather),
    [kind, weather],
  );
  if (!resolved) return null;

  const tone = TONE[resolved];
  const half = size / 2;

  // SVG paths drawn in the chip's foreground colour. Each kind's
  // composition is small (≤ 4 primitives) so the icon stays crisp
  // at 18–28 px. viewBox is 0 0 24 24 to match Lucide's grid.
  const fg = tone.fg;
  const stroke = fg;
  const strokeWidth = 1.5;

  const cap = 'round';
  const join = 'round';

  let body = null;
  switch (resolved) {
    case 'sunny':
      body = (
        <>
          <circle cx="12" cy="12" r="4" fill={fg} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1={12 + 7  * Math.cos(deg * Math.PI / 180)}
              y1={12 + 7  * Math.sin(deg * Math.PI / 180)}
              x2={12 + 10 * Math.cos(deg * Math.PI / 180)}
              y2={12 + 10 * Math.sin(deg * Math.PI / 180)}
              stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap}
            />
          ))}
        </>
      );
      break;
    case 'cloudy':
      body = (
        <path
          d="M7 16 Q4 16 4 13 Q4 10 7 10 Q8 6 13 6 Q18 6 18 11 Q21 11 21 14 Q21 16 18 16 Z"
          fill={fg}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin={join}
        />
      );
      break;
    case 'rain':
      body = (
        <>
          <path
            d="M7 12 Q4 12 4 9 Q4 6 7 6 Q8 3 13 3 Q18 3 18 7 Q21 7 21 10 Q21 12 18 12 Z"
            fill={fg}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin={join}
          />
          {[8, 12, 16].map((x) => (
            <line key={x} x1={x} y1={15} x2={x - 2} y2={20}
                  stroke={stroke} strokeWidth={strokeWidth + 0.4} strokeLinecap={cap} />
          ))}
        </>
      );
      break;
    case 'storm':
      body = (
        <>
          <path
            d="M7 11 Q4 11 4 8 Q4 5 7 5 Q8 2 13 2 Q18 2 18 6 Q21 6 21 9 Q21 11 18 11 Z"
            fill={fg}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin={join}
          />
          <polygon
            points="11,12 14,12 12,17 15,17 10,23 12,18 9,18"
            fill={fg}
            stroke={stroke}
            strokeWidth={strokeWidth - 0.3}
            strokeLinejoin={join}
          />
        </>
      );
      break;
    case 'hot':
      body = (
        <>
          {/* thermometer */}
          <rect x="10" y="3" width="4" height="13" rx="2" stroke={stroke} strokeWidth={strokeWidth} fill="none" />
          <circle cx="12" cy="18" r="3" fill={fg} />
          <line x1="12" y1="6" x2="12" y2="14" stroke={fg} strokeWidth={strokeWidth + 0.5} strokeLinecap={cap} />
        </>
      );
      break;
    case 'dry':
      body = (
        <>
          <circle cx="12" cy="12" r="3.5" fill={fg} />
          {/* cracked-earth lines under the sun */}
          <line x1="3"  y1="20" x2="9"  y2="20" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} />
          <line x1="11" y1="20" x2="15" y2="20" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} />
          <line x1="17" y1="20" x2="21" y2="20" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap} />
          {/* small rays */}
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1={12 + 5 * Math.cos(deg * Math.PI / 180)}
              y1={12 + 5 * Math.sin(deg * Math.PI / 180)}
              x2={12 + 8 * Math.cos(deg * Math.PI / 180)}
              y2={12 + 8 * Math.sin(deg * Math.PI / 180)}
              stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={cap}
            />
          ))}
        </>
      );
      break;
    default:
      body = null;
  }

  return (
    <span
      className={('weather-icon weather-icon--' + resolved + ' ' + className).trim()}
      data-kind={resolved}
      role="img"
      aria-label={title || resolved}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width:  size + 8,
        height: size + 8,
        borderRadius: 999,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        flex: '0 0 auto',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        {body}
      </svg>
    </span>
  );
}

WeatherIcon.KINDS = KINDS;
