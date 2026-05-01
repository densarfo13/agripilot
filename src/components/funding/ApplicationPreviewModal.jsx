/**
 * ApplicationPreviewModal — guided application preview surface.
 *
 * Spec coverage (Funding upgrade)
 *   §1 modal:               title + description + why-it-fits +
 *                            time-to-complete + difficulty + 3 steps
 *   §1 buttons:              Continue Application / Get help applying / Remind me later
 *   §2 readiness score:      "You are N% ready" + sub-60 nudge
 *   §3 quick apply kit:      crop / location / farm type
 *   §6 urgency message:      "Apply early to increase chances"
 *   §7 trust badges:         Verified / No fee / Trusted
 *   §8 tracking events:      funding_view, funding_apply_click,
 *                            funding_help_click, funding_save
 *
 * Open / close
 *   Caller controls visibility via `open` + `onClose`. The modal
 *   is dismissible via:
 *     • Escape key
 *     • backdrop click
 *     • the explicit close (×) button
 *     • any of the three primary CTAs
 *
 * "Get help applying" hand-off
 *   Dispatches a `farroway:open_pilot_help` window event with a
 *   prefill payload. The existing `OrganizationPilotCTA` listens
 *   for it (see edits in that file) and opens itself with the
 *   prefilled fields. This keeps coupling loose — the modal does
 *   not need to mount the whole pilot form inline, and the help
 *   form does not need a prop to be controllable.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict (no English bleed).
 *   • Inline styles only.
 *   • Reads no fresh storage; everything comes via `card`,
 *     `profile`, and the readiness scorer (a pure function).
 *   • Never throws — analytics + storage writes are try/catch
 *     wrapped at every boundary.
 *   • Listed in jsx-only navigation flow: never replaces an
 *     existing navigation route.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';
import { calculateApplicationReadiness } from '../../funding/applicationReadiness.js';
import { bookmarkOpportunity } from '../../funding/fundingBookmarks.js';
import ReadinessBadge from './ReadinessBadge.jsx';
import QuickApplyKit  from './QuickApplyKit.jsx';
import TrustBadges    from './TrustBadges.jsx';
import OrganizationPilotCTA from './OrganizationPilotCTA.jsx';

export const PILOT_HELP_OPEN_EVENT = 'farroway:open_pilot_help';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 0,
  },
  modal: {
    background: '#0F1B2D',
    color: '#fff',
    width: '100%',
    maxWidth: 560,
    maxHeight: '92vh',
    overflowY: 'auto',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
    padding: '20px 18px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxSizing: 'border-box',
  },
  closeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
    margin: 0,
  },
  closeBtn: {
    appearance: 'none',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    width: 32,
    height: 32,
    borderRadius: '50%',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  description: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  sectionBody: {
    fontSize: 14,
    color: '#EAF2FF',
    lineHeight: 1.5,
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  metaCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  steps: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    fontSize: 14,
    color: '#EAF2FF',
  },
  stepBadge: {
    flex: '0 0 auto',
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#22C55E',
    color: '#0B1D34',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
  },
  urgency: {
    margin: 0,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    color: '#FDE68A',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.35)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  ctaCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '14px 18px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    appearance: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tertiary: {
    appearance: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.14)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const STEP_KEYS = [
  { key: 'funding.modal.step.fillForm', fallback: 'Fill the form'    },
  { key: 'funding.modal.step.submit',   fallback: 'Submit'            },
  { key: 'funding.modal.step.review',   fallback: 'Wait for review'   },
];

function _fmtDifficulty(diff) {
  const v = String(diff || '').toLowerCase();
  if (v === 'easy')   return { key: 'funding.modal.difficulty.easy',   fallback: 'Easy' };
  if (v === 'medium') return { key: 'funding.modal.difficulty.medium', fallback: 'Medium' };
  if (v === 'hard')   return { key: 'funding.modal.difficulty.hard',   fallback: 'Hard' };
  return { key: 'funding.modal.difficulty.easy', fallback: 'Easy' };
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object}  props.card     funding catalog entry
 * @param {object}  [props.profile] active farm + user profile snapshot
 * @param {object}  [props.context] passed to analytics (country, userRole)
 * @param {() => void} props.onClose
 * @param {(card) => void} [props.onContinue]   defaults to opening externalUrl
 * @param {(payload) => void} [props.onRequestHelp]  defaults to dispatching the
 *                                                   pilot-help window event
 */
export default function ApplicationPreviewModal({
  open,
  card,
  profile = {},
  context = {},
  onClose,
  onContinue,
  onRequestHelp,
}) {
  useTranslation();
  const closeRef = useRef(null);

  // Body scroll lock + Esc dismiss + emit funding_view event once
  // per modal mount.
  useEffect(() => {
    if (!open) return undefined;

    try {
      trackFundingEvent('funding_view', {
        cardId:   card?.id || null,
        category: card?.category || null,
        country:  context.country  || null,
        userRole: context.userRole || null,
      });
    } catch { /* swallow */ }

    let prevOverflow = '';
    try {
      if (typeof document !== 'undefined') {
        prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
    } catch { /* swallow */ }

    const onKey = (e) => {
      if (e && e.key === 'Escape') {
        try { onClose && onClose(); } catch { /* swallow */ }
      }
    };
    try { window.addEventListener('keydown', onKey); }
    catch { /* swallow */ }

    // Focus the close button so SR users can dismiss + tabbing
    // starts inside the modal.
    try { closeRef.current && closeRef.current.focus(); }
    catch { /* swallow */ }

    return () => {
      try { window.removeEventListener('keydown', onKey); } catch { /* swallow */ }
      try {
        if (typeof document !== 'undefined') {
          document.body.style.overflow = prevOverflow || '';
        }
      } catch { /* swallow */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);

  const readiness = useMemo(
    () => calculateApplicationReadiness({ card: card || {}, profile }),
    [card, profile],
  );

  const difficulty = useMemo(
    () => _fmtDifficulty(card?.difficulty),
    [card?.difficulty],
  );

  const timeToComplete = useMemo(() => {
    const v = card?.timeToComplete;
    if (v && String(v).trim()) return String(v);
    return tStrict('funding.modal.timeDefault', '~10 minutes');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.timeToComplete]);

  const whyItFits = useMemo(() => {
    if (card?.matchReason)     return card.matchReason;
    if (card?.eligibilityHint) return card.eligibilityHint;
    return tStrict(
      'funding.modal.whyDefault',
      'Programs in this category often suit farmers like you.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.matchReason, card?.eligibilityHint]);

  const handleContinue = useCallback(() => {
    if (!card) return;
    try {
      trackFundingEvent('funding_apply_click', {
        cardId:   card.id || null,
        category: card.category || null,
        readinessScore: readiness.score,
        country:  context.country  || null,
        userRole: context.userRole || null,
      });
    } catch { /* swallow */ }

    if (typeof onContinue === 'function') {
      try { onContinue(card); } catch { /* swallow */ }
    } else if (card.externalUrl && typeof window !== 'undefined' && typeof window.open === 'function') {
      try { window.open(card.externalUrl, '_blank', 'noopener,noreferrer'); }
      catch { /* swallow */ }
    }
    try { onClose && onClose(); } catch { /* swallow */ }
  }, [card, readiness.score, context, onContinue, onClose]);

  const handleHelp = useCallback(() => {
    const prefill = {
      country: profile?.country || context.country || '',
      // Pre-name from farm name when present so NGO leads carry
      // some context even on a quick "help me" tap.
      organizationName: profile?.farmName || '',
      goal: card?.title
        ? tStrict('funding.modal.help.goalPrefix', 'Need help applying to: ') + card.title
        : '',
      message: '',
    };
    try {
      trackFundingEvent('funding_help_click', {
        cardId:   card?.id || null,
        category: card?.category || null,
        country:  prefill.country || null,
      });
    } catch { /* swallow */ }

    if (typeof onRequestHelp === 'function') {
      try { onRequestHelp({ card, prefill }); } catch { /* swallow */ }
    } else {
      // Loose-coupling hand-off — OrganizationPilotCTA listens.
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent(PILOT_HELP_OPEN_EVENT, { detail: prefill }));
        }
      } catch { /* swallow */ }
    }
    try { onClose && onClose(); } catch { /* swallow */ }
  }, [card, profile, context, onRequestHelp, onClose]);

  const handleSave = useCallback(() => {
    if (!card) return;
    try { bookmarkOpportunity(card); } catch { /* swallow */ }
    try {
      trackFundingEvent('funding_save', {
        cardId:   card.id || null,
        category: card.category || null,
        country:  context.country  || null,
        userRole: context.userRole || null,
      });
    } catch { /* swallow */ }
    try { onClose && onClose(); } catch { /* swallow */ }
  }, [card, context, onClose]);

  if (!open || !card) return null;

  return (
    <div
      style={S.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          try { onClose && onClose(); } catch { /* swallow */ }
        }
      }}
      data-testid="funding-application-modal"
    >
      <div
        style={S.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="funding-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.closeRow}>
          <p style={S.eyebrow}>
            {tStrict('funding.modal.eyebrow', 'Application preview')}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={tStrict('common.close', 'Close')}
            data-testid="funding-modal-close"
          >
            {'\u2715'}
          </button>
        </div>

        <h2 id="funding-modal-title" style={S.title}>{card.title}</h2>

        {card.description ? (
          <p style={S.description}>{card.description}</p>
        ) : null}

        <ReadinessBadge score={readiness.score} />

        <TrustBadges card={card} />

        <p style={S.urgency} data-testid="funding-modal-urgency">
          <span aria-hidden="true">{'\u23F0'}</span>
          <span>
            {tStrict('funding.modal.urgency', 'Apply early to increase chances.')}
          </span>
        </p>

        <div style={S.section}>
          <span style={S.sectionLabel}>
            {tStrict('funding.modal.whyFits', 'Why this fits you')}
          </span>
          <p style={S.sectionBody}>{whyItFits}</p>
        </div>

        <div style={S.metaRow}>
          <div style={S.metaCard}>
            <span style={S.metaLabel}>
              {tStrict('funding.modal.time', 'Time to complete')}
            </span>
            <span style={S.metaValue}>{timeToComplete}</span>
          </div>
          <div style={S.metaCard}>
            <span style={S.metaLabel}>
              {tStrict('funding.modal.difficulty', 'Difficulty')}
            </span>
            <span style={S.metaValue}>
              {tStrict(difficulty.key, difficulty.fallback)}
            </span>
          </div>
        </div>

        {/* Optional used-by counter when the catalog supplies a
            successCount. Hidden when the field is absent so we
            never show a misleading zero. */}
        {Number.isFinite(Number(card.successCount)) && Number(card.successCount) > 0 ? (
          <div style={S.metaCard} data-testid="funding-modal-used-by">
            <span style={S.metaLabel}>
              {tStrict('funding.modal.usedByLabel', 'Used by')}
            </span>
            <span style={S.metaValue}>
              {tStrict('funding.card.usedBy', 'Used by {count} farmers')
                .replace('{count}', String(Number(card.successCount)))}
            </span>
          </div>
        ) : null}

        <QuickApplyKit profile={profile} />

        <div style={S.section}>
          <span style={S.sectionLabel}>
            {tStrict('funding.modal.steps', 'Steps')}
          </span>
          <ol style={S.steps}>
            {STEP_KEYS.map((s, idx) => (
              <li key={s.key} style={S.stepRow}>
                <span style={S.stepBadge}>{idx + 1}</span>
                <span>{tStrict(s.key, s.fallback)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div style={S.ctaCol}>
          <button
            type="button"
            onClick={handleContinue}
            style={S.primary}
            data-testid="funding-modal-continue"
          >
            {tStrict('funding.modal.cta.continue', 'Continue Application')}
          </button>
          <button
            type="button"
            onClick={handleHelp}
            style={S.secondary}
            data-testid="funding-modal-help"
          >
            {tStrict('funding.modal.cta.help', 'Get help applying')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={S.tertiary}
            data-testid="funding-modal-save"
          >
            {tStrict('funding.modal.cta.save', 'Remind me later')}
          </button>
        </div>
      </div>
      {/* Silent help-form host — guarantees the pilot help modal
          can be summoned via the `farroway:open_pilot_help` window
          event regardless of whether the prominent partner CTA is
          mounted on the current route. */}
      <OrganizationPilotCTA silent context={context} />
    </div>
  );
}
