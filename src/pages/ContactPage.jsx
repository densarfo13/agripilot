/**
 * ContactPage — minimal /contact route for App Store submission.
 *
 * App Store reviewers verify a working "Contact us" path before
 * approval. This page is the single source: a mailto link, a
 * support email, and a back-to-Home affordance. No form — keeps
 * the surface dependency-free for a pre-launch landing.
 *
 * All visible text via tStrict so non-English UIs render the
 * correct localized copy.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';

const SUPPORT_EMAIL = 'support@farroway.app';

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  title:    { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '6px 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  email: {
    color: '#22C55E',
    fontWeight: 700,
    fontSize: 16,
    textDecoration: 'underline',
    wordBreak: 'break-all',
  },
  helper: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },
  back: {
    marginTop: 24,
    color: '#22C55E',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    background: 'none',
    border: 'none',
    padding: 0,
  },
};

export default function ContactPage() {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();

  return (
    <main style={STYLES.page} data-screen="contact-page">
      <h1 style={STYLES.title}>
        {tStrict('contact.title', 'Contact our team')}
      </h1>
      <p style={STYLES.subtitle}>
        {tStrict(
          'contact.subtitle',
          'Email our support team. We try to reply within two business days.'
        )}
      </p>
      <div style={STYLES.card}>
        <span style={STYLES.label}>
          {tStrict('contact.emailLabel', 'Support email')}
        </span>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Farroway support')}`}
          style={STYLES.email}
          data-testid="contact-email"
        >
          {SUPPORT_EMAIL}
        </a>
        <p style={STYLES.helper}>
          {tStrict(
            'contact.helper',
            'Tell us what happened, what you were trying to do, and which device you are using. Screenshots help.'
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        style={STYLES.back}
      >
        {tStrict('common.back', 'Back')}
      </button>
    </main>
  );
}
