/**
 * QuickLanguageModal — minimal language picker for the new
 * QuickStart welcome screen.
 *
 *   <QuickLanguageModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onPick={(code) => ...}      // optional callback
 *   />
 *
 * Tap a row → instantly call setLanguage(code) globally + close.
 * No reload, no save button. The list is intentionally short
 * (English / Twi / Hausa / French) per the spec; the full
 * LanguageSelector still lives in /settings for users who want
 * the wider list.
 *
 * Accessibility:
 *   * `dialog` role + aria-modal so screen readers announce it
 *   * Escape key closes the modal
 *   * Backdrop click closes the modal
 *
 * Strict-rule audit:
 *   * never crashes on missing setLanguage import (try/catch)
 *   * never blocks render - mounted as a portal-less overlay
 */

import React, { useEffect } from 'react';
import { setLanguage } from '../i18n/index.js';
import { setSavedLanguage } from '../utils/onboarding.js';

const LANGS = Object.freeze([
  { code: 'en', label: 'English',    native: 'English'    },
  { code: 'tw', label: 'Twi',        native: 'Twi'        },
  { code: 'ha', label: 'Hausa',      native: 'Hausa'      },
  { code: 'fr', label: 'Français',   native: 'Fran\u00E7ais' },
]);

export default function QuickLanguageModal({ open = false, onClose = null, onPick = null, currentLang = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (typeof onClose === 'function') onClose();
      }
    }
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function pick(code) {
    try { setLanguage(code); }       catch { /* ignore */ }
    try { setSavedLanguage(code); }  catch { /* ignore */ }
    if (typeof onPick === 'function') {
      try { onPick(code); }
      catch { /* never propagate from a click handler */ }
    }
    if (typeof onClose === 'function') onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-language-title"
      style={S.backdrop}
      onClick={onClose}
      data-testid="quick-language-modal"
    >
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 id="quick-language-title" style={S.h2}>Choose language</h2>
        <ul style={S.list}>
          {LANGS.map((l) => {
            const active = l.code === currentLang;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  onClick={() => pick(l.code)}
                  style={{ ...S.btn, ...(active ? S.btnActive : null) }}
                  aria-pressed={active}
                  data-testid={`quick-lang-${l.code}`}
                >
                  <span style={S.btnLabel}>{l.native}</span>
                  {active && <span style={S.tick} aria-hidden="true">{'\u2713'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(8, 20, 35, 0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: '0 0 0 0',
  },
  sheet: {
    width: '100%', maxWidth: '28rem',
    background: '#0F2034',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    padding: '1.25rem 1rem 2rem',
    color: '#EAF2FF',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
  },
  h2: {
    fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 0.75rem',
    color: '#EAF2FF',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  btn: {
    width: '100%',
    padding: '0.875rem 1rem',
    minHeight: '56px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
  btnActive: {
    background: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.5)',
    color: '#DCFCE7',
  },
  btnLabel: { textAlign: 'left' },
  tick: { fontSize: '1.125rem', color: '#22C55E', fontWeight: 800 },
};
