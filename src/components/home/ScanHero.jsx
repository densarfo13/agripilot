/**
 * ScanHero — large above-the-fold "Scan your plant" CTA on Home
 * (retention spec §1). Anchors the daily habit loop:
 *   Scan → Result → Action → Task → Streak → Reminder → Repeat.
 *
 *   <ScanHero />
 *
 * Behaviour
 *   * Always visible above the fold on the home tab.
 *   * Tap → navigate to /scan (canonical scan route).
 *   * Wording adapts via active experience: "plant" for garden,
 *     "crop" for farm — uses the existing getExperienceLabels
 *     helper so the copy stays consistent with the rest of the
 *     app.
 *   * Fires `scan_hero_tap` analytics so we can measure how
 *     often the hero converts vs the bottom-nav scan tab.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — store + analytics calls are guarded.
 *   * Self-suppresses inside a no-active-experience state so
 *     the ExperienceManageCard above it owns the empty CTA.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useExperience from '../../hooks/useExperience.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const C = {
  bg:        'rgba(34,197,94,0.10)',
  border:    'rgba(34,197,94,0.32)',
  green:     '#22C55E',
  greenDark: '#062714',
  ink:       '#EAF2FF',
  inkSoft:   'rgba(255,255,255,0.7)',
};

const S = {
  card: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: '20px 18px',
    margin: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 10,
    color: C.ink,
  },
  icon:     { fontSize: 40, lineHeight: 1 },
  title:    { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 14, color: C.inkSoft, lineHeight: 1.5, maxWidth: 360 },
  cta: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: C.green,
    color: C.greenDark,
    border: 'none',
    padding: '14px 24px',
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 800,
    minHeight: 48,
    minWidth: 180,
    boxShadow: '0 6px 22px rgba(34,197,94,0.30)',
    marginTop: 4,
  },
};

export default function ScanHero() {
  useTranslation();
  const navigate = useNavigate();

  let activeExperience = null;
  try {
    const xp = useExperience();
    activeExperience = xp && xp.experience;
  } catch { activeExperience = null; }

  // No active experience yet — let the ExperienceManageCard
  // (the "Start your first garden or farm" empty state) handle
  // the empty-state CTA so we don't double up.
  if (!activeExperience) return null;

  const isGarden = activeExperience === 'garden'
                || activeExperience === 'backyard';

  const titleKey = isGarden ? 'scan.hero.title.garden' : 'scan.hero.title.farm';
  const titleFallback = isGarden
    ? '\uD83D\uDCF7 Scan your plant'
    : '\uD83D\uDCF7 Scan your crop';

  const subtitleKey = isGarden
    ? 'scan.hero.subtitle.garden'
    : 'scan.hero.subtitle.farm';
  const subtitleFallback = isGarden
    ? 'Not sure what\u2019s happening? Take a photo.'
    : 'Spot something off in the field? Take a photo.';

  function handleTap() {
    try {
      trackEvent('scan_hero_tap', {
        experience: isGarden ? 'garden' : 'farm',
      });
    } catch { /* swallow */ }
    // Premium Home spec \u00a712 \u2014 spec-named scan_cta_clicked event
    // fired alongside the legacy scan_hero_tap so the new home
    // dashboard reads the canonical name without us breaking
    // the existing scan funnel.
    try {
      trackEvent('scan_cta_clicked', {
        experience: isGarden ? 'garden' : 'farm',
        source:     'home-hero',
      });
    } catch { /* swallow \u2014 analytics must not crash */ }
    try { navigate('/scan'); }
    catch { /* swallow */ }
  }

  return (
    <section
      style={S.card}
      data-testid="scan-hero"
      data-experience={isGarden ? 'garden' : 'farm'}
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
      <h2 style={S.title}>{tStrict(titleKey, titleFallback)}</h2>
      <p style={S.subtitle}>{tStrict(subtitleKey, subtitleFallback)}</p>
      <button
        type="button"
        onClick={handleTap}
        style={S.cta}
        data-testid="scan-hero-cta"
      >
        {tStrict('scan.hero.cta', 'Take Photo')}
      </button>
    </section>
  );
}
