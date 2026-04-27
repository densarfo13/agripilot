/**
 * LabelPromptModal — non-intrusive bottom-sheet that asks ONE
 * question with three big icon buttons.
 *
 *   <LabelPromptModal
 *     open
 *     kind="pest"            // or "drought"
 *     farmId={...}
 *     onClose={() => ...}
 *     onSaved={(label) => ...}
 *   />
 *
 * Spec section 8 ("UX rules"):
 *   * Asked AFTER an action, never before.
 *   * Max 1 question per visit. (Either pest OR drought, picked
 *     by the caller.)
 *   * Skip button always available.
 *   * No typing required.
 *
 * Strict-rule audit
 *   * works offline (saveLabel is local-first)
 *   * never throws (saveLabel coerces + drops invalid input)
 *   * tSafe + icon-first; no language leak
 *   * dismissable by escape, backdrop tap, or skip button
 */

import React, { useEffect } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import {
  saveLabel, markPromptedToday,
  LABEL_KIND, LABEL_VALUE, CONFIDENCE,
} from '../../data/labels.js';

const PEST_OPTIONS = [
  { id: LABEL_VALUE.PEST_YES, icon: '\uD83D\uDC1B', tone: 'danger',  key: 'label.pest.yes',    fb: 'Yes'      },
  { id: LABEL_VALUE.PEST_NO,  icon: '\u2705',       tone: 'success', key: 'label.pest.no',     fb: 'No'       },
  { id: LABEL_VALUE.UNKNOWN,  icon: '\u2754',       tone: 'neutral', key: 'label.pest.unsure', fb: 'Not sure' },
];

const DROUGHT_OPTIONS = [
  { id: LABEL_VALUE.DROUGHT_YES, icon: '\uD83C\uDF35', tone: 'danger',  key: 'label.drought.yes', fb: 'Yes' },
  { id: LABEL_VALUE.DROUGHT_NO,  icon: '\uD83C\uDF31', tone: 'success', key: 'label.drought.no',  fb: 'No'  },
];

export default function LabelPromptModal({
  open    = false,
  kind    = LABEL_KIND.PEST,
  farmId  = null,
  onClose = null,
  onSaved = null,
  extra   = null,         // { weather, risk, farmState } passthrough to saveLabel
}) {
  // Esc closes the sheet.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === 'Escape' && typeof onClose === 'function') onClose(); }
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (!farmId) return null;

  const isPest = kind === LABEL_KIND.PEST;
  const options    = isPest ? PEST_OPTIONS : DROUGHT_OPTIONS;
  const titleKey   = isPest ? 'label.pest.question'    : 'label.drought.question';
  const titleFb    = isPest ? 'Did you see pests?'     : 'Are your crops drying?';

  function handlePick(option) {
    try {
      const record = saveLabel({
        farmId,
        kind,
        value:      option.id,
        confidence: option.id === LABEL_VALUE.UNKNOWN ? CONFIDENCE.LOW : CONFIDENCE.MEDIUM,
        source:     'farmer_prompt',
        extra,
      });
      try { markPromptedToday(farmId); } catch { /* ignore */ }
      if (typeof onSaved === 'function') {
        try { onSaved(record); } catch { /* never propagate */ }
      }
    } catch { /* swallow - never block the close */ }
    if (typeof onClose === 'function') onClose();
  }

  function handleSkip() {
    // Stamp the prompt-today ledger even on skip so a farmer who
    // ignored it doesn't get re-prompted on the next task.
    try { markPromptedToday(farmId); } catch { /* ignore */ }
    if (typeof onClose === 'function') onClose();
  }

  return (
    <div role="dialog" aria-modal="true" style={S.backdrop} onClick={handleSkip}
         data-testid="label-prompt-modal">
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.h2}>{tSafe(titleKey, titleFb)}</h2>
        <div style={S.row}>
          {options.map((opt) => (
            <button key={opt.id} type="button"
              onClick={() => handlePick(opt)}
              style={{ ...S.opt, ...S[`opt_${opt.tone}`] }}
              data-testid={`label-opt-${opt.id}`}
            >
              <span style={S.optIcon} aria-hidden="true">{opt.icon}</span>
              <span style={S.optLabel}>{tSafe(opt.key, opt.fb)}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={handleSkip} style={S.skip}
          data-testid="label-skip">
          {tSafe('label.skip', 'Skip')}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9050,
    background: 'rgba(8, 20, 35, 0.70)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '28rem',
    background: '#0F2034',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    padding: '1.25rem 1rem 1.5rem',
    color: '#EAF2FF',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
  },
  h2: { margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#F8FAFC',
        textAlign: 'center', lineHeight: 1.2 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '0.625rem' },
  opt: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '0.375rem', minHeight: '88px',
    padding: '0.875rem 0.5rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', cursor: 'pointer',
    fontSize: '0.9375rem', fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  opt_success: {
    background: 'rgba(34,197,94,0.16)',
    borderColor: 'rgba(34,197,94,0.55)',
    color: '#DCFCE7',
  },
  opt_danger: {
    background: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(248,113,113,0.55)',
    color: '#FCA5A5',
  },
  opt_neutral: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.85)',
  },
  optIcon:  { fontSize: '1.75rem', lineHeight: 1 },
  optLabel: { textAlign: 'center' },
  skip: {
    alignSelf: 'center',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.5rem 1rem',
    minHeight: '40px',
  },
};
