/**
 * SupportCenterPage — primary /support landing.
 *
 *   <Route path="/support" element={<SupportCenterPage />} />
 *
 * SCOPE
 *   Hub for every help affordance:
 *     1. Need help? hero
 *     2. Contact our team (email button, with copy-fallback)
 *     3. Frequently asked questions (link to /support/faq)
 *     4. Report a problem (link to /support/contact)
 *     5. App feedback (mailto + body template)
 *
 * STRICT-RULE AUDIT
 *   • Pure presentational. Never throws.
 *   • Soft Ochre tokens only — body wash matches the rest of the
 *     May 2026 platform refresh.
 *   • Every visible string via tSafe with English fallbacks.
 *   • Mailto + clipboard fallback via emailSupportSafe so a
 *     missing mail client never strands the user.
 *   • Lazy-loaded by App.jsx so the support bundle never enters
 *     the main route chunk.
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../../components/premium/tokens.js';
import {
  SUPPORT_CONFIG,
  emailSupportSafe,
} from '../../config/support.js';

// Lightweight analytics shim — same pattern as other support
// surfaces. Lazy import keeps the analytics chunk out of the
// support bundle.
function _track(event, payload) {
  try {
    import('../../lib/analytics.js').then((mod) => {
      try { mod.safeTrackEvent && mod.safeTrackEvent(event, payload || {}); }
      catch { /* swallow */ }
    }).catch(() => { /* tolerate */ });
  } catch { /* never throw from a logger */ }
}

export default function SupportCenterPage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState('');

  // Email support — opens mail client or copies the address.
  // Toast surfaces the outcome so the user is never confused.
  const handleEmail = useCallback(async () => {
    _track('support_email_clicked', { from: 'support_center' });
    const result = await emailSupportSafe({
      subject: tSafe('support.emailSubject', 'Farroway support'),
    });
    if (result.action === 'opened') return; // mail app took over
    if (result.action === 'copied') {
      setToast(tSafe('support.emailCopied', 'Support email copied.'));
    } else {
      setToast(tSafe('support.emailFailed', 'Could not open mail. Please try again.'));
    }
    setTimeout(() => setToast(''), 2400);
  }, []);

  const handleFaq = useCallback(() => {
    _track('support_faq_opened', { from: 'support_center' });
    navigate(SUPPORT_CONFIG.faqUrl);
  }, [navigate]);

  const handleReport = useCallback(() => {
    _track('support_report_clicked', { from: 'support_center' });
    navigate(SUPPORT_CONFIG.contactUrl);
  }, [navigate]);

  const handleFeedback = useCallback(async () => {
    _track('support_feedback_clicked', { from: 'support_center' });
    const result = await emailSupportSafe({
      subject: tSafe('support.feedbackSubject', 'Farroway feedback'),
      body:    tSafe(
        'support.feedbackBody',
        'What is working well, and what could be better?\n\n',
      ),
    });
    if (result.action === 'copied') {
      setToast(tSafe('support.emailCopied', 'Support email copied.'));
      setTimeout(() => setToast(''), 2400);
    }
  }, []);

  return (
    <main style={S.page} data-testid="support-center-page">
      <div style={S.container}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={S.backBtn}
          className="ff-tap"
          data-testid="support-back"
        >
          {'← '}{tSafe('common.back', 'Back')}
        </button>

        {/* §3.1 — Need help? hero */}
        <header style={S.hero}>
          <h1 style={S.title}>
            {tSafe('support.needHelp', 'Need help?')}
          </h1>
          <p style={S.subtitle}>
            {tSafe(
              'support.subtitle',
              'We’re here if you need support. Tap a card below to reach our team or browse common questions.',
            )}
          </p>
        </header>

        {/* §3.2 — Contact our team */}
        <SupportRow
          icon={'✉️'}
          title={tSafe('support.contactTeam', 'Contact our team')}
          subtitle={SUPPORT_CONFIG.email}
          onClick={handleEmail}
          testId="support-row-email"
          primary
        />

        {/* §3.3 — FAQ */}
        <SupportRow
          icon={'❔'}
          title={tSafe('support.openFaq', 'Frequently asked questions')}
          subtitle={tSafe('support.faqSubtitle', 'Answers to common questions about Farroway.')}
          onClick={handleFaq}
          testId="support-row-faq"
        />

        {/* §3.4 — Report a problem */}
        <SupportRow
          icon={'⚠️'}
          title={tSafe('support.reportIssue', 'Report a problem')}
          subtitle={tSafe('support.reportSubtitle', 'Tell us what happened. We’ll get back to you.')}
          onClick={handleReport}
          testId="support-row-report"
        />

        {/* §3.5 — App feedback */}
        <SupportRow
          icon={'💬'}
          title={tSafe('support.feedback', 'App feedback')}
          subtitle={tSafe('support.feedbackSubtitle', 'Share what’s working and what could be better.')}
          onClick={handleFeedback}
          testId="support-row-feedback"
        />

        {/* WhatsApp — only when configured */}
        {SUPPORT_CONFIG.whatsapp ? (
          <SupportRow
            icon={'💬'}
            title={tSafe('support.whatsapp', 'Chat on WhatsApp')}
            subtitle={SUPPORT_CONFIG.whatsapp}
            onClick={() => {
              try {
                _track('support_whatsapp_clicked', {});
                if (typeof window !== 'undefined') {
                  window.location.href = 'https://wa.me/' + encodeURIComponent(
                    String(SUPPORT_CONFIG.whatsapp).replace(/[^0-9]/g, ''),
                  );
                }
              } catch { /* swallow */ }
            }}
            testId="support-row-whatsapp"
          />
        ) : null}

        {/* Toast — calm, ephemeral; never blocks navigation. */}
        {toast ? (
          <div role="status" aria-live="polite" style={S.toast} data-testid="support-toast">
            {toast}
          </div>
        ) : null}
      </div>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SupportRow({ icon, title, subtitle, onClick, testId, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={primary ? { ...S.row, ...S.rowPrimary } : S.row}
      className="ff-tap"
      data-testid={testId}
    >
      <span style={S.rowIcon} aria-hidden="true">{icon}</span>
      <span style={S.rowBody}>
        <span style={S.rowTitle}>{title}</span>
        <span style={S.rowSub}>{subtitle}</span>
      </span>
      <span style={S.rowArrow} aria-hidden="true">{'→'}</span>
    </button>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
    color: T.ink,
    padding: '1rem',
    paddingBottom: '5rem',
  },
  container: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.85rem',
    borderRadius: 999,
    border: `1px solid ${T.border}`,
    background: T.panel,
    color: T.ink,
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
    fontFamily: 'inherit',
  },
  hero: { padding: '0.5rem 0 0.25rem' },
  title: {
    margin: '0.25rem 0 0',
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: T.ink,
  },
  subtitle: {
    margin: '0.4rem 0 0',
    color: T.inkDim,
    fontSize: '0.9375rem',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.95rem 1.05rem',
    borderRadius: T.radiusCard,
    border: `1px solid ${T.border}`,
    background: T.panelHi,
    color: T.ink,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 64,
    width: '100%',
    fontFamily: 'inherit',
    boxShadow: T.shadowCard,
  },
  rowPrimary: {
    border: `1px solid ${T.ochreBorder}`,
    background: T.ochreSurface,
  },
  rowIcon: {
    fontSize: '1.2rem',
    width: 40,
    height: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
  },
  rowTitle: {
    fontSize: '0.9375rem',
    fontWeight: 800,
    color: T.ink,
  },
  rowSub: {
    fontSize: '0.8125rem',
    color: T.inkDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowArrow: {
    color: T.inkFaint,
    fontSize: '1rem',
    flexShrink: 0,
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: '1.5rem',
    transform: 'translateX(-50%)',
    padding: '0.7rem 1.1rem',
    borderRadius: 999,
    background: T.ink,
    color: '#FFFFFF',
    fontSize: '0.875rem',
    fontWeight: 700,
    boxShadow: '0 12px 28px -10px rgba(0,0,0,0.4)',
    zIndex: 1000,
  },
};
