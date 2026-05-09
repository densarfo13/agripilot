/**
 * MemoryMomentLine — single calm line that surfaces a small,
 * helpful moment from the user's growing journey.
 *
 *   <MemoryMomentLine ctx={{ mode, weather, recentScan, streak }} />
 *
 * Spec contract (May 2026 refinement §4 "Emotional continuity")
 *   * One line, no card, no chrome.
 *   * Self-suppresses when no signal qualifies.
 *   * Reads from the page's existing context — no new fetches.
 *   * Localised via tSafe; English fallbacks ship inline.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * Returns null when resolveMemoryMoment returns null —
 *     consumers don't need a guard.
 *   * Inline styles only.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { resolveMemoryMoment } from '../../lib/memoryMoment.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

export default function MemoryMomentLine({
  ctx,
  testId = 'home-memory-moment',
}) {
  let moment = null;
  try { moment = resolveMemoryMoment(ctx || {}); }
  catch { moment = null; }
  if (!moment) return null;

  const text = tSafe(moment.key, moment.fallback);
  if (!text) return null;

  return (
    <p style={S.line} data-testid={testId} data-moment-key={moment.key}>
      <span aria-hidden="true" style={S.emoji}>{moment.emoji}</span>
      <span>{text}</span>
    </p>
  );
}

const S = {
  line: {
    margin: '0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: T.ochreInk,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    padding: '0.45rem 0.7rem',
    borderRadius: 999,
    alignSelf: 'flex-start',
    lineHeight: 1.4,
  },
  emoji: {
    fontSize: '0.95rem',
    lineHeight: 1,
    flexShrink: 0,
  },
};
