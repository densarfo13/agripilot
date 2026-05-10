/**
 * ExperienceTabs — Farms / Gardens switcher tab strip.
 *
 *   <ExperienceTabs current="farm" />                   // navigate mode
 *   <ExperienceTabs current="garden" />                 // navigate mode
 *   <ExperienceTabs current="farm" mode="switch" />     // in-place switch
 *   <ExperienceTabs current="farm" forceShow />         // single-exp shows
 *
 * Renders a two-tab pill strip at the top of the Manage Farms
 * and Manage Gardens pages so a user with BOTH a backyard garden
 * AND a farm can hop between the two surfaces in one tap.
 *
 * By default the component self-hides when the user has at most
 * one experience type. The Farm vs Garden UX spec §2 (My Grow
 * screen) wants the toggle ALWAYS visible at the top of the
 * /my-farm page so a single-experience user still sees the empty
 * counterpart slot — pass `forceShow` for that surface.
 *
 * Modes
 *   "navigate" (default) — flip activeExperience AND navigate to
 *     the matching manage surface (/farms or /manage-gardens).
 *     Used by the manage pages.
 *   "switch"             — flip activeExperience only; the parent
 *     page re-renders with the newly-active entity. Used by the
 *     My Grow detail page where we want to swap the visible
 *     active card without leaving the route.
 *
 * Props
 *   current:    'farm' | 'garden'  — which surface is being viewed
 *   mode:       'navigate' | 'switch'  (default 'navigate')
 *   forceShow:  boolean — when true, render even for single-experience
 *                         users. Default false.
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • Pure consumer of useExperience — no new state.
 *   • Never throws — all clicks try/catch wrapped.
 *   • All visible text via tSafe with English fallbacks.
 */

import { useNavigate } from 'react-router-dom';
import useExperience from '../../hooks/useExperience.js';
import { tSafe } from '../../i18n/tSafe.js';
// Final Farroway Navigation §3 — userType resolver for the
// backyard-only-shows-Gardens gate below. Top-level ESM
// import (Vite is ESM-only); pure derivation, never throws.
import { getUserType as _getUserTypeForTabs } from '../../core/userType.js';
// growMode — write the explicit toggle choice unconditionally so
// the bottom nav and page update even when the user has no
// entities of that type yet (new farmers who tap "Gardens"
// before adding a garden record).
import { writeGrowMode } from '../../lib/growMode.js';

const C = {
  panel:    '#102C47',
  border:   'rgba(255,255,255,0.10)',
  ink:      '#FFFFFF',
  inkDim:   'rgba(255,255,255,0.65)',
  green:    'rgba(200,148,77,0.18)',
  greenBd:  'rgba(200,148,77,0.40)',
  greenInk: '#86EFAC',
};

const S = {
  wrap: {
    margin: '0 1rem 0.75rem',
    display: 'flex',
    gap: 8,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    appearance: 'none',
    flex: '1 1 auto',
    background: 'transparent',
    border: 'none',
    color: C.inkDim,
    padding: '0.55rem 0.9rem',
    borderRadius: 999,
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
    fontFamily: 'inherit',
    transition: 'background 120ms ease, color 120ms ease',
  },
  tabActive: {
    background: C.green,
    border: `1px solid ${C.greenBd}`,
    color: C.greenInk,
  },
};

export default function ExperienceTabs({
  current   = 'farm',
  mode      = 'navigate',
  forceShow = false,
}) {
  const navigate = useNavigate();
  const { hasGarden, hasFarm, switchTo } = useExperience();

  // Default: single-experience users don't see the tabs at all.
  // The My Grow page passes `forceShow` so the toggle stays
  // visible even before a user has both experience types.
  if (!forceShow && (!hasGarden || !hasFarm)) return null;

  // Final Farroway Navigation §3 — backyard users see GARDENS
  // ONLY (no Farms tab). Resolved via the canonical userType
  // helper; try/catch so SSR / locked-storage edge cases
  // collapse to "show both tabs" (the conservative default —
  // never accidentally hide a tab the user might need).
  let _userType = 'farmer';
  try { _userType = _getUserTypeForTabs(); }
  catch { _userType = 'farmer'; }
  const _backyardOnly = _userType === 'backyard';

  function go(target) {
    // No-op when tapping the already-active tab.
    if (target === current) return;

    // Write the explicit mode choice FIRST, unconditionally.
    // switchTo() below only succeeds when entities of that type
    // already exist; writeGrowMode always succeeds so the nav and
    // page update even for users who have no garden/farm yet.
    try { writeGrowMode(target); } catch { /* swallow */ }

    try {
      // Flip the active experience BEFORE navigating so the
      // destination page reads the new context on first paint.
      // switchTo() is a no-op when target === current.
      switchTo(target);
    } catch { /* swallow — visual switch still works */ }
    if (mode === 'switch') {
      // In-place mode: the parent page subscribes to the
      // experience-switched event and re-renders. No navigation
      // — the user stays on the same route (e.g. /my-farm).
      return;
    }
    try {
      navigate(target === 'garden' ? '/manage-gardens' : '/farms');
    } catch { /* swallow */ }
  }

  return (
    <div
      role="tablist"
      aria-label={tSafe('experienceTabs.aria', 'Switch between farms and gardens')}
      style={S.wrap}
      data-testid="experience-tabs"
    >
      {/* Optimize Farm/Garden Mental Model §6 — leading icons:
          🌾 for farms, 🌱 for gardens. Decorative; aria-hidden so
          screen readers read the text label only. The icons act
          as the parent-vs-child visual cue (§1) — a sheaf of
          grain reads as the larger / parent entity, the seedling
          reads as the smaller / nested one. */}
      {/* Final Farroway Navigation §3 — Farms tab hidden for
          backyard users so the spec's "show gardens only"
          constraint holds. Farmer users continue to see both
          tabs as before. */}
      {!_backyardOnly ? (
        <button
          role="tab"
          type="button"
          aria-selected={current === 'farm'}
          onClick={() => go('farm')}
          style={current === 'farm' ? { ...S.tab, ...S.tabActive } : S.tab}
          data-testid="experience-tab-farms"
        >
          <span aria-hidden="true" style={{ marginRight: 6 }}>{'\uD83C\uDF3E'}</span>
          {tSafe('experienceTabs.farms', 'Farms')}
        </button>
      ) : null}
      <button
        role="tab"
        type="button"
        aria-selected={current === 'garden'}
        onClick={() => go('garden')}
        style={current === 'garden' ? { ...S.tab, ...S.tabActive } : S.tab}
        data-testid="experience-tab-gardens"
      >
        <span aria-hidden="true" style={{ marginRight: 6 }}>{'\uD83C\uDF31'}</span>
        {tSafe('experienceTabs.gardens', 'Gardens')}
      </button>
    </div>
  );
}
