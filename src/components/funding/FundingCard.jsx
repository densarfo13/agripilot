/**
 * FundingCard — single program card for the Funding Hub.
 *
 * Trust + compliance (per spec §11)
 * ─────────────────────────────────
 *   • Disclaimer text always visible at the card foot.
 *   • External link opens in a new tab + carries `noopener`.
 *   • Tap fires the `funding_external_link` analytics event so
 *     the admin tile can surface "most viewed programs".
 *
 * Visible text
 * ────────────
 * Card data (title / description / etc.) comes from the static
 * catalog in plain English — programs are real third-party
 * names. The labels around them ("Best for", "Why it fits",
 * "Next step") are localized via tStrict so non-English UIs
 * still feel native.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';
import { FARM_TYPE_LABELS } from '../../config/fundingConfig.js';
import { isFeatureEnabled } from '../../config/features.js';
import ApplicationPreviewModal from './ApplicationPreviewModal.jsx';
import MatchChips from './MatchChips.jsx';
import CardFooterBadges from './CardFooterBadges.jsx';

// Belt-and-braces: strip a trailing "(SAMPLE)" / "(sample)" suffix
// from any catalog title at render. The static catalog already had
// the suffix removed (sampleOpportunities.js), but this guard keeps
// any future catalog drift invisible to the user — the SAMPLE badge
// is rendered separately by surfaces that read `card.sample`.
const _SAMPLE_SUFFIX_RE = /\s*\(sample\)\s*$/i;
function _cleanTitle(t) {
  if (!t || typeof t !== 'string') return t || '';
  return t.replace(_SAMPLE_SUFFIX_RE, '').trim();
}

const STYLES = {
  card: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 180,
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title:  { margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.3 },
  pill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.18)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.45)',
    whiteSpace: 'nowrap',
  },
  description: { margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)' },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  metaLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
  },
  metaValue: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 },
  bestFor: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  bestForChip: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  cta: {
    display: 'inline-block',
    marginTop: 'auto',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#22C55E',
    color: '#0B1D34',
    fontWeight: 700,
    fontSize: 14,
    textDecoration: 'none',
    textAlign: 'center',
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.4,
  },
};

const PILL_TONE = {
  government:  { bg: 'rgba(14,165,233,0.18)',  fg: '#7DD3FC', bd: 'rgba(14,165,233,0.45)' },
  ngo:         { bg: 'rgba(168,85,247,0.20)',  fg: '#D8B4FE', bd: 'rgba(168,85,247,0.45)' },
  cooperative: { bg: 'rgba(34,197,94,0.18)',   fg: '#86EFAC', bd: 'rgba(34,197,94,0.45)' },
  training:    { bg: 'rgba(245,158,11,0.18)',  fg: '#FDE68A', bd: 'rgba(245,158,11,0.45)' },
  partnership: { bg: 'rgba(239,68,68,0.18)',   fg: '#FCA5A5', bd: 'rgba(239,68,68,0.45)' },
  community:   { bg: 'rgba(34,197,94,0.18)',   fg: '#86EFAC', bd: 'rgba(34,197,94,0.45)' },
};

export default function FundingCard({ card, context = {} }) {
  // Subscribe to language change so localized labels refresh.
  useTranslation();
  const guidedOn = isFeatureEnabled('guidedFundingApplication');
  const screenV2On = isFeatureEnabled('fundingScreenV2');
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!card || !card.id) return null;
  const cleanTitle = _cleanTitle(card.title);
  // Match-chip / footer surfaces need a profile snapshot. The
  // existing context API already carries country/userRole; we
  // accept a `profile` field for richer data and fall back to
  // synthesising a minimal profile from the context bag so the
  // chips still resolve gracefully on legacy callers.
  const profileSnapshot = (context && (context.profile || context.farm)) || {
    country:    context && context.country    ? context.country    : '',
    region:     context && context.region     ? context.region     : '',
    crop:       context && context.crop       ? context.crop       : '',
    plantId:    context && context.plantId    ? context.plantId    : '',
    farmType:   context && context.farmType   ? context.farmType   : '',
    experience: context && context.experience ? context.experience : '',
  };

  const tone = PILL_TONE[card.category] || PILL_TONE.partnership;
  const pillStyle = {
    ...STYLES.pill,
    background: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.bd}`,
  };

  const handleClick = (e) => {
    try {
      trackFundingEvent('funding_card_clicked', {
        cardId:   card.id,
        category: card.category,
        country:  context.country || null,
        userRole: context.userRole || null,
      });
      // Spec event name + the older alias so existing analytics
      // consumers keep working through the migration.
      trackFundingEvent('external_funding_link_clicked', {
        cardId:   card.id,
        url:      card.externalUrl,
      });
      trackFundingEvent('funding_external_link', {
        cardId:   card.id,
        url:      card.externalUrl,
      });
    } catch { /* never propagate */ }
    // Don't preventDefault — let the anchor open the new tab.
    if (card?.id === 'global-farroway-pilot') {
      try { trackFundingEvent('funding_pilot_inquiry', { source: 'card', country: context.country }); }
      catch { /* ignore */ }
    }
    // suppress lint: e is intentionally unused beyond passthrough
    void e;
  };

  return (
    <article style={STYLES.card} data-funding-id={card.id} data-category={card.category}>
      <div style={STYLES.header}>
        <h4 style={STYLES.title}>{cleanTitle}</h4>
        <span style={pillStyle} aria-hidden="true">
          {tStrict(`funding.category.${card.category}`, card.category)}
        </span>
      </div>

      <p style={STYLES.description}>{card.description}</p>

      {/* Inline "Why this fits you" chip group — flag-gated so
          existing surfaces stay visually identical when off. */}
      {screenV2On ? (
        <MatchChips card={card} profile={profileSnapshot} />
      ) : null}

      {/* Match reason — surfaced by the smart engine when present.
          Conservative copy ("may be useful", never "you qualify"). */}
      {card.matchReason ? (
        <div style={STYLES.metaRow}>
          <span style={STYLES.metaLabel}>{tStrict('funding.card.matchReason', 'Why we suggested this')}</span>
          <span style={STYLES.metaValue}>{card.matchReason}</span>
        </div>
      ) : null}

      <div style={STYLES.metaRow}>
        <span style={STYLES.metaLabel}>{tStrict('funding.card.bestFor', 'Best for')}</span>
        <div style={STYLES.bestFor}>
          {(card.bestFor || []).map((b) => {
            // bestFor carries farm-type slugs (small_farm, backyard…).
            // Render via the label map + a strict-translator key so
            // non-English UIs get localized chips.
            const fallback = FARM_TYPE_LABELS[b] || b;
            const label = tStrict(`funding.bestFor.${b}`, fallback);
            return <span key={b} style={STYLES.bestForChip}>{label}</span>;
          })}
        </div>
      </div>

      <div style={STYLES.metaRow}>
        <span style={STYLES.metaLabel}>{tStrict('funding.card.whyItFits', 'Why it fits')}</span>
        <span style={STYLES.metaValue}>{card.eligibilityHint}</span>
      </div>

      <div style={STYLES.metaRow}>
        <span style={STYLES.metaLabel}>{tStrict('funding.card.nextStep', 'Next step')}</span>
        <span style={STYLES.metaValue}>{card.nextStep}</span>
      </div>

      {/* Footer badges — flag-gated. Self-suppress per-badge when
          the corresponding card field is missing, and the row
          itself returns null when all three are absent. */}
      {screenV2On ? (
        <CardFooterBadges
          timeToComplete={card.timeToComplete}
          difficulty={card.difficulty}
          successCount={card.successCount}
        />
      ) : null}

      {guidedOn ? (
        <button
          type="button"
          onClick={() => {
            try {
              trackFundingEvent('funding_view', {
                cardId:   card.id,
                category: card.category,
                country:  context.country  || null,
                userRole: context.userRole || null,
                source:   'card_cta',
              });
            } catch { /* swallow */ }
            setPreviewOpen(true);
          }}
          style={{ ...STYLES.cta, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
          data-testid={`funding-cta-${card.id}`}
        >
          {tStrict('funding.card.startApplication', 'Start Application')}
        </button>
      ) : (
        <a
          href={card.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          style={STYLES.cta}
          data-testid={`funding-cta-${card.id}`}
        >
          {tStrict('funding.card.exploreOption', 'Explore this option')}
        </a>
      )}

      <p style={STYLES.disclaimer}>
        {tStrict(
          'funding.card.disclaimer',
          'Farroway does not guarantee funding. Always verify requirements with the official program.'
        )}
      </p>

      {guidedOn ? (
        <ApplicationPreviewModal
          open={previewOpen}
          card={card}
          profile={context.profile || context}
          context={context}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </article>
  );
}
