/**
 * SoilScanResultCard — confidence-safe soil scan v1 result.
 *
 *   <SoilScanResultCard
 *     imageUrl={dataUrl}
 *     result={{ status, confidence, whatNoticedKey, … }}
 *     onAddTask={() => …}
 *     onRetake={() => …}
 *   />
 *
 * Spec contract (May 2026 Soil Scan v1)
 *   • soil image preview
 *   • status chip
 *   • confidence: low / medium / high
 *   • what we noticed
 *   • what to check next
 *   • suggested action
 *   • add task button
 *   • disclaimer at bottom
 *   • safe wording only ("possible / looks like / may indicate /
 *     check / monitor")
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. Soft Ochre tokens.
 *   • All visible text via tSafe with English fallbacks.
 */

import React, { useMemo } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import HelpfulToolsCard from '../tools/HelpfulToolsCard.jsx';
import { recommendTools } from '../../intelligence/tools/toolRecommendationEngine.js';

const STATUS_TONE = {
  moist:        { bg: 'rgba(94,142,94,0.12)',   border: 'rgba(94,142,94,0.36)',   ink: '#3F6A3F' },
  dry:          { bg: 'rgba(212,163,95,0.16)',  border: 'rgba(212,163,95,0.42)',  ink: '#7A5A28' },
  waterlogging: { bg: 'rgba(36,49,58,0.10)',    border: 'rgba(36,49,58,0.28)',    ink: '#24313A' },
  cracked:      { bg: 'rgba(224,162,56,0.16)',  border: 'rgba(224,162,56,0.40)',  ink: '#8A5C12' },
  mold:         { bg: 'rgba(209,77,77,0.12)',   border: 'rgba(209,77,77,0.32)',   ink: '#9B2A2A' },
  drainage:     { bg: 'rgba(36,49,58,0.10)',    border: 'rgba(36,49,58,0.28)',    ink: '#24313A' },
  unclear:      { bg: 'rgba(31,41,51,0.06)',    border: 'rgba(31,41,51,0.18)',    ink: '#667085' },
  review:       { bg: 'rgba(31,41,51,0.06)',    border: 'rgba(31,41,51,0.18)',    ink: '#667085' },
};

const STATUS_LABEL = {
  moist:        { key: 'soilScan.status.moist',        fb: 'Looks moist' },
  dry:          { key: 'soilScan.status.dry',          fb: 'Looks dry' },
  waterlogging: { key: 'soilScan.status.waterlogging', fb: 'Possible waterlogging' },
  cracked:      { key: 'soilScan.status.cracked',      fb: 'Cracked soil' },
  mold:         { key: 'soilScan.status.mold',         fb: 'Possible mold or algae' },
  drainage:     { key: 'soilScan.status.drainage',     fb: 'Possible drainage concern' },
  unclear:      { key: 'soilScan.status.unclear',      fb: 'Photo unclear' },
  review:       { key: 'soilScan.status.review',       fb: 'Needs review' },
};

const CONFIDENCE_LABEL = {
  low:    { key: 'soilScan.confidence.low',    fb: 'Low confidence' },
  medium: { key: 'soilScan.confidence.medium', fb: 'Medium confidence' },
  high:   { key: 'soilScan.confidence.high',   fb: 'High confidence' },
};

export default function SoilScanResultCard({
  imageUrl = '',
  result = null,
  onAddTask = null,
  onRetake = null,
  testId = 'soil-scan-result',
}) {
  // Contextual tools — engine call lives at the top of the
  // component so the ≤3 list is memoised against the same
  // status / confidence / mode the result card already
  // consumes. No new fetches; pure local recompute.
  const toolsResult = useMemo(() => {
    if (!result || typeof result !== 'object') return null;
    try {
      return recommendTools({
        mode:          result.mode === 'garden' ? 'garden' : 'farm',
        soilCondition: result.status,
        taskType:      'soil_check',
      });
    } catch { return null; }
  }, [result]);
  const helpfulTools = (toolsResult && toolsResult.tools) || [];

  if (!result || typeof result !== 'object') return null;
  const status = STATUS_TONE[result.status] ? result.status : 'review';
  const tone   = STATUS_TONE[status];
  const statusLabel = STATUS_LABEL[status];
  const confidence  = (result.confidence === 'high' || result.confidence === 'medium')
    ? result.confidence : 'low';
  const confLabel = CONFIDENCE_LABEL[confidence];

  return (
    <section style={S.card} data-testid={testId} data-status={status}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={S.preview}
          loading="lazy"
          decoding="async"
          data-testid="soil-scan-result-image"
        />
      ) : null}

      <div style={S.chipRow}>
        <span
          style={{
            ...S.statusChip,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.ink,
          }}
          data-testid="soil-scan-status-chip"
        >
          {tSafe(statusLabel.key, statusLabel.fb)}
        </span>
        <span style={S.confidenceChip} data-testid="soil-scan-confidence-chip">
          {tSafe(confLabel.key, confLabel.fb)}
        </span>
      </div>

      <div style={S.section}>
        <p style={S.sectionLabel}>
          {tSafe('soilScan.label.noticed', 'What we noticed')}
        </p>
        <p style={S.sectionBody}>
          {tSafe(result.whatNoticedKey, result.whatNoticedFb)}
        </p>
      </div>

      <div style={S.section}>
        <p style={S.sectionLabel}>
          {tSafe('soilScan.label.checkNext', 'What to check next')}
        </p>
        <p style={S.sectionBody}>
          {tSafe(result.whatToCheckKey, result.whatToCheckFb)}
        </p>
      </div>

      <div style={S.section}>
        <p style={S.sectionLabel}>
          {tSafe('soilScan.label.suggested', 'Suggested action')}
        </p>
        <p style={S.sectionBody}>
          {tSafe(result.suggestedActionKey, result.suggestedActionFb)}
        </p>
      </div>

      {/* Helpful tools — contextual ≤3 suggestions (May 2026
          contextual-tools spec §3). Self-suppresses when the
          engine returns nothing. Reads soilCondition from the
          existing result envelope so no new caller wiring is
          needed. */}
      {helpfulTools.length > 0 ? (
        <HelpfulToolsCard
          tools={helpfulTools}
          mode={result.mode === 'garden' ? 'garden' : 'farm'}
          testId="soil-scan-helpful-tools"
        />
      ) : null}

      <div style={S.actions}>
        {typeof onAddTask === 'function' ? (
          <button
            type="button"
            onClick={onAddTask}
            style={S.btnPrimary}
            className="ff-tap"
            data-testid="soil-scan-add-task"
          >
            {tSafe('soilScan.addTask', 'Add task')}
          </button>
        ) : null}
        {typeof onRetake === 'function' ? (
          <button
            type="button"
            onClick={onRetake}
            style={S.btnGhost}
            className="ff-tap"
            data-testid="soil-scan-retake"
          >
            {tSafe('soilScan.retake', 'Take another photo')}
          </button>
        ) : null}
      </div>

      <p style={S.disclaimer}>
        {tSafe(
          'soilScan.disclaimer',
          'Soil photo guidance is visual only. Use a soil test for pH, nutrients, or contamination.',
        )}
      </p>
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '1rem 1rem 1.15rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  preview: {
    width: '100%',
    height: 220,
    objectFit: 'cover',
    borderRadius: 14,
    border: `1px solid ${T.border}`,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.35rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.005em',
    whiteSpace: 'nowrap',
  },
  confidenceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.35rem 0.7rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: T.inkDim,
    background: 'transparent',
    border: `1px solid ${T.border}`,
    textTransform: 'uppercase',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.inkFaint,
  },
  sectionBody: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 600,
    color: T.ink,
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.2rem',
  },
  btnPrimary: {
    flex: '1 1 auto',
    minWidth: 160,
    padding: '0.85rem 1.25rem',
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  btnGhost: {
    flex: '0 0 auto',
    padding: '0.85rem 1.1rem',
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    background: 'transparent',
    color: T.ink,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 46,
    fontFamily: 'inherit',
  },
  disclaimer: {
    margin: '0.4rem 0 0',
    fontSize: '0.75rem',
    color: T.inkFaint,
    lineHeight: 1.45,
  },
};
