/**
 * TrustBadge + TrustChecklist — small, reusable presentation bits
 * for the operational-trust surface.
 *
 * Keeps logic out of the UI: all the thinking happens in
 * `lib/trust/trustProfile.js`. These components just read the
 * frozen profile object and render.
 *
 *   <TrustBadge profile={profile} />
 *     — one pill: "Strong · 5/6" with a tone-coloured background.
 *
 *   <TrustChecklist profile={profile} />
 *     — unordered list of the 6 signals with ✓ / — marks.
 *
 *   <TrustNextActions profile={profile} />
 *     — up to 3 next-best actions for the farmer guidance loop.
 *
 * No buttons, no navigation, no screen-level state. Drop-in where
 * the existing farmer/org views already render summary chips so
 * we don't redesign the UX.
 */

import { useTranslation } from '../../i18n/index.js';

const TONE = Object.freeze({
  high:   { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',  color: '#86EFAC' },
  medium: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#FDE68A' },
  low:    { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  color: '#FCA5A5' },
});

function toneFor(level) {
  return TONE[level] || TONE.low;
}

function resolveWith(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

/**
 * Small coloured pill summarising the profile level + score.
 * Render inline next to an existing title — no layout of its own.
 */
export function TrustBadge({ profile, compact = false, style }) {
  const { t } = useTranslation();
  if (!profile || typeof profile !== 'object') return null;

  const tone = toneFor(profile.level);
  const label = profile.levelLabel
    || resolveWith(t, `trust.level.${profile.level}`, profile.level);
  const text = compact
    ? label
    : `${label} \u00B7 ${profile.score}/${profile.max}`;

  return (
    <span
      data-testid="trust-badge"
      data-level={profile.level}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: 999,
        background: tone.bg, border: `1px solid ${tone.border}`,
        color: tone.color, fontSize: 12, fontWeight: 700,
        lineHeight: 1.6, letterSpacing: 0.2,
        ...style,
      }}
    >
      {text}
    </span>
  );
}

/**
 * Visible component checklist — all 6 signals listed in the
 * canonical trust-profile order. Met = green ✓, unmet = grey em-dash.
 */
export function TrustChecklist({ profile, style }) {
  const { t } = useTranslation();
  if (!profile || !Array.isArray(profile.checklist)) return null;

  return (
    <ul
      data-testid="trust-checklist"
      style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 4,
        ...style,
      }}
    >
      {profile.checklist.map((item) => {
        const label = resolveWith(t, item.labelKey, item.label);
        return (
          <li
            key={item.id}
            data-signal={item.id}
            data-met={item.met ? 'yes' : 'no'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13,
              color: item.met ? '#86EFAC' : 'rgba(255,255,255,0.55)',
            }}
          >
            <span style={{ width: 14, display: 'inline-block', textAlign: 'center' }}>
              {item.met ? '\u2713' : '\u2014'}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Farmer-facing next-best-actions list — the guidance loop.
 * Shows up to `limit` (default 3) missing-signal prompts so the
 * farmer can improve their own data quality. Renders nothing
 * when the profile is complete.
 */
export function TrustNextActions({ profile, limit = 3, style }) {
  const { t } = useTranslation();
  if (!profile || !Array.isArray(profile.nextActions)) return null;
  if (profile.nextActions.length === 0) return null;

  const header = resolveWith(
    t,
    'trust.nextActions.header',
    'Improve your profile',
  );

  return (
    <div
      data-testid="trust-next-actions"
      style={{
        padding: '10px 12px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        ...style,
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
        color: 'rgba(255,255,255,0.7)', marginBottom: 6,
      }}>
        {header}
      </div>
      <ul style={{ listStyle: 'disc', paddingLeft: 18, margin: 0, fontSize: 13 }}>
        {profile.nextActions.slice(0, limit).map((a) => (
          <li key={a.id} data-action={a.id} style={{ marginTop: 2 }}>
            {resolveWith(t, a.actionKey, a.label)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TrustBadge;
