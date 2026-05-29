/**
 * src/components/consent/ConsentPrompt.jsx — Inline consent ask.
 *
 *   A calm, two-button card the app surfaces when an action
 *   requires explicit consent (photo storage, program
 *   reporting, buyer contact sharing, etc). Plain language
 *   only — no legalese, no scary modal.
 *
 * What this is
 * ────────────
 *   Drop-in component called from any page that wants to
 *   gate an action behind a recorded consent decision. On
 *   "Allow", it appends a granted record through the consent
 *   runtime and calls onGrant. On "Not now", it does NOT
 *   write a denial (the user is just deferring) and calls
 *   onDeny.
 *
 *   Source is fixed to "in_context_prompt" — this surface is
 *   the in-context ask, distinct from the onboarding bundle
 *   and the settings page list.
 *
 * Strict-rule audit
 *   • All copy via tSafe.
 *   • Pure render; no fetch, no localStorage.
 *   • Runtime call is wrapped in try/catch; UI never crashes
 *     if the registry rejects the input.
 *   • Aesthetic matches OrgLoginPage.jsx — same palette,
 *     same card / button language.
 */

import React, { useCallback, useMemo } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import {
  upsertConsent, CONSENT_TYPES,
} from '../../runtime/consent/index';

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '20px 18px',
    marginBottom: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1F2933',
    maxWidth: 440,
    boxSizing: 'border-box',
  },
  title: {
    fontSize: 16, fontWeight: 800, margin: '0 0 6px',
  },
  body: {
    fontSize: 13, color: '#475569',
    lineHeight: 1.55, margin: '0 0 16px',
  },
  row: {
    display: 'flex', gap: 10, flexWrap: 'wrap',
  },
  allow: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '10px 14px', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', flex: '1 1 140px',
  },
  deny: {
    appearance: 'none',
    background: 'transparent', color: '#475569',
    border: '1px solid rgba(31,41,51,0.18)',
    padding: '10px 14px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', flex: '1 1 140px',
  },
  hint: {
    fontSize: 11, color: '#64748B',
    marginTop: 12, lineHeight: 1.5,
  },
};

/**
 * Default plain-language copy keyed by consent type. Callers
 * can pass the `copy` prop to override per surface.
 */
const DEFAULT_COPY = {
  demographics_collection: {
    titleKey: 'consent.demographics.title',
    titleFb:  'Share basic demographics?',
    bodyKey:  'consent.demographics.body',
    bodyFb:
      'Helps your program report on who they support. '
      + 'You can keep this off and still use Farroway.',
  },
  program_reporting: {
    titleKey: 'consent.programReporting.title',
    titleFb:  'Share progress with your program?',
    bodyKey:  'consent.programReporting.body',
    bodyFb:
      'Your NGO or co-op only sees the activity you choose '
      + 'to share. Off by default.',
  },
  evidence_photo_sharing: {
    titleKey: 'consent.evidencePhoto.title',
    titleFb:  'Share this photo with your program?',
    bodyKey:  'consent.evidencePhoto.body',
    bodyFb:
      'The photo stays private to you unless you allow it '
      + 'to be shared as evidence of work done.',
  },
  location_use: {
    titleKey: 'consent.location.title',
    titleFb:  'Use your location?',
    bodyKey:  'consent.location.body',
    bodyFb:
      'We use a rough area, not your exact spot, to give '
      + 'you better weather and crop advice.',
  },
  scan_photo_use: {
    titleKey: 'consent.scanPhoto.title',
    titleFb:  'Save this scan photo?',
    bodyKey:  'consent.scanPhoto.body',
    bodyFb:
      'Saving the photo helps Farroway learn over time. '
      + 'Say no and we still give you the result.',
  },
  buyer_contact_sharing: {
    titleKey: 'consent.buyerContact.title',
    titleFb:  'Let buyers contact you?',
    bodyKey:  'consent.buyerContact.body',
    bodyFb:
      'A buyer can only see your contact details when '
      + 'you choose to share them.',
  },
  analytics_diagnostics: {
    titleKey: 'consent.diagnostics.title',
    titleFb:  'Send anonymous diagnostics?',
    bodyKey:  'consent.diagnostics.body',
    bodyFb:
      'Helps us fix bugs faster. Never includes your '
      + 'name, phone, or photos.',
  },
  notifications: {
    titleKey: 'consent.notifications.title',
    titleFb:  'Turn on notifications?',
    bodyKey:  'consent.notifications.body',
    bodyFb:
      'Useful for weather alerts and program reminders. '
      + 'You can turn this off anytime.',
  },
};

export default function ConsentPrompt(props) {
  const {
    type, userId, onGrant, onDeny, copy,
  } = props || {};

  const isKnownType = useMemo(() => (
    typeof type === 'string'
    && CONSENT_TYPES.indexOf(type) >= 0
  ), [type]);

  const resolved = useMemo(() => {
    const fallback = DEFAULT_COPY[type] || {
      titleKey: 'consent.generic.title',
      titleFb:  'Share this?',
      bodyKey:  'consent.generic.body',
      bodyFb:
        'You can choose to share this or skip — Farroway '
        + 'still works either way.',
    };
    return {
      title: copy && typeof copy.title === 'string' && copy.title
        ? copy.title
        : tSafe(fallback.titleKey, fallback.titleFb),
      body: copy && typeof copy.body === 'string' && copy.body
        ? copy.body
        : tSafe(fallback.bodyKey, fallback.bodyFb),
    };
  }, [type, copy]);

  const allowLabel = tSafe('consent.allow', 'Allow');
  const denyLabel  = tSafe('consent.notNow', 'Not now');
  const hintLabel  = tSafe(
    'consent.changeLater',
    'You can change this in Settings later.',
  );

  const handleAllow = useCallback(() => {
    if (!isKnownType) {
      // Unknown type — surface as a deny so the caller can
      // recover, but never write a bogus consent record.
      if (typeof onDeny === 'function') onDeny();
      return;
    }
    try {
      upsertConsent({
        userId: typeof userId === 'string' ? userId : '',
        type,
        granted: true,
        source: 'in_context_prompt',
      });
    } catch {
      // Registry never throws by contract; this branch is
      // defensive only and intentionally silent.
    }
    if (typeof onGrant === 'function') onGrant();
  }, [isKnownType, type, userId, onGrant, onDeny]);

  const handleDeny = useCallback(() => {
    // "Not now" is a defer, not a revoke — we do not append
    // a denial record from this surface. Revocation flows
    // through the Settings page.
    if (typeof onDeny === 'function') onDeny();
  }, [onDeny]);

  return (
    <div style={S.card} data-testid="consent-prompt">
      <div style={S.title}>{resolved.title}</div>
      <div style={S.body}>{resolved.body}</div>
      <div style={S.row}>
        <button
          type="button"
          style={S.allow}
          onClick={handleAllow}
          data-testid="consent-grant"
        >
          {allowLabel}
        </button>
        <button
          type="button"
          style={S.deny}
          onClick={handleDeny}
          data-testid="consent-deny"
        >
          {denyLabel}
        </button>
      </div>
      <div style={S.hint}>{hintLabel}</div>
    </div>
  );
}
