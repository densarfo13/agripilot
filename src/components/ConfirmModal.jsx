/**
 * ConfirmModal — small two-button confirmation sheet.
 *
 *   <ConfirmModal
 *     open
 *     title="Are you sure you want to logout?"
 *     confirmLabel="Logout"
 *     cancelLabel="Cancel"
 *     destructive={false}
 *     onConfirm={...}
 *     onCancel={...}
 *   />
 *
 * Strict-rule audit
 *   * tSafe friendly: caller supplies pre-resolved strings
 *     (so non-React i18n call sites can pre-translate before
 *     opening the modal)
 *   * lightweight: no portal, no animation library
 *   * accessible: role=dialog + aria-modal + Esc / backdrop
 *     dismissal
 */

import React, { useEffect } from 'react';

export default function ConfirmModal({
  open          = false,
  title         = '',
  body          = '',
  confirmLabel  = 'OK',
  cancelLabel   = 'Cancel',
  destructive   = false,
  onConfirm     = null,
  onCancel      = null,
  testId        = 'confirm-modal',
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && typeof onCancel === 'function') onCancel();
    }
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  function handleBackdrop(e) {
    if (e.target !== e.currentTarget) return;
    if (typeof onCancel === 'function') onCancel();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={S.backdrop}
      onClick={handleBackdrop}
      data-testid={testId}
    >
      <div style={S.sheet}>
        {title && <h2 style={S.title}>{title}</h2>}
        {body  && <p   style={S.body}>{body}</p>}
        <div style={S.actions}>
          <button
            type="button"
            onClick={onCancel}
            style={S.cancelBtn}
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={destructive ? S.destructiveBtn : S.confirmBtn}
            data-testid={`${testId}-confirm`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9090,
    background: 'rgba(8, 20, 35, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  sheet: {
    width: '100%',
    maxWidth: '24rem',
    background: '#0F2034',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '20px',
    padding: '1.25rem',
    color: '#EAF2FF',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  body: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  cancelBtn: {
    flex: 1,
    minHeight: '48px',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  confirmBtn: {
    flex: 1,
    minHeight: '48px',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.18)',
    WebkitTapHighlightColor: 'transparent',
  },
  destructiveBtn: {
    flex: 1,
    minHeight: '48px',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: 'none',
    background: '#EF4444',
    color: '#FFFFFF',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(239,68,68,0.25)',
    WebkitTapHighlightColor: 'transparent',
  },
};
