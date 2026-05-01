/**
 * ExperienceSwitcher — small chip in the protected-layout header
 * that lets a user with both a garden AND a farm flip between
 * them. Self-suppresses when the user only has one experience
 * (or none) so the header stays clean for the 99% case.
 *
 *   <ExperienceSwitcher />
 *
 * Behaviour
 *   * Reads `useExperience()`. Renders nothing when `hasBoth`
 *     is false.
 *   * Two pill buttons: "Garden" + "Farm". The active one is
 *     visually highlighted; tapping the inactive one calls
 *     `switchTo(target)` which fires
 *     `farroway:experience_switched`.
 *   * Fires `experience_switch_tap` analytics with the
 *     direction so the launch dashboard can measure context-
 *     switch frequency.
 *
 * Strict-rule audit
 *   * Inline styles only.
 *   * All visible text via tStrict.
 *   * Never throws — store + analytics calls are guarded.
 *   * No router import — switching does not navigate; the
 *     `farroway:experience_switched` event lets nav / home
 *     re-render in place.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useExperience from '../../hooks/useExperience.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 2,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 999,
  },
  pill: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    borderRadius: 999,
    minHeight: 24,
    textTransform: 'uppercase',
  },
  pillActive: {
    background: 'rgba(34,197,94,0.18)',
    color: '#86EFAC',
  },
};

export default function ExperienceSwitcher() {
  // Subscribe to language flips so the labels refresh.
  useTranslation();
  const {
    experience, hasBoth, switchTo, EXPERIENCE,
  } = useExperience();

  if (!hasBoth) return null;

  const isGarden = experience === EXPERIENCE.GARDEN;
  const isFarm   = experience === EXPERIENCE.FARM;

  function handleSwitch(target) {
    if (experience === target) return;
    try { trackEvent('experience_switch_tap', { from: experience, to: target }); }
    catch { /* swallow */ }
    try { switchTo(target); }
    catch { /* swallow */ }
  }

  return (
    <div
      style={S.wrap}
      role="group"
      aria-label="Switch between garden and farm"
      data-testid="experience-switcher"
    >
      <button
        type="button"
        onClick={() => handleSwitch(EXPERIENCE.GARDEN)}
        style={isGarden ? { ...S.pill, ...S.pillActive } : S.pill}
        aria-pressed={isGarden}
        data-testid="experience-switch-garden"
      >
        {tStrict('experience.garden', 'Garden')}
      </button>
      <button
        type="button"
        onClick={() => handleSwitch(EXPERIENCE.FARM)}
        style={isFarm ? { ...S.pill, ...S.pillActive } : S.pill}
        aria-pressed={isFarm}
        data-testid="experience-switch-farm"
      >
        {tStrict('experience.farm', 'Farm')}
      </button>
    </div>
  );
}
