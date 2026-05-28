/**
 * NeedsReviewActions.jsx — RC1 honest-fallback action row for
 * scan results that are uncertain.
 *
 *   <NeedsReviewActions
 *     onTakeAnother={() => {/* ScanRuntime capture *\/}}
 *     onChoosePhoto={() => {/* ScanRuntime picker *\/}}
 *     onSaveForReview={() => {/* persistence bridge *\/}}
 *   />
 *
 * What this is
 * ────────────
 *   When ScanRuntime returns a result with status `needs_review`
 *   or `low_confidence`, the ScanResultCard renders this row of
 *   three actions. Every handler is caller-controlled — this
 *   component does NOT call any API, ScanRuntime method, or
 *   persistence bridge directly; the parent wires the runtime.
 *
 * Strict-rule audit
 *   • Pure renderer. SSR-safe.
 *   • No ScanRuntime / persistence imports here — caller-controlled.
 *   • Localized via tSafe with sensible English defaults.
 *   • Optional follow-up notification scheduling is deferred to the
 *     parent (which has the recId + runtime references).
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const STYLES = {
  card: {
    background:    '#FFF9F0',
    border:        '1px solid rgba(200,148,77,0.30)',
    borderRadius:  14,
    padding:       '18px 18px',
    margin:        '12px 0',
  },
  title: {
    margin:        0,
    fontSize:      16,
    fontWeight:    700,
    color:         '#1F2933',
    marginBottom:  6,
  },
  body: {
    margin:        0,
    fontSize:      14,
    lineHeight:    1.5,
    color:         '#475569',
    marginBottom:  14,
  },
  row: {
    display:       'flex',
    gap:           8,
    flexWrap:      'wrap',
  },
  btnPrimary: {
    appearance:    'none',
    border:        'none',
    background:    '#C8944D',
    color:         '#FFFFFF',
    fontWeight:    600,
    padding:       '10px 14px',
    borderRadius:  10,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
  btnSecondary: {
    appearance:    'none',
    border:        '1px solid rgba(31,41,51,0.18)',
    background:    'transparent',
    color:         '#1F2933',
    fontWeight:    600,
    padding:       '10px 14px',
    borderRadius:  10,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
};

const _isFn = (v) => typeof v === 'function';

export default function NeedsReviewActions({
  onTakeAnother,
  onChoosePhoto,
  onSaveForReview,
}) {
  return (
    <section
      style={STYLES.card}
      data-testid="needs-review-actions"
      role="region"
      aria-label={tSafe('rc1.scan.needsReview.title', 'Result needs another look')}
    >
      <h3 style={STYLES.title}>
        {tSafe('rc1.scan.needsReview.title', 'Result needs another look')}
      </h3>
      <p style={STYLES.body}>
        {tSafe(
          'rc1.scan.needsReview.body',
          'We could not confirm this clearly from the photo. '
          + 'Take another clear photo of the affected leaf or crop area.',
        )}
      </p>
      <div style={STYLES.row}>
        {_isFn(onTakeAnother) && (
          <button
            type="button"
            style={STYLES.btnPrimary}
            onClick={onTakeAnother}
            data-testid="needs-review-take-another"
          >
            {tSafe('rc1.scan.needsReview.takeAnother', 'Take another photo')}
          </button>
        )}
        {_isFn(onChoosePhoto) && (
          <button
            type="button"
            style={STYLES.btnSecondary}
            onClick={onChoosePhoto}
            data-testid="needs-review-choose-photo"
          >
            {tSafe('rc1.scan.needsReview.choosePhoto', 'Choose photo')}
          </button>
        )}
        {_isFn(onSaveForReview) && (
          <button
            type="button"
            style={STYLES.btnSecondary}
            onClick={onSaveForReview}
            data-testid="needs-review-save-for-review"
          >
            {tSafe('rc1.scan.needsReview.saveForReview', 'Save for review')}
          </button>
        )}
      </div>
    </section>
  );
}
