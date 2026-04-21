import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/api';

/**
 * VerifyEmail — landing page for the link emailed after signup.
 *
 * Three states:
 *   loading — API call in flight (animated SVG spinner)
 *   success — verified, offer Sign In
 *   error   — invalid/expired link, offer Resend + Sign In paths
 *
 * No user-facing English here leaks a raw server error; we translate
 * common failure shapes into a short, reassuring line. The previous
 * version relied on a CSS `@keyframes spin` that was never defined,
 * so the spinner rendered as a static ring — fixed by using an
 * inline SVG with SMIL animation.
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus]   = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        'This verification link is missing its token. Request a new link from the Sign In page.',
      );
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
          setMessage('Your email is verified. You can now sign in.');
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        // Map common server errors to safe, user-facing copy. Anything
        // we don't recognise falls back to a gentle expired-link line
        // — never the raw "Request failed with status 500" style.
        const safe = friendlyVerifyError(err);
        setMessage(safe);
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Email verification</h1>

        {status === 'loading' && (
          <div style={S.statusBox} aria-live="polite">
            <Spinner />
            <p style={S.statusText}>Verifying your email…</p>
          </div>
        )}

        {status === 'success' && (
          <div style={S.successBox} role="status">
            <div style={S.iconCircle} aria-hidden="true">
              <CheckIcon />
            </div>
            <p style={S.successText}>{message}</p>
            <Link to="/login" style={S.primaryBtn} data-testid="verify-email-signin">
              Continue to sign in
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div style={S.errorBox} role="alert">
            <div style={S.errorIconCircle} aria-hidden="true">
              <CrossIcon />
            </div>
            <p style={S.errorText}>{message}</p>
            <div style={S.actionsRow}>
              <Link to="/login" style={S.primaryBtn}>
                Go to sign in
              </Link>
              <Link to="/forgot-password" style={S.secondaryBtn}>
                Request a new link
              </Link>
            </div>
          </div>
        )}

        {status !== 'error' && (
          <p style={S.footerText}>
            <Link to="/login" style={S.link}>Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function friendlyVerifyError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('expired'))      return 'This verification link has expired. Request a new one below.';
  if (msg.includes('invalid'))      return 'This verification link is no longer valid. Request a new one below.';
  if (msg.includes('already'))      return 'This email is already verified — go ahead and sign in.';
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'We could not reach the server. Check your connection and try the link again.';
  }
  return 'We could not verify your email with this link. Request a new one below.';
}

function Spinner() {
  // Inline SVG with SMIL rotate — works without a global @keyframes.
  return (
    <svg
      width="40" height="40" viewBox="0 0 40 40"
      role="img" aria-label="Loading"
      style={S.spinnerSvg}
    >
      <circle cx="20" cy="20" r="16" fill="none"
              stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
      <path d="M20 4 A16 16 0 0 1 36 20"
            fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 20 20"
          to="360 20 20"
          dur="1s"
          repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" />
    </svg>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#0F172A', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card:       { width: '100%', maxWidth: '28rem', borderRadius: '16px',
                background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)',
                padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)', textAlign: 'center' },
  title:      { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1.5rem 0' },

  statusBox:  { padding: '1rem 0', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '0.75rem' },
  statusText: { color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', margin: 0 },
  spinnerSvg: { display: 'block' },

  successBox:     { padding: '0.5rem 0', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '0.875rem' },
  successText:    { fontSize: '0.9375rem', color: '#86EFAC', margin: 0, lineHeight: 1.5 },
  iconCircle:     { width: '3rem', height: '3rem', borderRadius: '50%',
                    background: 'rgba(134,239,172,0.15)', color: '#86EFAC',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  errorBox:       { padding: '0.5rem 0', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '0.875rem' },
  errorText:      { fontSize: '0.9375rem', color: '#FCA5A5', margin: 0, lineHeight: 1.5 },
  errorIconCircle:{ width: '3rem', height: '3rem', borderRadius: '50%',
                    background: 'rgba(252,165,165,0.15)', color: '#FCA5A5',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  actionsRow:     { display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
                    justifyContent: 'center', marginTop: '0.25rem' },

  primaryBtn: { padding: '0.625rem 1rem', borderRadius: 10, border: 'none',
                background: '#22C55E', color: '#07210E', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none',
                display: 'inline-block' },
  secondaryBtn:{ padding: '0.625rem 1rem', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'transparent', color: '#EAF2FF',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                textDecoration: 'none', display: 'inline-block' },

  link:       { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  footerText: { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
