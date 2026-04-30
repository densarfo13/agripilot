/**
 * FundingOpportunityDetail — single-opportunity view with
 * the Apply / Request Help / Mark Applied flow.
 *
 *   <Route path="/opportunities/:id" element={<FundingOpportunityDetail />} />
 *
 * Spec contract (Funding Apply + Request Help, § 3–6)
 *   * Title, benefit, deadline, source, eligibility, why-
 *     matched, conservative warning copy.
 *   * Three buttons:
 *       - Apply Now           → opens source URL in new
 *                               tab + records INTERESTED
 *       - Request Help        → opens modal → submit →
 *                               records ASSISTANCE_REQUESTED
 *       - I Applied           → records APPLIED
 *   * Trust copy enforced everywhere — never "submitted" /
 *     "approved" / "you qualify".
 *
 * Strict-rule audit (per spec § 12)
 *   * Local-first — every action persists to
 *     fundingApplicationStore. Backend is OPTIONAL.
 *   * No sensitive document upload anywhere — Request Help
 *     collects name/phone/message only.
 *   * Apply Now opens the OFFICIAL source in a new tab. We
 *     do NOT iframe the source (clickjacking risk + most
 *     program sites refuse framing).
 *   * On 404 (no such opportunity), renders a calm
 *     "Opportunity not available" panel with a link back to
 *     /opportunities — never crashes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useAuth }    from '../context/AuthContext.jsx';
import {
  getActiveFundingOpportunities, FUNDING_EVENTS,
} from '../funding/fundingStore.js';
import { matchFundingForFarm } from '../funding/fundingMatcher.js';
import { localizeFundingText } from '../funding/localizeFundingText.js';
import {
  saveFundingInterest, recordApplyClick, findInterest,
  INTEREST_STATUS,
} from '../funding/fundingApplicationStore.js';
import {
  saveVerification, tryReadGeolocation, ACTION_TYPES,
} from '../verification/verificationStore.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { tSafe } from '../i18n/tSafe.js';
import { useTranslation } from '../i18n/index.js';
import {
  confirmFundingApplied, confirmFundingHelpRequested,
} from '../notifications/smsConfirmations.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

const TYPE_LABELS = Object.freeze({
  grant:         'Grant',
  subsidy:       'Subsidy',
  loan:          'Loan',
  training:      'Training',
  input_support: 'Input Support',
});

export default function FundingOpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, farms } = useProfile();
  // SMS confirmations are localized via the active language;
  // helper falls back to 'en' if undefined.
  const { lang: language } = useTranslation();

  const activeFarm = useMemo(() => {
    if (Array.isArray(farms) && farms.length) return farms[0];
    return profile || null;
  }, [farms, profile]);

  // Find the opportunity in the local store. Inactive /
  // unverified entries never reach getActiveFundingOpportunities
  // so a deactivated id renders the not-available panel.
  const opportunity = useMemo(() => {
    if (!id) return null;
    return getActiveFundingOpportunities().find((o) => o.id === id) || null;
  }, [id]);

  // Why-matched reasons (re-run the matcher for THIS row).
  const matchInfo = useMemo(() => {
    if (!opportunity) return null;
    const m = matchFundingForFarm(activeFarm, [opportunity])[0];
    return m || null;
  }, [opportunity, activeFarm]);

  // Existing interest from THIS farmer for THIS opportunity
  // (drives the surface copy — "Mark Applied" vs "I'm
  // Applied" feedback).
  const farmerId = user?.sub || profile?.userId || null;
  const [existingInterest, setExistingInterest] = useState(() =>
    findInterest({
      farmerId, opportunityId: id,
    }));
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [flash, setFlash] = useState('');

  // Ack the page view in analytics so ops can see funnel.
  useEffect(() => {
    if (!opportunity) return;
    try {
      safeTrackEvent(FUNDING_EVENTS.VIEWED, {
        opportunityId: opportunity.id, detail: true,
      });
    } catch { /* ignore */ }
  }, [opportunity]);

  // ── No opportunity / opportunity deactivated ────────
  if (!opportunity) {
    return (
      <main style={S.page}>
        <div style={S.card}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.title}>
            {tSafe('funding.detailNotAvailable',
              'Opportunity not available')}
          </h1>
          <p style={S.lead}>
            {tSafe('funding.detailNotAvailableLead',
              'This opportunity may have closed or been removed. Check the latest list of programs.')}
          </p>
          <Link to="/opportunities" style={S.btnPrimary}
                data-testid="detail-back-list">
            {tSafe('funding.backToList', 'Back to opportunities')}
          </Link>
        </div>
      </main>
    );
  }

  const o   = opportunity;
  const reasons = (matchInfo && matchInfo.reasons) || [];
  const deadlineLabel = o.deadline
    ? new Date(o.deadline).toLocaleDateString(undefined,
        { month: 'short', day: 'numeric', year: 'numeric' })
    : tSafe('funding.deadlineRolling', 'Rolling — no deadline');

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  }

  // ── Apply Now ────────────────────────────────────────
  function handleApplyNow() {
    // Open source in a new tab. We do NOT iframe — most
    // program sites refuse framing and we never want to be
    // mistaken for the application surface itself.
    if (o.sourceUrl) {
      try { window.open(o.sourceUrl, '_blank', 'noopener,noreferrer'); }
      catch { /* popup blocked → fall through to copy below */ }
    }
    const interest = recordApplyClick({
      farmerId,
      farmId:        activeFarm?.id || profile?.farmId || null,
      opportunityId: o.id,
      farmerName:    profile?.fullName || '',
      farmerPhone:   profile?.phoneE164 || profile?.phone || '',
    });
    if (interest) setExistingInterest(interest);
    // Spec §5: SMS confirmation when farmer commits to applying.
    // Fire-and-forget; no UX impact if phone missing or Twilio fails.
    try { confirmFundingApplied(profile, o, language); }
    catch { /* never block the apply flow */ }
    showFlash(o.sourceUrl
      ? tSafe('funding.openingSource',
          'Opening official source. Apply through their site.')
      : tSafe('funding.contactSourceShown',
          'Contact info shown below. Apply through the official source.'));
  }

  // ── I Applied ───────────────────────────────────────
  function handleMarkApplied() {
    const stored = saveFundingInterest({
      id:            existingInterest?.id,
      farmerId,
      farmId:        activeFarm?.id || profile?.farmId || null,
      opportunityId: o.id,
      status:        INTEREST_STATUS.APPLIED,
      farmerName:    profile?.fullName || existingInterest?.farmerName || '',
      farmerPhone:   profile?.phoneE164 || profile?.phone
                       || existingInterest?.farmerPhone || '',
    });
    if (stored) setExistingInterest(stored);
    showFlash(tSafe('funding.markedApplied',
      'Marked as applied. Keep checking the source for updates.'));
  }

  return (
    <main style={S.page} data-testid="funding-detail-page">
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <Link to="/opportunities" style={S.backLink}
                data-testid="detail-back">
            ← {tSafe('funding.backToList', 'Back to opportunities')}
          </Link>
        </header>

        {/* Title + badges */}
        <section style={S.titleSection}>
          <div style={S.badgeRow}>
            <span style={S.typeBadge}>
              {TYPE_LABELS[o.opportunityType] || 'Program'}
            </span>
            {o.sample && (
              <span style={S.samplePill} title="Demo / sample entry">
                SAMPLE
              </span>
            )}
            {!o.sample && o.verified && (
              <span style={S.verifiedPill}>
                ✓ {tSafe('funding.verifiedSource', 'Verified source')}
              </span>
            )}
            {existingInterest && (
              <StatusPill status={existingInterest.status} />
            )}
          </div>
          <h1 style={S.title}>{o.title}</h1>
          <p style={S.desc}>{o.description}</p>
        </section>

        {/* Honesty warning */}
        <p style={S.warning} role="note">
          {tSafe('funding.mayQualifyWarning',
            'You may qualify. Check requirements before applying. Always confirm with the official source.')}
        </p>

        {/* Key facts grid */}
        <section style={S.facts}>
          {o.benefit && (
            <Fact label={tSafe('funding.benefit', 'Benefit')}
                  value={localizeFundingText(o.benefit, language)} highlight />
          )}
          <Fact label={tSafe('funding.deadline', 'Deadline')}
                value={deadlineLabel} />
          {o.sourceName && (
            <Fact label={tSafe('funding.source', 'Source')}
                  value={o.sourceName} />
          )}
          {(o.country && o.country !== '*') && (
            <Fact label={tSafe('funding.country', 'Country')}
                  value={o.country} />
          )}
          {Array.isArray(o.regions) && o.regions.length > 0 && (
            <Fact label={tSafe('funding.regions', 'Regions')}
                  value={o.regions.join(', ')} />
          )}
          {Array.isArray(o.crops) && o.crops.length > 0 && (
            <Fact label={tSafe('funding.crops', 'Crops')}
                  value={o.crops.join(', ')} />
          )}
        </section>

        {/* Eligibility */}
        {o.eligibilityText && (
          <section style={S.section}>
            <h2 style={S.h2}>{tSafe('funding.eligibility', 'Eligibility')}</h2>
            <p style={S.sectionBody}>{o.eligibilityText}</p>
          </section>
        )}

        {/* Why matched */}
        {reasons.length > 0 && (
          <section style={S.section}>
            <h2 style={S.h2}>{tSafe('funding.whyMatched', 'Why this matches')}</h2>
            <ul style={S.reasonList}>
              {reasons.map((r) => (
                <li key={r} style={S.reasonItem}>
                  <span style={S.reasonDot} aria-hidden="true">•</span>
                  {localizeFundingText(r, language)}
                </li>
              ))}
            </ul>
            <p style={S.mayQualify}>
              {tSafe('funding.mayQualify',
                'You may qualify — confirm with the source.')}
            </p>
          </section>
        )}

        {/* Action buttons */}
        <section style={S.actionsSection}>
          <h2 style={S.h2}>{tSafe('funding.takeAction', 'Take action')}</h2>
          <div style={S.btnRow}>
            <button
              type="button"
              onClick={handleApplyNow}
              style={S.btnPrimary}
              data-testid="detail-apply-now"
            >
              🌐 {tSafe('funding.applyNow', 'Apply Now')}
            </button>
            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              style={S.btnSecondary}
              data-testid="detail-request-help"
            >
              🤝 {tSafe('funding.requestHelp', 'Request Help')}
            </button>
            <button
              type="button"
              onClick={handleMarkApplied}
              style={S.btnGhost}
              data-testid="detail-mark-applied"
            >
              ✓ {tSafe('funding.markApplied',
                existingInterest?.status === INTEREST_STATUS.APPLIED
                  ? 'Already marked applied'
                  : 'I applied')}
            </button>
          </div>
          <p style={S.actionHint}>
            {tSafe('funding.checkSource',
              'Apply through the official source. Marking as applied here helps you self-track only — Farroway does not approve or guarantee funding.')}
          </p>

          {/* Contact info — surfaced when no sourceUrl */}
          {!o.sourceUrl && (o.sourceName || o.contactEmail) && (
            <div style={S.contactBox}>
              <p style={S.contactLabel}>
                {tSafe('funding.contactSource',
                  'Contact the source directly')}
              </p>
              {o.sourceName && (
                <p style={S.contactRow}>{o.sourceName}</p>
              )}
              {o.contactEmail && (
                <p style={S.contactRow}>
                  <a href={`mailto:${o.contactEmail}`}
                     style={S.contactLink}>{o.contactEmail}</a>
                </p>
              )}
            </div>
          )}

          {flash && (
            <p style={S.flash} role="status" aria-live="polite">{flash}</p>
          )}
        </section>
      </div>

      {helpModalOpen && (
        <RequestHelpModal
          opportunity={o}
          farmerId={farmerId}
          farmId={activeFarm?.id || profile?.farmId || null}
          existingId={existingInterest?.id}
          prefillName={profile?.fullName || ''}
          prefillPhone={profile?.phoneE164 || profile?.phone || ''}
          onClose={() => setHelpModalOpen(false)}
          onSubmitted={(stored) => {
            setExistingInterest(stored);
            setHelpModalOpen(false);
            // Spec §5: SMS confirmation when help request is
            // submitted. Honest expectation — "may contact you",
            // not a guarantee. Fire-and-forget.
            try { confirmFundingHelpRequested(profile, o, language); }
            catch { /* never block the help-submit flow */ }
            showFlash(tSafe('funding.requestSent',
              'Request sent. A program officer or support team may follow up.'));
          }}
        />
      )}
    </main>
  );
}

/* ─── Subcomponents ────────────────────────────────── */

function Fact({ label, value, highlight }) {
  return (
    <div style={{
      ...factStyles.fact,
      ...(highlight ? factStyles.factHighlight : {}),
    }}>
      <div style={factStyles.factLabel}>{label}</div>
      <div style={factStyles.factVal}>{value}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    INTERESTED:           { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.40)',  fg: '#86EFAC', label: 'Interested' },
    ASSISTANCE_REQUESTED: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.45)', fg: '#FCD34D', label: 'Help requested' },
    APPLIED:              { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.45)', fg: '#93C5FD', label: 'Applied' },
    CONTACTED:            { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.78)', label: 'Contacted' },
  };
  const s = map[status] || map.INTERESTED;
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: s.bg, color: s.fg,
      border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function RequestHelpModal({
  opportunity, farmerId, farmId, existingId,
  prefillName, prefillPhone,
  onClose, onSubmitted,
}) {
  const [name,    setName]    = useState(prefillName);
  const [phone,   setPhone]   = useState(prefillPhone);
  const [message, setMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [err,     setErr]     = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!String(name).trim()) {
      setErr(tSafe('funding.error.nameRequired',
        'Please enter your name so we can reach you.'));
      return;
    }
    if (!String(phone).trim()) {
      setErr(tSafe('funding.error.phoneRequired',
        'Please enter a phone we can call back on.'));
      return;
    }
    const stored = saveFundingInterest({
      id:            existingId,        // upsert if existing
      farmerId,
      farmId,
      opportunityId: opportunity.id,
      status:        INTEREST_STATUS.ASSISTANCE_REQUESTED,
      farmerName:    name,
      farmerPhone:   phone,
      message,
    });

    // v3 Verification System: attach a best-effort
    // verification record so NGO operators can see whether
    // the request came from a witnessed device. Photo is
    // OPTIONAL — request still succeeds at level 0–2 without.
    // Photo passed as a raw File so IndexedDB can persist
    // it at full resolution.
    try {
      const gps = await tryReadGeolocation(2500);
      saveVerification({
        farmerId,
        actionType: ACTION_TYPES.FUNDING_REQUEST,
        actionId:   stored ? stored.id : null,
        photoBlob:  photoFile || null,
        location:   gps ? { lat: gps.lat, lng: gps.lng } : null,
      });
    } catch { /* never block */ }

    if (stored) onSubmitted(stored);
  }

  return (
    <div style={modalStyles.overlay} role="dialog" onClick={onClose}>
      <form
        style={modalStyles.card}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        data-testid="request-help-modal"
      >
        <header style={modalStyles.header}>
          <h2 style={modalStyles.title}>
            {tSafe('funding.requestHelpTitle', 'Request help applying')}
          </h2>
          <button type="button" onClick={onClose} style={modalStyles.close}
                  aria-label={tSafe('common.close', 'Close')}>✕</button>
        </header>
        <p style={modalStyles.lead}>
          {tSafe('funding.requestHelpLead',
            'Share your contact and a short note. A program officer or support team may follow up.')}
        </p>

        {err && <p style={modalStyles.err} role="alert">{err}</p>}

        <input
          type="text"
          placeholder={tSafe('funding.name', 'Your name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={modalStyles.input}
          data-testid="help-name"
          required
        />
        <input
          type="tel"
          placeholder={tSafe('funding.phone', 'Phone (with country code)')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={modalStyles.input}
          data-testid="help-phone"
          required
        />
        <textarea
          placeholder={tSafe('funding.message',
            'What kind of help do you need? (optional)')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          style={{ ...modalStyles.input, resize: 'vertical' }}
          data-testid="help-message"
        />

        {/* Optional photo — boosts verification level. The
            request succeeds without one. */}
        <label style={{
          display: 'flex', flexDirection: 'column',
          gap: '0.25rem',
          color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem',
        }}>
          <span style={{ fontWeight: 700 }}>
            {tSafe('funding.photoOptional',
              'Photo (optional, e.g. of your farm)')}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            style={modalStyles.input}
            data-testid="help-photo"
          />
          {photoFile && (
            <span style={{ color: '#86EFAC', fontWeight: 700 }}>
              ✓ {tSafe('funding.photoAttached', 'Photo attached')}
            </span>
          )}
        </label>

        <button type="submit" style={modalStyles.submit}
                data-testid="help-submit">
          {tSafe('funding.sendRequest', 'Send request')}
        </button>

        <p style={modalStyles.privacy}>
          {tSafe('funding.requestPrivacy',
            'We share your contact only with the support team handling this opportunity. Never with third parties.')}
        </p>
      </form>
    </div>
  );
}

/* ─── Styles ───────────────────────────────────────── */

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '48rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  card: {                          // used by the not-available branch
    width: '100%',
    maxWidth: '32rem', margin: '0 auto',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '2rem 1.5rem',
    display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', gap: '0.75rem',
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '0.5rem',
  },
  backLink: {
    color: C.lightGreen, fontSize: '0.875rem',
    fontWeight: 700, textDecoration: 'none',
  },
  titleSection: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  badgeRow: { display: 'flex', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.4rem' },
  typeBadge: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.15)',
    color: C.lightGreen,
    border: '1px solid rgba(34,197,94,0.40)',
  },
  samplePill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(245,158,11,0.18)', color: '#FCD34D',
    border: '1px solid rgba(245,158,11,0.45)',
  },
  verifiedPill: {
    fontSize: '0.6875rem', fontWeight: 800,
    padding: '0.2rem 0.6rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  title: {
    margin: 0, fontSize: '1.5rem', fontWeight: 800,
    color: C.white, letterSpacing: '-0.01em', lineHeight: 1.2,
  },
  desc: {
    margin: 0, color: 'rgba(255,255,255,0.78)',
    fontSize: '0.9375rem', lineHeight: 1.55,
  },
  warning: {
    margin: 0,
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.30)',
    borderRadius: '12px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    fontWeight: 600,
  },
  facts: {
    display: 'grid', gap: '0.6rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
  },
  section: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 800,
        color: C.white, letterSpacing: '-0.005em' },
  sectionBody: { margin: 0, color: 'rgba(255,255,255,0.78)',
                 fontSize: '0.9375rem', lineHeight: 1.5 },
  reasonList: { listStyle: 'none', margin: 0, padding: 0,
                display: 'flex', flexDirection: 'column',
                gap: '0.2rem' },
  reasonItem: { color: 'rgba(255,255,255,0.85)',
                fontSize: '0.9375rem', display: 'flex',
                alignItems: 'flex-start', gap: '0.4rem' },
  reasonDot:  { color: C.lightGreen, fontWeight: 800 },
  mayQualify: {
    margin: '0.4rem 0 0',
    color: '#FCD34D', fontStyle: 'italic',
    fontSize: '0.8125rem',
  },
  actionsSection: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(34,197,94,0.25)',
    textDecoration: 'none',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.30)',
    background: 'rgba(255,255,255,0.04)',
    color: C.white,
    fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
  },
  actionHint: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem', lineHeight: 1.5,
  },
  contactBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '0.75rem',
  },
  contactLabel: {
    margin: 0, color: C.lightGreen,
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: '0.3rem',
  },
  contactRow: { margin: '0.15rem 0', color: C.white,
                fontSize: '0.875rem' },
  contactLink: { color: C.lightGreen, textDecoration: 'none' },
  flash: {
    margin: '0.5rem 0 0', color: C.lightGreen,
    fontSize: '0.875rem', fontWeight: 700,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
  },
  lead: { margin: 0, color: 'rgba(255,255,255,0.75)',
          fontSize: '0.9375rem' },
};

const factStyles = {
  fact: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  factHighlight: {
    background: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  factLabel: {
    color: C.lightGreen,
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  factVal: { color: C.white, fontWeight: 700,
             fontSize: '0.9375rem' },
};

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(8,12,22,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%', maxWidth: '28rem',
    background: C.darkPanel,
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '18px',
    padding: '1.4rem',
    color: C.white,
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  },
  header: { display: 'flex', alignItems: 'center',
            justifyContent: 'space-between' },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 800 },
  close: { background: 'transparent', border: 'none',
           color: C.white, fontSize: '1rem', cursor: 'pointer' },
  lead: { margin: 0, color: 'rgba(255,255,255,0.7)',
          fontSize: '0.9375rem', lineHeight: 1.5 },
  err: { margin: 0, color: '#FCA5A5', fontSize: '0.875rem',
         background: 'rgba(239,68,68,0.10)',
         border: '1px solid rgba(239,68,68,0.30)',
         borderRadius: '8px', padding: '0.5rem 0.75rem' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.7rem 0.85rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  submit: {
    marginTop: '0.25rem',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(34,197,94,0.25)',
  },
  privacy: { margin: 0, color: 'rgba(255,255,255,0.55)',
             fontSize: '0.8125rem', lineHeight: 1.45 },
};
