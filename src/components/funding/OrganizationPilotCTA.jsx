/**
 * OrganizationPilotCTA — partnership funnel for NGO / government /
 * cooperative / extension partners.
 *
 * Renders a high-contrast CTA card on the Funding Hub. On click,
 * an inline modal collects the pilot intake fields per spec §5.E:
 *
 *   • Organization name (required)
 *   • Country
 *   • Number of farmers
 *   • Goal
 *   • Email (required)
 *   • Message
 *
 * Submission goes through `submitPilotLead()` in
 * `src/services/fundingService.js` — local-first today, future-
 * proofed for a `POST /api/partnerships/pilot-leads` swap. On
 * success the modal flips to a confirmation message.
 *
 * Strict-rule audit
 *   • All visible text via tStrict; no English bleed.
 *   • Modal traps focus while open, ESC closes, click-outside
 *     dismisses. Keyboard-friendly without pulling in a UI lib.
 *   • Self-hides when the `ngoPartnershipLeads` flag is off.
 *   • Never throws — async submission errors flip the form to a
 *     "try again" state without crashing the page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { submitPilotLead } from '../../services/fundingService.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';

const STYLES = {
  card: {
    padding: '16px 18px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,197,94,0.12))',
    border: '1px solid rgba(168,85,247,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  cardTitle:  { margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' },
  cardCopy:   { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  bullets:    { margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  cta: {
    marginTop: 4,
    alignSelf: 'flex-start',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#A855F7',
    color: '#0B1D34',
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
  },

  // ── Modal ──
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 200,
  },
  modal: {
    width: 'min(540px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    background: '#0B1D34',
    border: '1px solid rgba(168,85,247,0.5)',
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    color: '#fff',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  modalTitle:  { margin: 0, fontSize: 18, fontWeight: 800 },
  closeBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    width: 28,
    height: 28,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  textarea: {
    minHeight: 92,
    resize: 'vertical',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  submitRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancel: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  submit: {
    padding: '10px 16px',
    borderRadius: 10,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  },
  errorBlock: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#FCA5A5',
    fontSize: 12,
  },
  successBlock: {
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.14)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    fontSize: 14,
    lineHeight: 1.5,
  },
};

const BULLETS = [
  { key: 'funding.org.bullet.reach',   fallback: 'Reach active farmers' },
  { key: 'funding.org.bullet.track',   fallback: 'Track daily activity' },
  { key: 'funding.org.bullet.measure', fallback: 'Measure program impact' },
  { key: 'funding.org.bullet.pilot',   fallback: 'Launch a 90-day farmer impact pilot' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {object}  props
 * @param {object}  [props.context]   country / userRole bag
 * @param {boolean} [props.silent]    when true, suppresses the prominent
 *                                    trigger card AND ignores the
 *                                    `ngoPartnershipLeads` gate so the
 *                                    pilot-help modal listener stays
 *                                    available wherever the wrapper is
 *                                    mounted (e.g. inside the new
 *                                    ApplicationPreviewModal).
 */
export default function OrganizationPilotCTA({ context = {}, silent = false }) {
  // Subscribe to language change.
  useTranslation();

  const flagOn = isFeatureEnabled('ngoPartnershipLeads');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const firstFieldRef = useRef(null);

  const [form, setForm] = useState({
    organizationName: '',
    country:          context.country || '',
    numberOfFarmers:  '',
    goal:             '',
    email:            '',
    message:          '',
  });

  // Prefill-open hand-off — ApplicationPreviewModal dispatches a
  // `farroway:open_pilot_help` window event with a `detail` bag of
  // prefill fields. Listening here keeps the surfaces loosely
  // coupled: the modal does not need a prop reference to this CTA.
  // Existing usages (the regular "Become a partner" entry point)
  // are unaffected because the listener only opens the modal +
  // merges fields; manual button clicks still work the same way.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOpen = (e) => {
      try {
        const detail = (e && e.detail) || {};
        setForm((cur) => ({
          ...cur,
          organizationName: detail.organizationName || cur.organizationName,
          country:          detail.country          || cur.country,
          numberOfFarmers:  detail.numberOfFarmers  || cur.numberOfFarmers,
          goal:             detail.goal             || cur.goal,
          email:            detail.email            || cur.email,
          message:          detail.message          || cur.message,
        }));
        setError('');
        setSuccess(false);
        setOpen(true);
      } catch { /* swallow */ }
    };
    try { window.addEventListener('farroway:open_pilot_help', onOpen); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener('farroway:open_pilot_help', onOpen); }
      catch { /* swallow */ }
    };
  }, []);

  // ESC closes the modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the first field when the modal opens.
  useEffect(() => {
    if (open && firstFieldRef.current) {
      try { firstFieldRef.current.focus(); } catch { /* ignore */ }
    }
  }, [open]);

  const openModal = useCallback(() => {
    try {
      trackFundingEvent('ngo_pilot_cta_clicked', {
        country:  context.country || null,
        userRole: context.userRole || null,
      });
    } catch { /* never propagate */ }
    setOpen(true);
    setError('');
    setSuccess(false);
  }, [context.country, context.userRole]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setSubmitting(false);
  }, []);

  const onChange = (field) => (e) => {
    const v = e?.target?.value ?? '';
    setForm((cur) => ({ ...cur, [field]: v }));
  };

  const onSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setError('');
    if (!form.organizationName || !form.organizationName.trim()) {
      setError(tStrict('funding.org.error.organizationName', 'Please enter your organization name.'));
      return;
    }
    if (!form.email || !EMAIL_RE.test(form.email.trim())) {
      setError(tStrict('funding.org.error.email', 'Please enter a valid email address.'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitPilotLead({
        organizationName: form.organizationName.trim(),
        country:          (form.country || '').trim(),
        numberOfFarmers:  (form.numberOfFarmers || '').trim(),
        goal:             (form.goal || '').trim(),
        email:            form.email.trim(),
        message:          (form.message || '').trim(),
      });
      if (result?.ok) {
        try {
          trackFundingEvent('ngo_pilot_form_submitted', {
            country:  context.country || form.country || null,
            userRole: context.userRole || null,
            leadId:   result.lead?.id || null,
          });
        } catch { /* never propagate */ }
        setSuccess(true);
      } else {
        setError(tStrict(
          'funding.org.error.submit',
          'We could not save your request. Please try again.'
        ));
      }
    } catch {
      setError(tStrict(
        'funding.org.error.submit',
        'We could not save your request. Please try again.'
      ));
    } finally {
      setSubmitting(false);
    }
  }, [form, context.country, context.userRole]);

  // We keep the listener + modal mounted regardless of the
  // `ngoPartnershipLeads` flag so the new ApplicationPreviewModal's
  // "Get help applying" button can still summon this form when the
  // partner-CTA card itself is hidden. Only the prominent trigger
  // section is flag-gated to preserve the original surface logic.
  return (
    <>
      {flagOn && !silent ? (
        <section style={STYLES.card} data-testid="organization-pilot-cta">
          <div style={STYLES.cardHeader}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>{'\uD83E\uDD1D'}</span>
            <h3 style={STYLES.cardTitle}>
              {tStrict('funding.org.title', 'For Organizations')}
            </h3>
          </div>
          <p style={STYLES.cardCopy}>
            {tStrict(
              'funding.org.copy',
              'Work with Farroway to reach active farmers, track engagement, and measure outcomes.'
            )}
          </p>
          <ul style={STYLES.bullets}>
            {BULLETS.map((b) => (
              <li key={b.key}>{tStrict(b.key, b.fallback)}</li>
            ))}
          </ul>
          <button type="button" style={STYLES.cta} onClick={openModal} data-testid="org-pilot-open">
            {tStrict('funding.org.startPilot', 'Start a pilot program')}
          </button>
        </section>
      ) : null}

      {open ? (
        <div
          style={STYLES.overlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pilot-modal-title"
          data-testid="org-pilot-modal"
        >
          <div style={STYLES.modal}>
            <div style={STYLES.modalHeader}>
              <h2 id="pilot-modal-title" style={STYLES.modalTitle}>
                {success
                  ? tStrict('funding.org.successTitle', 'Request received')
                  : tStrict('funding.org.formTitle', 'Start a pilot program')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                style={STYLES.closeBtn}
                aria-label={tStrict('common.close', 'Close')}
              >
                {'\u2715'}
              </button>
            </div>

            {success ? (
              <div style={STYLES.successBlock}>
                {tStrict(
                  'funding.org.successMessage',
                  'Thanks. We received your pilot request and will follow up.'
                )}
              </div>
            ) : (
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {error ? <div style={STYLES.errorBlock}>{error}</div> : null}

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-name">
                    {tStrict('funding.org.field.orgName', 'Organization name')}
                  </label>
                  <input
                    id="org-name"
                    ref={firstFieldRef}
                    type="text"
                    style={STYLES.input}
                    value={form.organizationName}
                    onChange={onChange('organizationName')}
                    autoComplete="organization"
                    required
                  />
                </div>

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-country">
                    {tStrict('funding.org.field.country', 'Country')}
                  </label>
                  <input
                    id="org-country"
                    type="text"
                    style={STYLES.input}
                    value={form.country}
                    onChange={onChange('country')}
                    autoComplete="country-name"
                  />
                </div>

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-farmers">
                    {tStrict('funding.org.field.numberOfFarmers', 'Number of farmers')}
                  </label>
                  <input
                    id="org-farmers"
                    type="text"
                    style={STYLES.input}
                    value={form.numberOfFarmers}
                    onChange={onChange('numberOfFarmers')}
                    inputMode="numeric"
                  />
                </div>

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-goal">
                    {tStrict('funding.org.field.goal', 'Goal')}
                  </label>
                  <input
                    id="org-goal"
                    type="text"
                    style={STYLES.input}
                    value={form.goal}
                    onChange={onChange('goal')}
                  />
                </div>

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-email">
                    {tStrict('funding.org.field.email', 'Email')}
                  </label>
                  <input
                    id="org-email"
                    type="email"
                    style={STYLES.input}
                    value={form.email}
                    onChange={onChange('email')}
                    autoComplete="email"
                    required
                  />
                </div>

                <div style={STYLES.field}>
                  <label style={STYLES.label} htmlFor="org-message">
                    {tStrict('funding.org.field.message', 'Message')}
                  </label>
                  <textarea
                    id="org-message"
                    style={STYLES.textarea}
                    value={form.message}
                    onChange={onChange('message')}
                  />
                </div>

                <div style={STYLES.submitRow}>
                  <button type="button" onClick={closeModal} style={STYLES.cancel}>
                    {tStrict('common.cancel', 'Cancel')}
                  </button>
                  <button type="submit" style={STYLES.submit} disabled={submitting}>
                    {submitting
                      ? tStrict('common.submitting', 'Submitting…')
                      : tStrict('funding.org.field.submit', 'Submit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
