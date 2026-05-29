/**
 * src/runtime/consent/ConsentPrompt.jsx — Consent UI surface.
 *
 * Calm modal that explains a single consent ask + records the
 * decision through the consent runtime. Mounted lazily by
 * callers that need to gate a feature on a fresh user choice.
 *
 * Strict-rule audit
 *   - Pure React. No fetch. Reads through the runtime barrel.
 *   - Default branch (unknown type) renders nothing — fail-closed
 *     visually: no prompt, no implicit allow.
 */

import React, { useCallback } from 'react';
import {
  CONSENT_TYPES,
} from './consentContracts';
import { persistConsent } from './ConsentStore';

const LABELS = Object.freeze({
  collect_photos:        'Save scan photos on this device',
  collect_location:      'Use your location for advice',
  collect_diagnostics:   'Send anonymous diagnostic data',
  collect_usage:         'Share anonymous usage stats',
  share_for_review:      'Share data with reviewers',
  export_data:           'Allow exporting your data',
  delete_account:        'Allow account deletion',
  receive_notifications: 'Receive notifications',
});

/**
 * ConsentPrompt — single-question modal.
 *
 * Props
 *   - type:    consent type (must be a member of CONSENT_TYPES)
 *   - userId:  the user the decision is recorded for
 *   - source:  optional CONSENT_SOURCES value, defaults to
 *              'in_context_prompt'
 *   - onClose: (granted: boolean) => void — fires after persist
 */
export default function ConsentPrompt({
  type,
  userId,
  source = 'in_context_prompt',
  onClose,
}) {
  const known = CONSENT_TYPES.includes(type);
  const label = known ? LABELS[type] || type : null;

  const decide = useCallback(
    (granted) => {
      if (!known || !userId) {
        // fail-closed: never persist for unknown types.
        if (onClose) onClose(false);
        return;
      }
      try {
        persistConsent({ userId, type, granted, source });
      } catch {
        /* swallow — UI side; runtime handles errors */
      }
      if (onClose) onClose(granted === true);
    },
    [known, userId, type, source, onClose],
  );

  if (!known) {
    // Default branch: render nothing for unknown consent types
    // so we never surface an implicit "allow" path.
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consent prompt"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 41, 51, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#F6F1E7',
          color: '#1F2933',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          maxWidth: '24rem',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
          {label}
        </h2>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9375rem' }}>
          You can change this any time in Settings.
        </p>
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={() => decide(false)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(36,49,58,0.18)',
              background: 'transparent',
              color: '#1F2933',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#C8944D',
              color: '#1F2933',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
