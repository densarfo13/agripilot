/**
 * src/pages/Activate.jsx — wave-39 invite-activation route.
 *
 *   Route: /activate?token=<raw-invite-token>
 *
 * Why this exists
 * ───────────────
 * The wave-38 invite runtime persists only the token HASH and
 * never the raw token. The raw token only ever travels:
 *   1. From the server-side invite creator to the delivery channel
 *      (SendGrid / Twilio) exactly once.
 *   2. From the user's email/SMS link back to this page, where it
 *      is exchanged for an authenticated session.
 *
 * On mount, this page:
 *   • reads `token` from the URL query string,
 *   • POSTs to /api/invites/accept with `{ token }`,
 *   • renders one of three states: accepting / accepted / failed.
 *
 * Strict-rule audit
 *   • Token is NEVER logged. The acceptResult envelope from the
 *     server carries no token, only an opaque session-bearer cookie
 *     (HttpOnly, set by the server response).
 *   • Page sets `window.__farrowayActivateRouteMounted = true` on
 *     mount so __inviteHealth() can attest the route exists.
 *   • Safe-fail on any error: shows "This invite link is no longer
 *     valid." with no stack trace.
 *   • Pure render. No PII fields rendered.
 */

import React, { useEffect, useState } from 'react';

const STATE_ACCEPTING = 'accepting';
const STATE_ACCEPTED  = 'accepted';
const STATE_FAILED    = 'failed';

function _readTokenFromUrl() {
  try {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search || '');
    const token  = params.get('token');
    return typeof token === 'string' && token.length > 8 ? token : null;
  } catch { return null; }
}

function _attestRouteMounted() {
  try {
    if (typeof window === 'undefined') return;
    (window).__farrowayActivateRouteMounted = true;
  } catch { /* swallow */ }
}

async function _postAccept(token) {
  try {
    if (typeof fetch === 'undefined') {
      return { ok: false, reason: 'fetch_unavailable' };
    }
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res || !res.ok) {
      // Honest degradation — never expose server detail.
      return { ok: false, reason: 'server_rejected' };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, redirect: typeof json?.redirect === 'string' ? json.redirect : null };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

export default function Activate() {
  const [state, setState] = useState(STATE_ACCEPTING);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    _attestRouteMounted();
    let cancelled = false;
    (async () => {
      const token = _readTokenFromUrl();
      if (!token) { if (!cancelled) setState(STATE_FAILED); return; }
      const result = await _postAccept(token);
      if (cancelled) return;
      if (result.ok) {
        setRedirect(result.redirect);
        setState(STATE_ACCEPTED);
      } else {
        setState(STATE_FAILED);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Optional auto-redirect once the server replies with a path.
  useEffect(() => {
    if (state !== STATE_ACCEPTED || !redirect) return;
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      try { window.location.assign(redirect); } catch { /* swallow */ }
    }, 800);
    return () => clearTimeout(t);
  }, [state, redirect]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      background: '#0F1A1A',
      color: '#F4F1EA',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        maxWidth: 420,
        textAlign: 'center',
        padding: '32px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">
          {state === STATE_ACCEPTED ? '🌱' : state === STATE_FAILED ? '🌾' : '⏳'}
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>
          {state === STATE_ACCEPTED
            ? 'Welcome to Farroway'
            : state === STATE_FAILED
              ? 'Invite link not valid'
              : 'Activating your account…'}
        </h1>
        <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.5 }}>
          {state === STATE_ACCEPTED
            ? 'Your account is now active. Redirecting to your home screen…'
            : state === STATE_FAILED
              ? 'This invite link is no longer valid. Ask your administrator to resend.'
              : 'Just a moment while we set up your account.'}
        </p>
        {state === STATE_FAILED && (
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 20,
              padding: '10px 20px',
              borderRadius: 10,
              background: '#C8944D',
              color: '#0F1A1A',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to Farroway
          </a>
        )}
      </div>
    </div>
  );
}
