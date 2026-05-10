/**
 * BackyardGuard — wraps farm-only routes (Sell, Opportunities)
 * and adapts the surface to the active context.
 *
 * Context-driven UI spec §6 — instead of silently redirecting a
 * backyard / garden user to /home (the previous behaviour), we
 * render a calm empty-state card explaining why the surface is
 * empty for them and offering an "+ Add a farm" CTA. The user
 * never lands on a feature they can't use, but they also keep
 * agency — one tap creates the farm and unlocks the surface.
 *
 *   <BackyardGuard surface="funding">
 *     <Opportunities />
 *   </BackyardGuard>
 *
 *   <BackyardGuard surface="sell">
 *     <Sell />
 *   </BackyardGuard>
 *
 * Surface prop drives the empty-state copy (spec §6):
 *   • 'funding' \u2192 "Funding is available for farms only."
 *   • 'sell'    \u2192 "Selling is available for farms only."
 *   • default   \u2192 generic "available for farms only."
 *
 * Behaviour
 *   • Reads activeContextType via useExperience (preferred) and
 *     falls back to the legacy country+farmType heuristic when
 *     the experience snapshot is unavailable.
 *   • Garden context \u2192 render the empty-state card; never the
 *     wrapped child. No redirect (spec §6 \u2014 the user sees the
 *     intent, not a silent bounce).
 *   • Farm context (or unknown) \u2192 render children unchanged.
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • Never throws \u2014 ProfileContext / useExperience calls all
 *     try/catch wrapped.
 *   • All visible text via tSafe with English fallbacks.
 *   • No flash: while profile is still loading we render nothing
 *     so the underlying farmer page can't peek through.
 */

import { useProfile } from '../../context/ProfileContext.jsx';
import { useNavigate } from 'react-router-dom';
import { shouldUseBackyardExperience } from '../../config/regionConfig.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { tSafe } from '../../i18n/tSafe.js';
import useExperience from '../../hooks/useExperience.js';

// Soft Ochre / Beige unified system. Replaces the legacy
// dark-navy + neon-green inline tokens — this empty-state card
// now ships on 8+ commercial routes in garden mode (per the Garden
// Mode Refactor §3 leakage cleanup), so it must render in the same
// palette as every other garden surface or it looks broken.
const C = Object.freeze({
  bgTop:   '#F6F1E7',
  bgBot:   '#EFE7D5',
  panel:   '#FFFFFF',
  border:  'rgba(36,49,58,0.08)',
  ink:     '#1F2933',
  inkDim:  '#667085',
  ochre:        '#C8944D',
  ochreActive:  '#B9853F',
});

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBot} 100%)`,
    color: C.ink,
    padding: '1.25rem 1rem 6rem',
    display: 'flex', justifyContent: 'center',
  },
  card: {
    width: '100%', maxWidth: 480,
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: '1.5rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: 12,
    textAlign: 'center', alignSelf: 'flex-start',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 8px 24px rgba(15,23,42,0.06)',
  },
  emoji: { fontSize: '2rem', lineHeight: 1, marginBottom: 4 },
  title: { margin: 0, fontSize: '1.15rem', fontWeight: 800, color: C.ink },
  body:  { margin: 0, fontSize: '0.95rem', color: C.inkDim, lineHeight: 1.5 },
  primaryBtn: {
    appearance: 'none', display: 'block', width: '100%',
    border: 'none',
    background: `linear-gradient(180deg, ${C.ochre} 0%, ${C.ochreActive} 100%)`,
    color: '#FFFFFF',
    borderRadius: 12, padding: '0.85rem 1rem',
    fontSize: '0.95rem', fontWeight: 800,
    cursor: 'pointer', minHeight: 48, fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(200,148,77,0.32)',
    marginTop: 6,
  },
  ghostBtn: {
    appearance: 'none', display: 'block', width: '100%',
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 12, padding: '0.7rem 1rem',
    fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
};

function _surfaceCopy(surface) {
  switch (surface) {
    case 'funding':
      return {
        emoji:  '\uD83C\uDF31',
        title:  tSafe('contextEmpty.funding.title',
          'This feature is for farm mode.'),
        body:   tSafe('contextEmpty.funding.body',
          'Add a farm \u2014 even a small one \u2014 to unlock funding programs and matched opportunities.'),
        cta:    tSafe('contextEmpty.funding.cta', 'Add a farm'),
      };
    case 'sell':
      return {
        emoji:  '\uD83D\uDED2',
        title:  tSafe('contextEmpty.sell.title',
          'This feature is for farm mode.'),
        body:   tSafe('contextEmpty.sell.body',
          'Add a farm to list crops on the market and connect with buyers.'),
        cta:    tSafe('contextEmpty.sell.cta', 'Add a farm'),
      };
    default:
      return {
        emoji:  '\uD83C\uDF31',
        title:  tSafe('contextEmpty.default.title',
          'This feature is for farm mode.'),
        body:   tSafe('contextEmpty.default.body',
          'Add a farm to access this feature.'),
        cta:    tSafe('contextEmpty.default.cta', 'Add a farm'),
      };
  }
}

export default function BackyardGuard({ children, surface = 'default' }) {
  const navigate = useNavigate();

  let profile = null;
  let profileLoading = false;
  let profileInitialized = true;
  try {
    const ctx = useProfile() || {};
    profile = ctx.profile || null;
    profileLoading = !!ctx.loading;
    profileInitialized = ctx.initialized !== false;
  } catch {
    profile = null;
    profileLoading = false;
    profileInitialized = true;
  }

  const country  = profile?.country || profile?.countryCode || null;
  const farmType = profile?.farmType || profile?.type || null;
  const profileReady = profileInitialized && !profileLoading;

  // Context-driven UI spec §1 \u2014 prefer activeContextType.
  let activeContextType = null;
  let hasFarm = false;
  try {
    const exp = useExperience();
    if (exp) {
      activeContextType = exp.activeContextType || null;
      hasFarm = !!exp.hasFarm;
    }
  } catch { /* outside hook scope */ }

  // Garden context \u2192 empty-state card. Falls back to the legacy
  // country+farmType heuristic when activeContextType is null
  // (e.g. a deep link before useExperience has resolved).
  const isGarden = (activeContextType === 'garden')
                || (activeContextType == null && profileReady
                    && shouldUseBackyardExperience(country, farmType));

  if (!profileReady) return null;

  if (isGarden) {
    // Fire a single telemetry event so the funnel still shows
    // how often the empty-state was hit. Replaces the legacy
    // `backyard_guard_redirect` event \u2014 same intent, new shape.
    try {
      trackEvent('context_empty_state_shown', {
        surface,
        activeContextType: activeContextType || 'unknown',
        country, farmType,
        hasFarm,
      });
    } catch { /* swallow */ }
    const copy = _surfaceCopy(surface);
    return (
      <main
        style={S.page}
        data-testid={`context-empty-${surface}`}
        data-context="garden"
      >
        <div style={S.card}>
          <div style={S.emoji} aria-hidden="true">{copy.emoji}</div>
          <h1 style={S.title}>{copy.title}</h1>
          <p   style={S.body}>{copy.body}</p>
          <button
            type="button"
            onClick={() => {
              try { navigate('/farm/new?intent=farm'); }
              catch { /* swallow */ }
            }}
            style={S.primaryBtn}
            data-testid={`context-empty-${surface}-add-farm`}
          >
            {copy.cta}
          </button>
          <button
            type="button"
            onClick={() => {
              try { navigate('/home'); } catch { /* swallow */ }
            }}
            style={S.ghostBtn}
            data-testid={`context-empty-${surface}-back-home`}
          >
            {tSafe('contextEmpty.backHome', 'Back to Home')}
          </button>
        </div>
      </main>
    );
  }

  return children || null;
}
