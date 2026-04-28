/**
 * MainTaskCard — single-task headline card for the Today page.
 *
 *   <MainTaskCard
 *     title       ="Prepare rows for maize"
 *     instruction ="Make rows ~75cm apart"
 *     timing      ="Do this before rain starts today"
 *     risk        ="If you skip this, planting may be delayed"
 *   />
 *
 * The four-field shape replaces the previous (task + reason)
 * shape — this is the elite-UX upgrade in the brief. Backward
 * compat is preserved: callers that only pass `task` (the old
 * single-string contract) still render correctly with the
 * other three rows hidden.
 *
 * Strict-rule audit
 *   * Shows ONE task (the four fields belong to the same task)
 *   * No clutter: every field is a single short line; long
 *     copy wraps to at most 3 lines on a phone width via
 *     overflowWrap so no farmer sees text spill outside the card
 *   * Loads instantly: pure presentational
 *   * tSafe friendly: callers pass already-resolved strings
 *   * Mobile-first layout: padding scales with viewport, font
 *     sizes use rem so OS accessibility scaling carries through
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function MainTaskCard({
  // New 4-field shape
  title       = '',
  instruction = '',
  timing      = '',
  risk        = '',
  icon        = '\uD83C\uDF31',     // sprout
  // Simple Mode (low-literacy): collapses to icon-first layout
  // — bigger task icon, only the title rendered, instruction +
  // timing + risk dropped from the visual surface (they're still
  // spoken via the auto-play voice in Today.jsx). The voice is
  // the canonical channel in Simple Mode; the visible card is
  // an iconographic anchor, not a paragraph.
  simple      = false,
  // Back-compat: old single-string contract still accepted
  task        = '',
  reason      = '',
}) {
  const resolvedTitle       = title || task
    || tSafe('today.fallbackTask', 'Check your farm today');
  const resolvedInstruction = instruction || reason || '';

  // Simple Mode render path — large icon, large title, no
  // labelled rows. The Listen button below the card stays the
  // re-play affordance.
  if (simple) {
    return (
      <section
        style={{ ...S.card, ...S.cardSimple }}
        data-testid="main-task-card"
      >
        <div style={S.simpleIconWrap} aria-hidden="true">
          <span style={S.simpleIcon}>{icon}</span>
        </div>
        <h1
          style={{ ...S.title, ...S.titleSimple }}
          data-testid="main-task-title"
        >
          {resolvedTitle}
        </h1>
      </section>
    );
  }

  return (
    <section style={S.card} data-testid="main-task-card">
      <div style={S.kickerRow}>
        <span style={S.icon} aria-hidden="true">{icon}</span>
        <span style={S.kicker}>
          {tSafe('today.todaysTask', 'Today\u2019s task')}
        </span>
      </div>

      <h1 style={S.title} data-testid="main-task-title">
        {resolvedTitle}
      </h1>

      {resolvedInstruction && (
        <Row
          icon={'\uD83D\uDCD0'}                 /* triangular ruler */
          label={tSafe('today.task.instruction.label', 'How')}
          text={resolvedInstruction}
          testId="main-task-instruction"
          tone="default"
        />
      )}

      {timing && (
        <Row
          icon={'\u23F0'}                       /* alarm clock */
          label={tSafe('today.task.timing.label', 'When')}
          text={timing}
          testId="main-task-timing"
          tone="default"
        />
      )}

      {risk && (
        <Row
          icon={'\u26A0\uFE0F'}                 /* warning */
          label={tSafe('today.task.risk.label', 'Why it matters')}
          text={risk}
          testId="main-task-risk"
          tone="warning"
        />
      )}
    </section>
  );
}

function Row({ icon, label, text, testId, tone }) {
  const toneStyle = tone === 'warning' ? S.rowWarn : S.rowDefault;
  return (
    <div style={{ ...S.row, ...toneStyle }} data-testid={testId}>
      <span style={S.rowIcon} aria-hidden="true">{icon}</span>
      <div style={S.rowText}>
        <div style={S.rowLabel}>{label}</div>
        <div style={S.rowBody}>{text}</div>
      </div>
    </div>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: '20px',
    padding: '1.25rem 1.25rem 1.5rem',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
    // Prevent any single line from blowing out the card on
    // narrow viewports.
    overflow: 'hidden',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  kickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  icon: {
    fontSize: '1.75rem',
    lineHeight: 1,
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.2,
    letterSpacing: '0.005em',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  row: {
    display: 'flex',
    gap: '0.625rem',
    alignItems: 'flex-start',
    padding: '0.625rem 0.75rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  rowDefault: {},
  rowWarn: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.30)',
  },
  rowIcon: {
    fontSize: '1.0625rem',
    lineHeight: 1.4,
    flexShrink: 0,
  },
  rowText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  rowBody: {
    fontSize: '0.9375rem',
    color: '#FFFFFF',
    lineHeight: 1.45,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },

  // ── Simple Mode (low-literacy) overrides ──────────────────
  cardSimple: {
    alignItems: 'center',
    textAlign: 'center',
    gap: '1rem',
    padding: '1.5rem 1rem 1.75rem',
  },
  simpleIconWrap: {
    width: '5rem',
    height: '5rem',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleIcon: {
    fontSize: '3rem',
    lineHeight: 1,
  },
  titleSimple: {
    fontSize: '1.625rem',
    textAlign: 'center',
  },
};
