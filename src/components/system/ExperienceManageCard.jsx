/**
 * ExperienceManageCard — Home-surface card that surfaces the
 * "Add Garden" / "Add Farm" / "Start your first" affordances
 * the ExperienceSwitcher header chip can't fit.
 *
 *   <ExperienceManageCard />
 *
 * Variants
 *   * `hasBoth`        — null (the header chip already shows the
 *                        segmented switch; nothing to render here)
 *   * `hasGarden only` — pill row: 🌱 My Garden  +Add Farm
 *   * `hasFarm only`   — pill row: 🚜 My Farm    +Add Garden
 *   * neither          — empty-state card with two big buttons
 *
 * Routes
 *   Add Garden → `/onboarding/backyard` (existing 6-step flow)
 *   Add Farm   → `/farm/new`            (existing AdaptiveFarmSetup)
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Renders null in the hasBoth case so the header chip stays
 *     the canonical switch surface.
 *   * Never throws — store + analytics calls are guarded.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useExperience from '../../hooks/useExperience.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  green: '#22C55E',
  greenSoft: 'rgba(34,197,94,0.18)',
  greenBorder: 'rgba(34,197,94,0.32)',
  ink: '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border: 'rgba(255,255,255,0.10)',
};

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '16px',
    margin: '12px 0',
    color: C.ink,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  activeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: C.greenSoft,
    border: `1px solid ${C.greenBorder}`,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    color: C.green,
  },
  addBtn: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    color: C.ink,
    border: `1px dashed ${C.border}`,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
  },

  // Empty-state variant
  emptyTitle: { margin: 0, fontSize: 16, fontWeight: 800 },
  emptyCopy:  { margin: '6px 0 14px', color: C.inkSoft, fontSize: 13, lineHeight: 1.5 },
  btnRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primary: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: C.green,
    color: '#062714',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    minHeight: 44,
  },
  secondary: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    color: C.ink,
    border: `1px solid ${C.border}`,
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    minHeight: 44,
  },
};

export default function ExperienceManageCard({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const { hasGarden, hasFarm, hasBoth } = useExperience();

  // hasBoth → header chip is the canonical surface; nothing to show here.
  if (hasBoth) return null;

  function goAddGarden() {
    try { trackEvent('experience_add_garden_tap', { from: hasFarm ? 'farm' : 'none' }); }
    catch { /* swallow */ }
    try { navigate('/onboarding/backyard'); }
    catch { /* swallow */ }
  }

  function goAddFarm() {
    try { trackEvent('experience_add_farm_tap', { from: hasGarden ? 'garden' : 'none' }); }
    catch { /* swallow */ }
    try { navigate('/farm/new'); }
    catch { /* swallow */ }
  }

  // Empty state — neither garden nor farm.
  if (!hasGarden && !hasFarm) {
    return (
      <section
        style={{ ...S.card, ...(style || null) }}
        data-testid="experience-empty-card"
      >
        <h3 style={S.emptyTitle}>
          {tStrict('experience.empty.title',
            'Start your first garden or farm')}
        </h3>
        <p style={S.emptyCopy}>
          {tStrict('experience.empty.copy',
            'Pick the path that fits today. You can always add the other later.')}
        </p>
        <div style={S.btnRow}>
          <button
            type="button"
            onClick={goAddGarden}
            style={S.primary}
            data-testid="experience-setup-garden"
          >
            {tStrict('experience.cta.setupGarden', 'Set up garden')}
          </button>
          <button
            type="button"
            onClick={goAddFarm}
            style={S.secondary}
            data-testid="experience-setup-farm"
          >
            {tStrict('experience.cta.addFarm', 'Add farm')}
          </button>
        </div>
      </section>
    );
  }

  // Single-experience state: show the active one + an Add CTA
  // for the missing one.
  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="experience-single-card"
    >
      <div style={S.row}>
        {hasGarden && (
          <span style={S.activeChip} data-testid="experience-active-garden">
            <span aria-hidden="true">{'\uD83C\uDF31'}</span>
            <span>{tStrict('experience.myGarden', 'My Garden')}</span>
          </span>
        )}
        {hasFarm && (
          <span style={S.activeChip} data-testid="experience-active-farm">
            <span aria-hidden="true">{'\uD83D\uDE9C'}</span>
            <span>{tStrict('experience.myFarm', 'My Farm')}</span>
          </span>
        )}
        {!hasFarm && (
          <button
            type="button"
            onClick={goAddFarm}
            style={S.addBtn}
            data-testid="experience-add-farm"
          >
            {tStrict('experience.cta.addFarmShort', '+ Add Farm')}
          </button>
        )}
        {!hasGarden && (
          <button
            type="button"
            onClick={goAddGarden}
            style={S.addBtn}
            data-testid="experience-add-garden"
          >
            {tStrict('experience.cta.addGardenShort', '+ Add Garden')}
          </button>
        )}
      </div>
    </section>
  );
}
