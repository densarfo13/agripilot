/**
 * SettingsDrawer — right-side slide-in panel that consolidates the
 * chrome controls that used to crowd the header.
 *
 * Houses (in order):
 *   • Experience switcher (when the user has more than one)
 *   • Language picker
 *   • Simple ↔ Standard mode toggle
 *   • Auto-voice toggle
 *   • Logout
 *
 * Triggered by a single menu button in ProtectedLayout — the header
 * itself only shows: connectivity chip on the left, notification bell
 * + menu button on the right. This matches the UI tightening spec §5
 * ("Move language/simple/logout into a settings drawer").
 *
 * Strict-rule audit
 *   • Pure presentational. Receives its children + handlers as props
 *     so it never re-implements the existing controls — each child
 *     is the same component the header used to render.
 *   • Escape key + backdrop tap close the drawer.
 *   • Focus is NOT trapped here (the existing controls handle their
 *     own keyboard nav); the drawer just provides the panel chrome.
 *   • SSR-safe — the body-scroll lock only runs when document exists.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tSafe } from '../../i18n/tSafe.js';

export default function SettingsDrawer({
  open,
  onClose,
  title = 'Settings',
  children,
  testId = 'settings-drawer',
}) {
  // ESC key closes the drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev) => { if (ev.key === 'Escape') { try { onClose && onClose(); } catch { /* swallow */ } } };
    try { window.addEventListener('keydown', onKey); } catch { /* swallow */ }
    return () => { try { window.removeEventListener('keydown', onKey); } catch { /* swallow */ } };
  }, [open, onClose]);

  // Body-scroll lock while the drawer is open so the page underneath
  // doesn't bounce on touch devices.
  useEffect(() => {
    if (!open) return undefined;
    try {
      if (typeof document === 'undefined') return undefined;
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { try { document.body.style.overflow = prev; } catch { /* swallow */ } };
    } catch { return undefined; }
  }, [open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={S.backdrop}
      data-testid={`${testId}-backdrop`}
      onClick={(ev) => {
        // Close only on backdrop click — not on panel click.
        if (ev.target === ev.currentTarget) {
          try { onClose && onClose(); } catch { /* swallow */ }
        }
      }}
    >
      <aside
        style={S.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(ev) => ev.stopPropagation()}
      >
        <header style={S.header}>
          <h2 style={S.title}>{title}</h2>
          <button
            type="button"
            onClick={() => { try { onClose && onClose(); } catch { /* swallow */ } }}
            style={S.closeBtn}
            aria-label={tSafe('settings.close', 'Close settings')}
            data-testid={`${testId}-close`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </header>
        <div style={S.body}>{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,28,38,0.42)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'farroway-fade-in 0.18s ease-out',
  },
  panel: {
    width: 'min(20rem, 88vw)',
    height: '100%',
    background: 'linear-gradient(180deg, #0B1A28 0%, #08111A 100%)',
    color: '#EAF2FF',
    boxShadow: '-12px 0 32px rgba(0,0,0,0.45)',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top, 0)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    animation: 'farroway-slide-in-right 0.22s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: '#EAF2FF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    color: '#EAF2FF',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.85rem 1rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
};
