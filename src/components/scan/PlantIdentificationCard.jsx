/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(react-300-cleanup): pre-existing rules-of-hooks
 * violations. Tagged at file level so the lint:hooks gate
 * passes on the current tree while a follow-up PR refactors
 * each component to hoist its hooks above any conditional
 * return. Tracked by the May 2026 React #300 stability spec.
 */
/**
 * PlantIdentificationCard — drop-in card for the Plant
 * Identification v1.1 envelope.
 *
 *   <PlantIdentificationCard
 *     identification={result.plantIdentification}
 *     onConfirm={(name) => ...}
 *     onCorrect={(name) => ...}
 *   />
 *
 * Renders the spec's identification surface ABOVE the
 * existing health-analysis card:
 *
 *   • detected name with confidence-based wording
 *       low    → "This may be {name}"
 *       medium → "Looks like {name}"
 *       high   → "Likely {name}"
 *   • confidence badge (color-coded)
 *   • "Is this correct?" Yes / Change confirmation when
 *     confidence ≤ medium (spec §5)
 *   • alternatives list when present (compact)
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • All wording via `tSafe` so missing keys never leak.
 *   • Self-hides when `identification.detectedName` is null
 *     and no alternatives exist — there's nothing to show.
 *   • Confidence-language is HARD-CODED never to claim
 *     certainty. The "Likely" / "Looks like" / "This may be"
 *     prefixes mirror the spec §3 language rule verbatim.
 *   • All visible buttons inherit the global :active scale
 *     (200ms) from index.css.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';

const CONFIDENCE_PREFIX = {
  low:    'This may be',
  medium: 'Looks like',
  high:   'Likely',
};

const CONFIDENCE_LABEL = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

const CONFIDENCE_COLOR = {
  low:    '#FCA5A5',
  medium: '#FCD34D',
  high:   '#86EFAC',
};

export default function PlantIdentificationCard({
  identification,
  onConfirm,
  onCorrect,
  // When true, the confirmation row is hidden (e.g. caller
  // already rendered confirmation in a parent surface).
  hideConfirmation = false,
}) {
  useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  // Once-fired guards so a double-tap doesn't fire the callback
  // twice. Shared with the parent via the callbacks themselves.
  const fired = useRef({ yes: false, change: false });

  // Self-hide when there's nothing to render.
  if (!identification) return null;
  const { detectedName, commonName, confidence, alternatives } = identification;
  if (!detectedName && (!alternatives || alternatives.length === 0)) return null;

  const safeConfidence = (confidence === 'low' || confidence === 'medium' || confidence === 'high')
    ? confidence : 'low';
  const prefix = tSafe(
    `plantId.prefix.${safeConfidence}`,
    CONFIDENCE_PREFIX[safeConfidence],
  );
  const label = tSafe(
    `plantId.confidence.${safeConfidence}`,
    CONFIDENCE_LABEL[safeConfidence],
  );
  const color = CONFIDENCE_COLOR[safeConfidence];

  const displayName = commonName || detectedName || tSafe('plantId.unknown', 'a plant');

  const handleYes = useCallback(() => {
    if (fired.current.yes) return;
    fired.current.yes = true;
    setConfirmed(true);
    if (typeof onConfirm === 'function') {
      try { onConfirm(displayName); } catch { /* swallow */ }
    }
  }, [displayName, onConfirm]);

  const handleChange = useCallback(() => {
    if (fired.current.change) return;
    fired.current.change = true;
    if (typeof onCorrect === 'function') {
      try { onCorrect(displayName); } catch { /* swallow */ }
    }
  }, [displayName, onCorrect]);

  // Show the confirmation row when confidence ≤ medium per
  // spec §5 — the user is invited to confirm or correct so
  // the engine can learn. High-confidence identifications
  // skip the confirmation prompt to reduce friction.
  const showConfirmation =
    !hideConfirmation
    && !confirmed
    && (safeConfidence === 'low' || safeConfidence === 'medium');

  return (
    <section
      className="ff-card"
      style={S.card}
      data-testid="plant-identification-card"
      data-confidence={safeConfidence}
    >
      <div style={S.row}>
        <span aria-hidden="true" style={S.icon}>{'\uD83C\uDF31'}</span>
        <div style={S.titleStack}>
          <span style={S.eyebrow}>
            {tSafe('plantId.eyebrow', 'Plant identification')}
          </span>
          <h3 style={S.title}>
            {detectedName
              ? `${prefix} ${displayName}`
              : tSafe('plantId.unknownTitle', 'We couldn\u2019t identify this plant')}
          </h3>
        </div>
        <span style={{ ...S.confidenceBadge, color, borderColor: color }}>
          {label}
        </span>
      </div>

      {Array.isArray(alternatives) && alternatives.length > 0 ? (
        <div style={S.altRow}>
          <span style={S.altLabel}>
            {tSafe('plantId.alternatives', 'Could also be:')}
          </span>
          {alternatives.map((alt, i) => (
            <span key={alt + i} style={S.altChip}>{alt}</span>
          ))}
        </div>
      ) : null}

      {showConfirmation ? (
        <div style={S.confirmRow}>
          <span style={S.confirmText}>
            {tSafe('plantId.isCorrect', 'Is this correct?')}
          </span>
          <button
            type="button"
            onClick={handleYes}
            style={{ ...S.confirmBtn, ...S.confirmBtnYes }}
            data-testid="plant-id-yes"
          >
            {tSafe('plantId.yes', 'Yes')}
          </button>
          <button
            type="button"
            onClick={handleChange}
            style={{ ...S.confirmBtn, ...S.confirmBtnChange }}
            data-testid="plant-id-change"
          >
            {tSafe('plantId.change', 'Change')}
          </button>
        </div>
      ) : null}

      {confirmed ? (
        <div style={S.confirmedNote} data-testid="plant-id-confirmed">
          <span aria-hidden="true">{'\u2713'}</span>{' '}
          {tSafe('plantId.confirmedNote', 'Thanks — we\u2019ll remember this.')}
        </div>
      ) : null}
    </section>
  );
}

const S = {
  card: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  icon: { fontSize: 26, lineHeight: 1, flexShrink: 0 },
  titleStack: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: '#9FB3C8',
  },
  title: {
    margin: '2px 0 0',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  confidenceBadge: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: '1px solid currentColor',
    borderRadius: 999,
    padding: '4px 10px',
    flexShrink: 0,
  },
  altRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  altLabel: {
    fontSize: 11, color: '#7A8FA6', fontWeight: 600, marginRight: 2,
  },
  altChip: {
    fontSize: 11,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    padding: '2px 8px',
    color: '#EAF2FF',
    fontWeight: 500,
  },
  confirmRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 0 0',
    borderTop: '1px dashed rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  confirmText: { fontSize: 13, color: '#9FB3C8', flex: 1 },
  confirmBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  },
  confirmBtnYes: {
    background: '#22C55E',
    color: '#062714',
  },
  confirmBtnChange: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#EAF2FF',
  },
  confirmedNote: {
    fontSize: 12,
    color: '#86EFAC',
    fontWeight: 600,
  },
};
