/**
 * ExperienceTabs — Farms / Gardens switcher tab strip.
 *
 *   <ExperienceTabs current="farm" />
 *   <ExperienceTabs current="garden" />
 *
 * Renders a two-tab pill strip at the top of the Manage Farms
 * and Manage Gardens pages so a user with BOTH a backyard garden
 * AND a farm can hop between the two surfaces in one tap. Self-
 * hides when the user has at most one experience type — single-
 * experience users don't need a switcher.
 *
 * Garden-visibility spec §5 — Manage screens must show the
 * switcher whenever both experience types exist. The tab strip
 * also flips `activeExperience` via switchTo() so the rest of
 * the app (Home plan, daily-plan engine, scan flow) re-derives
 * its context off the chosen surface.
 *
 * Props
 *   current: 'farm' | 'garden'  — which surface is being viewed
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • Pure consumer of useExperience — no new state.
 *   • Never throws — all clicks try/catch wrapped.
 *   • Self-hides when only one experience type exists.
 *   • All visible text via tSafe with English fallbacks.
 */

import { useNavigate } from 'react-router-dom';
import useExperience from '../../hooks/useExperience.js';
import { tSafe } from '../../i18n/tSafe.js';

const C = {
  panel:    '#102C47',
  border:   'rgba(255,255,255,0.10)',
  ink:      '#FFFFFF',
  inkDim:   'rgba(255,255,255,0.65)',
  green:    'rgba(34,197,94,0.18)',
  greenBd:  'rgba(34,197,94,0.40)',
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

export default function ExperienceTabs({ current = 'farm' }) {
  const navigate = useNavigate();
  const { hasGarden, hasFarm, switchTo } = useExperience();

  // Spec rule — single-experience users don't see the tabs at
  // all. The tabs only earn their slot when both kinds exist.
  if (!hasGarden || !hasFarm) return null;

  function go(target) {
    try {
      // Flip the active experience BEFORE navigating so the
      // destination page reads the new context on first paint.
      // switchTo() is a no-op when target === current.
      switchTo(target);
    } catch { /* swallow — visual switch still works */ }
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
      <button
        role="tab"
        type="button"
        aria-selected={current === 'farm'}
        onClick={() => go('farm')}
        style={current === 'farm' ? { ...S.tab, ...S.tabActive } : S.tab}
        data-testid="experience-tab-farms"
      >
        {tSafe('experienceTabs.farms', 'Farms')}
      </button>
      <button
        role="tab"
        type="button"
        aria-selected={current === 'garden'}
        onClick={() => go('garden')}
        style={current === 'garden' ? { ...S.tab, ...S.tabActive } : S.tab}
        data-testid="experience-tab-gardens"
      >
        {tSafe('experienceTabs.gardens', 'Gardens')}
      </button>
    </div>
  );
}
