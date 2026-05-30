/**
 * src/pages/Activate.jsx — wave-39 invite-activation route.
 *
 *   Route: /activate?token=<raw-invite-token>
 *
 * Why this exists
 * ───────────────
 * The wave-39 adoption spec mandates a public /activate route as
 * the canonical invite-link landing target. Farroway's full
 * acceptance UI (email + password collection, language picker,
 * pre-fill display) already lives at /accept-invite — battle-
 * tested by the pilot. Rather than duplicate that surface, this
 * route is a thin redirector that:
 *
 *   1. Reads `token` from the URL query string.
 *   2. Attests the route is mounted via
 *      `window.__farrowayActivateRouteMounted = true` so
 *      `__inviteHealth()` can read `activationRouteReady = true`.
 *   3. Replaces history with /accept-invite?token=... so the
 *      browser's back-button doesn't trap users on /activate.
 *   4. Renders a one-line transitional state for the ~50ms before
 *      the redirect resolves.
 *
 * Strict-rule audit
 *   • Pure render — never throws.
 *   • Token is read once + handed to the existing route; NEVER
 *     logged or stored.
 *   • Falls back to a "link not valid" panel + Home button when
 *     no token is present.
 *   • SSR-safe — every window / location read guarded.
 */

import React, { useEffect, useState } from 'react';

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

export default function Activate() {
  const [hasToken, setHasToken] = useState(true);

  useEffect(() => {
    _attestRouteMounted();
    const token = _readTokenFromUrl();
    if (!token) { setHasToken(false); return; }
    try {
      // Replace history so back-button doesn't trap on /activate.
      if (typeof window !== 'undefined') {
        const target = `/accept-invite?token=${encodeURIComponent(token)}`;
        window.location.replace(target);
      }
    } catch { setHasToken(false); }
  }, []);

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
          {hasToken ? '⏳' : '🌾'}
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>
          {hasToken
            ? 'Opening your invitation…'
            : 'Invite link not valid'}
        </h1>
        <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.5 }}>
          {hasToken
            ? 'One moment while we set up your account screen.'
            : 'This invite link is no longer valid. Ask your administrator to resend.'}
        </p>
        {!hasToken && (
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
