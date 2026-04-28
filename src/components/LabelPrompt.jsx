/**
 * LabelPrompt — single-question post-task labeling modal.
 *
 *   <LabelPrompt
 *     open
 *     farmId={...}
 *     taskType={...}
 *     onClose={...}
 *     onSaved={(saved) => ...}
 *   />
 *
 * The previous-turn LabelPromptModal asked one kind at a time
 * (pest OR drought) and alternated by day. This component is
 * the spec's tighter design:
 *
 *     "Did you see any problem?"
 *     [🐛 Pests] [🌵 Dry crops] [✅ No problem] [❓ Not sure]
 *     [📸 Add photo]
 *     Skip
 *
 * One question, four big icon buttons, an optional photo, and a
 * Skip. Auto-closes ~1.2s after a selection so the farmer never
 * waits more than ~3s total per the strict rule.
 *
 * Strict-rule audit
 *   * fast (<3s): single click + auto-close = ~1.2s
 *   * no typing
 *   * icons + minimal text
 *   * skippable (Skip / backdrop / Esc)
 *   * doesn't break task flow: rendered AFTER markTaskDone in
 *     TodayCard; failures are swallowed
 *   * multi-language: every label routed through tSafe
 *   * works offline: saveLabel + compressImageFile are local
 */

import React, { useEffect, useState } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { speak } from '../core/farroway/voice.js';
import {
  saveLabel, markPromptedToday,
  LABEL_KIND, LABEL_VALUE, CONFIDENCE,
} from '../data/labels.js';
import { compressImageFile } from '../outbreak/photoCompress.js';

const CHOICES = [
  { id: 'pest',    icon: '\uD83D\uDC1B', tone: 'danger',  key: 'labelPrompt.pest',     fb: 'Pests'      },
  { id: 'drought', icon: '\uD83C\uDF35', tone: 'warning', key: 'labelPrompt.drought',  fb: 'Dry crops'  },
  { id: 'none',    icon: '\u2705',       tone: 'success', key: 'labelPrompt.none',     fb: 'No problem' },
  { id: 'unknown', icon: '\u2754',       tone: 'neutral', key: 'labelPrompt.unknown',  fb: 'Not sure'   },
];

/**
 * Map the spec's 4-button vocabulary onto the underlying labels
 * store. The store schema uses (kind, value) pairs so the
 * trainer can build per-task models cleanly.
 *
 *   pest    -> kind=pest,    value=pest_yes
 *   drought -> kind=drought, value=drought_yes
 *   none    -> TWO labels: pest_no AND drought_no  (the farmer
 *              has explicitly said "neither problem"; both
 *              negatives are useful ground truth)
 *   unknown -> NO label (just stamp the prompt-today ledger so
 *              we don't re-prompt; saving a noisy "unknown"
 *              would poison both training sets)
 */
function _persistChoice({ choice, farmId, taskType, photoUrl }) {
  const baseExtra = {
    farmState: {
      taskType:   taskType || null,
      hasPhoto:   !!photoUrl,
      photoUrl:   photoUrl || null,
    },
  };
  const confidence = photoUrl ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;

  if (choice === 'pest') {
    return [saveLabel({
      farmId, kind: LABEL_KIND.PEST, value: LABEL_VALUE.PEST_YES,
      confidence, source: 'farmer_prompt', extra: baseExtra,
    })];
  }
  if (choice === 'drought') {
    return [saveLabel({
      farmId, kind: LABEL_KIND.DROUGHT, value: LABEL_VALUE.DROUGHT_YES,
      confidence, source: 'farmer_prompt', extra: baseExtra,
    })];
  }
  if (choice === 'none') {
    // Save BOTH negatives - the farmer told us no pest AND no
    // drought, which is the most valuable training row.
    return [
      saveLabel({
        farmId, kind: LABEL_KIND.PEST, value: LABEL_VALUE.PEST_NO,
        confidence, source: 'farmer_prompt', extra: baseExtra,
      }),
      saveLabel({
        farmId, kind: LABEL_KIND.DROUGHT, value: LABEL_VALUE.DROUGHT_NO,
        confidence, source: 'farmer_prompt', extra: baseExtra,
      }),
    ];
  }
  // 'unknown' - intentionally save nothing.
  return [];
}

export default function LabelPrompt({
  open      = false,
  farmId    = null,
  taskType  = null,
  onClose   = null,
  onSaved   = null,
  // Simple Mode (low-literacy): collapses options to icon-only
  // and speaks the question on open. Caller (Today.jsx) reads
  // isSimpleMode from settingsStore and passes it through.
  simple    = false,
}) {
  const [busy, setBusy]         = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === 'Escape' && typeof onClose === 'function') onClose(); }
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Reset state when the modal closes so the next open starts
  // clean.
  useEffect(() => {
    if (!open) {
      setBusy(false);
      setPhotoUrl(null);
      setConfirmed(false);
    }
  }, [open]);

  // Simple Mode: speak the question on open so a non-reading
  // farmer hears the prompt without tapping anything. Wraps in
  // try/catch so a browser without speechSynthesis silently
  // shows the visual prompt (per the spec's fallback rule:
  // "If voice fails -> show text").
  useEffect(() => {
    if (!open) return;
    if (!simple) return;
    const q = tSafe('labelPrompt.question', 'Did you see any problem?');
    try { speak(q); } catch { /* swallow */ }
  }, [open, simple]);

  if (!open) return null;
  if (!farmId) return null;

  async function handlePhoto(e) {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const url = await compressImageFile(file);
      setPhotoUrl(url || null);
    } catch { setPhotoUrl(null); }
  }

  function handleSkip() {
    try { markPromptedToday(farmId); } catch { /* ignore */ }
    if (typeof onClose === 'function') onClose();
  }

  function handlePick(choiceId) {
    if (busy) return;
    setBusy(true);
    let saved = [];
    try { saved = _persistChoice({ choice: choiceId, farmId, taskType, photoUrl }); }
    catch { /* swallow - keep flow alive */ }
    try { markPromptedToday(farmId); } catch { /* ignore */ }

    // Voice feedback - spec section 4.
    try {
      const msg = tSafe('labelPrompt.thanks',
        'Thank you. This helps improve your farm advice.');
      speak(msg);
    } catch { /* swallow */ }

    setConfirmed(true);

    if (typeof onSaved === 'function') {
      try { onSaved(saved); }
      catch { /* never propagate */ }
    }

    // Auto-close after the confirmation pulse so the farmer is
    // back in their flow within ~1.2s of tapping.
    setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, 1200);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={S.backdrop}
      onClick={handleSkip}
      data-testid="label-prompt"
    >
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Confirmation overlay - briefly takes over after pick */}
        {confirmed ? (
          <div style={S.confirm} data-testid="label-prompt-confirmed">
            <span style={S.confirmIcon} aria-hidden="true">{'\u2713'}</span>
            <p style={S.confirmText}>
              {tSafe('labelPrompt.thanks',
                'Thank you. This helps improve your farm advice.')}
            </p>
          </div>
        ) : (
          <>
            <h2 style={S.h2}>
              {tSafe('labelPrompt.question', 'Did you see any problem?')}
            </h2>

            <div style={S.grid}>
              {CHOICES.map((c) => {
                const label = tSafe(c.key, c.fb);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePick(c.id)}
                    disabled={busy}
                    style={{
                      ...S.choice,
                      ...S[`choice_${c.tone}`],
                      ...(simple ? S.choiceSimple : null),
                      ...(busy ? S.choiceBusy : null),
                    }}
                    // aria-label always carries the text so screen
                    // readers + voice tests can announce the
                    // option even when the visual label is hidden
                    // in Simple Mode.
                    aria-label={label}
                    title={simple ? label : undefined}
                    data-testid={`label-prompt-${c.id}`}
                  >
                    <span
                      style={{ ...S.choiceIcon, ...(simple ? S.choiceIconSimple : null) }}
                      aria-hidden="true"
                    >
                      {c.icon}
                    </span>
                    {!simple && (
                      <span style={S.choiceLabel}>{label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <label style={{ ...S.photoBtn, ...(photoUrl ? S.photoBtnDone : null) }}>
              <span style={S.photoIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
              <span>{photoUrl
                ? tSafe('labelPrompt.photoAdded', 'Photo added')
                : tSafe('labelPrompt.addPhoto',  'Add photo (optional)')}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                style={{ display: 'none' }}
                data-testid="label-prompt-photo-input"
              />
            </label>

            <button
              type="button"
              onClick={handleSkip}
              style={S.skip}
              data-testid="label-prompt-skip"
            >
              {tSafe('labelPrompt.skip', 'Skip')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9070,
    background: 'rgba(8, 20, 35, 0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '30rem',
    background: '#0F2034',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    padding: '1.25rem 1rem 1.25rem',
    color: '#EAF2FF',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
  },
  h2: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.625rem',
  },
  choice: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    minHeight: '92px',
    padding: '0.875rem 0.5rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  choice_danger: {
    background: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(248,113,113,0.55)',
    color: '#FCA5A5',
  },
  choice_warning: {
    background: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.55)',
    color: '#FCD34D',
  },
  choice_success: {
    background: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.55)',
    color: '#DCFCE7',
  },
  choice_neutral: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.85)',
  },
  choiceBusy: { opacity: 0.7, cursor: 'wait' },
  choiceIcon: { fontSize: '1.875rem', lineHeight: 1 },
  choiceLabel: { textAlign: 'center' },
  // ── Simple Mode (low-literacy) overrides ──────────────────
  // Bigger button + bigger icon, label text dropped from the
  // visual surface so a non-reading farmer can pick by glyph.
  choiceSimple: { minHeight: '88px', padding: '1rem' },
  choiceIconSimple: { fontSize: '2.625rem' },

  photoBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.2)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    background: 'rgba(255,255,255,0.03)',
    minHeight: '44px',
  },
  photoBtnDone: {
    border: '1px solid rgba(34,197,94,0.4)',
    background: 'rgba(34,197,94,0.08)',
    color: '#86EFAC',
  },
  photoIcon: { fontSize: '1.125rem', lineHeight: 1 },

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

  confirm: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.5rem 0.75rem 0.75rem',
  },
  confirmIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.55)',
    color: '#22C55E',
    fontSize: '1.5rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    margin: 0,
    fontSize: '0.9375rem',
    color: '#DCFCE7',
    textAlign: 'center',
    maxWidth: '24rem',
  },
};
