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

import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';
import {
  bookmarkOpportunity,
  unbookmarkOpportunity,
  isBookmarked,
} from '../../funding/fundingBookmarks.js';
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

// Soft Ochre system (May 2026 Funding refinement) — white-on-beige
// surface, ochre primary CTA, growth-green for category accent
// only. Single source of warm shadows + tap feedback consistent
// with the rest of the premium-page family.
const STYLES = {
  card: {
    border: '1px solid rgba(31,41,51,0.08)',
    background: '#FFF9F0',
    borderRadius: 18,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 180,
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 18px 32px -16px rgba(80,60,30,0.22)',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  title:  { margin: 0, fontSize: 17, fontWeight: 800, color: '#1F2933', lineHeight: 1.3, letterSpacing: '-0.005em' },
  pill: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(94,142,94,0.14)',
    color: '#3F6A3F',
    border: '1px solid rgba(94,142,94,0.36)',
    whiteSpace: 'nowrap',
  },
  description: { margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#1F2933' },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  metaLabel: {
    fontSize: 10,
    color: '#98A2B3',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
  },
  metaValue: { fontSize: 13.5, color: '#1F2933', lineHeight: 1.45, fontWeight: 500 },
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
    background: '#F2E3C3',
    color: '#7A5A28',
    border: '1px solid rgba(212,163,95,0.42)',
    fontWeight: 600,
  },
  // Soft Ochre primary CTA — replaces the legacy neon-green button.
  cta: {
    display: 'inline-block',
    marginTop: 'auto',
    padding: '12px 18px',
    borderRadius: 999,
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 14,
    textDecoration: 'none',
    textAlign: 'center',
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: '#98A2B3',
    lineHeight: 1.4,
  },
  saveBtn: {
    background: 'transparent',
    border: '1px solid rgba(31,41,51,0.16)',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    width: '100%',
    transition: 'border-color 0.15s, color 0.15s',
  },
};

// Soft Ochre system — pill tones tuned for legibility on the
// new white-on-beige card surface. Growth-green stays reserved
// for health-related categories (community / cooperative);
// everything else lives on the warm earth palette so the card
// reads as one calm visual family.
const PILL_TONE = {
  government:  { bg: 'rgba(36,49,58,0.10)',     fg: '#24313A', bd: 'rgba(36,49,58,0.28)' },
  ngo:         { bg: 'rgba(191,169,138,0.20)',  fg: '#5A4C32', bd: 'rgba(191,169,138,0.50)' },
  cooperative: { bg: 'rgba(94,142,94,0.14)',    fg: '#3F6A3F', bd: 'rgba(94,142,94,0.36)' },
  training:    { bg: 'rgba(212,163,95,0.16)',   fg: '#7A5A28', bd: 'rgba(212,163,95,0.42)' },
  partnership: { bg: 'rgba(224,162,56,0.16)',   fg: '#8A5C12', bd: 'rgba(224,162,56,0.40)' },
  community:   { bg: 'rgba(94,142,94,0.14)',    fg: '#3F6A3F', bd: 'rgba(94,142,94,0.36)' },
};

export default function FundingCard({ card, context = {} }) {
  // Subscribe to language change so localized labels refresh.
  useTranslation();
  const guidedOn = isFeatureEnabled('guidedFundingApplication');
  const screenV2On = isFeatureEnabled('fundingScreenV2');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Phase 7C: save/bookmark state. Hooks must be called before the
  // early return — pass '' when card.id is absent so isBookmarked
  // no-ops; the card will be discarded by the early return anyway.
  const cardId = card && card.id ? String(card.id) : '';
  const [saved, setSaved] = useState(() => {
    try { return isBookmarked(cardId); } catch { return false; }
  });
  // Sync badge when the bookmark store emits a change (e.g. the
  // user saved/unsaved from another card in the same list).
  useEffect(() => {
    if (!cardId) return undefined;
    const onChanged = () => {
      try { setSaved(isBookmarked(cardId)); } catch { /* swallow */ }
    };
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('farroway:funding_bookmarks_changed', onChanged);
    return () => window.removeEventListener('farroway:funding_bookmarks_changed', onChanged);
  }, [cardId]);

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

      {/* Match reason — refinement spec §6: replace "WHY WE
          SUGGESTED THIS" / "WHY THIS FITS YOU" verbose label
          with the calmer "Recommended because" framing. Single
          short reason from the smart engine; conservative copy
          ("may be useful", never "you qualify"). */}
      {card.matchReason ? (
        <div style={STYLES.metaRow}>
          <span style={STYLES.metaLabel}>{tStrict('funding.card.recommendedBecause', 'Recommended because')}</span>
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

      {/* Refinement spec §6 — replace "WHY IT FITS" with the
          softer "Supports" framing so the card reads as a
          summary, not a justification. */}
      {card.eligibilityHint ? (
        <div style={STYLES.metaRow}>
          <span style={STYLES.metaLabel}>{tStrict('funding.card.supports', 'Supports')}</span>
          <span style={STYLES.metaValue}>{card.eligibilityHint}</span>
        </div>
      ) : null}

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

      {/* Phase 7C: save for later — advisory, never blocks main CTA. */}
      <button
        type="button"
        onClick={() => {
          try {
            if (saved) {
              unbookmarkOpportunity(card.id);
              setSaved(false);
            } else {
              bookmarkOpportunity(card);
              setSaved(true);
              try {
                trackFundingEvent('funding_saved', {
                  cardId:   card.id,
                  category: card.category,
                  country:  context.country || null,
                });
              } catch { /* swallow */ }
            }
          } catch { /* never propagate */ }
        }}
        style={{
          ...STYLES.saveBtn,
          // Soft Ochre: saved = ochre accent on warm soft fill;
          // unsaved = muted ink on transparent.
          color: saved ? '#7A5A28' : '#667085',
          borderColor: saved ? 'rgba(212,163,95,0.45)' : 'rgba(31,41,51,0.16)',
          background: saved ? 'rgba(212,163,95,0.10)' : 'transparent',
        }}
        data-testid={`funding-save-${card.id}`}
        aria-label={saved
          ? tStrict('funding.card.savedAriaLabel', 'Remove from saved')
          : tStrict('funding.card.saveAriaLabel', 'Save for later')}
      >
        {saved
          ? tStrict('funding.card.saved', '✓ Saved')
          : tStrict('funding.card.save', 'Save for later')}
      </button>

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
