/**
 * FarmManageSheet — calm bottom-sheet that consolidates the
 * legacy Edit / Add / Switch / Upload management actions on
 * My Farm into a single overlay. Opens from FarmSnapshotCard's
 * "Manage farm →" CTA.
 *
 *   <FarmManageSheet
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     mode="farm"
 *     onEdit={…}
 *     onAdd={…}
 *     onUploadPhoto={…}
 *     onSwitchFarm={…}
 *   />
 *
 * Spec contract (May 2026 My Farm refinement §5)
 *   • Reduce visible Edit / Edit Farm / Manage / Upload-photo
 *     actions to ONE primary "Manage farm" CTA.
 *   • Open a sheet with: edit details, upload photo, switch
 *     farms, add farm, archive.
 *   • Cleaner and more premium.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. Soft Ochre tokens only.
 *   • Closes on backdrop tap + Escape key.
 *   • No focus trap library — uses native button focus + Tab.
 *   • All visible text via tSafe with English fallbacks.
 */

import React, { useEffect, useRef } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _editIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="#7A5A28" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <path d="M14 6l4 4" stroke="#7A5A28" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function _photoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2H9z"
            stroke="#7A5A28" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="13" r="3.4" stroke="#7A5A28" strokeWidth="1.6" fill="none"/>
    </svg>
  );
}
function _switchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8h13l-3-3M21 16H8l3 3" stroke="#7A5A28" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
function _addIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="#7A5A28" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

export default function FarmManageSheet({
  open = false,
  mode = 'farm',
  onClose = null,
  onEdit = null,
  onUploadPhoto = null,
  onSwitchFarm = null,
  onAdd = null,
  testId = 'farm-manage-sheet',
}) {
  const isGarden = mode === 'garden';
  const sheetRef = useRef(null);

  // Escape key + body-scroll-lock. Effect runs unconditionally
  // (rules-of-hooks); the inner branches no-op when !open.
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape' && typeof onClose === 'function') {
        try { onClose(); } catch { /* swallow */ }
      }
    }
    try { document.addEventListener('keydown', handleKey); } catch { /* swallow */ }
    let prevOverflow = '';
    try {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } catch { /* swallow */ }
    return () => {
      try { document.removeEventListener('keydown', handleKey); } catch { /* swallow */ }
      try { document.body.style.overflow = prevOverflow; } catch { /* swallow */ }
    };
  }, [open, onClose]);

  // Auto-focus the first interactive item when the sheet opens
  // so keyboard users land on the primary action.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        const first = sheetRef.current && sheetRef.current.querySelector('button[data-action]');
        if (first) first.focus();
      } catch { /* swallow */ }
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const editLabel = isGarden
    ? tSafe('myFarm.editGarden', 'Edit garden')
    : tSafe('myFarm.edit',       'Edit farm');
  const addLabel = isGarden
    ? tSafe('myFarm.addFarm',   'Add farm')
    : tSafe('myFarm.addGarden', 'Add garden');

  const items = [
    onEdit ? {
      key: 'edit', icon: _editIcon, label: editLabel,
      sub: tSafe('farm.manage.editSub', 'Update name, location, crop or stage.'),
      onClick: onEdit,
    } : null,
    onUploadPhoto ? {
      key: 'photo', icon: _photoIcon,
      label: tSafe('myFarm.uploadPhoto', 'Upload photo'),
      sub: tSafe('farm.manage.photoSub', 'Add a real photo of your farm.'),
      onClick: onUploadPhoto,
    } : null,
    onSwitchFarm ? {
      key: 'switch', icon: _switchIcon,
      label: tSafe('farm.manage.switch', 'Switch farm'),
      sub: tSafe('farm.manage.switchSub', 'Choose a different farm to view.'),
      onClick: onSwitchFarm,
    } : null,
    onAdd ? {
      key: 'add', icon: _addIcon, label: addLabel,
      sub: tSafe('farm.manage.addSub', 'Set up another growing space.'),
      onClick: onAdd,
    } : null,
  ].filter(Boolean);

  function handleItem(item) {
    try { item.onClick(); }
    catch { /* swallow */ }
    try { if (typeof onClose === 'function') onClose(); }
    catch { /* swallow */ }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget && typeof onClose === 'function') {
      try { onClose(); } catch { /* swallow */ }
    }
  }

  return (
    <div
      style={S.backdrop}
      onClick={handleBackdrop}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-manage-sheet-title"
    >
      <div ref={sheetRef} style={S.sheet}>
        <div style={S.handle} aria-hidden="true" />

        <h2 id="farm-manage-sheet-title" style={S.title}>
          {tSafe('farm.manageFarm', 'Manage farm')}
        </h2>

        <ul style={S.list}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} style={S.itemWrap}>
                <button
                  type="button"
                  data-action={item.key}
                  onClick={() => handleItem(item)}
                  style={S.item}
                  className="ff-tap"
                >
                  <span style={S.itemIcon} aria-hidden="true"><Icon /></span>
                  <span style={S.itemText}>
                    <span style={S.itemLabel}>{item.label}</span>
                    <span style={S.itemSub}>{item.sub}</span>
                  </span>
                  <span aria-hidden="true" style={S.chev}>{'›'}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => { try { onClose && onClose(); } catch { /* swallow */ } }}
          style={S.cancel}
          className="ff-tap"
          data-testid="farm-manage-sheet-cancel"
        >
          {tSafe('common.close', 'Close')}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(31,41,51,0.45)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'farroway-fade-in 200ms ease-out',
  },
  sheet: {
    width: '100%',
    maxWidth: '36rem',
    background: T.panelHi,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: '0.65rem 1rem 1.4rem',
    boxShadow: '0 -10px 32px rgba(80,60,30,0.32)',
    color: T.ink,
    maxHeight: '88vh',
    overflowY: 'auto',
    animation: 'farroway-slide-up 240ms ease-out',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    background: 'rgba(31,41,51,0.18)',
    margin: '0.4rem auto 0.85rem',
  },
  title: {
    margin: '0 0 0.85rem',
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
    textAlign: 'center',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  itemWrap: {
    listStyle: 'none',
  },
  item: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.85rem 0.95rem',
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    color: T.ink,
    textAlign: 'left',
    minHeight: 60,
    WebkitTapHighlightColor: 'transparent',
  },
  itemIcon: {
    width: 38, height: 38,
    flexShrink: 0,
    borderRadius: 10,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  itemLabel: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: T.ink,
  },
  itemSub: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.35,
  },
  chev: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: T.inkFaint,
    lineHeight: 1,
    flexShrink: 0,
  },
  cancel: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
    marginTop: '0.85rem',
    padding: '0.78rem 1rem',
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    color: T.inkDim,
    fontSize: '0.875rem',
    fontWeight: 700,
    minHeight: 44,
  },
};
