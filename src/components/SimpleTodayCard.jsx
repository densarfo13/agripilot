/**
 * SimpleTodayCard — No-Reading-Required Today render.
 *
 *   <SimpleTodayCard
 *     taskId="prepare_rows"
 *     onListen={...}
 *     onDone={...}
 *     busy={busy}
 *     riskKind="pest"   // optional, "pest" | "drought" | null
 *   />
 *
 * Layout
 *   ┌──────────────────────────┐
 *   │       [huge icon]        │
 *   │         Today            │
 *   │  Short task phrase       │
 *   │  [⚠ risk icon if any]    │
 *   │ ┌───────────────────────┐│
 *   │ │   🔊  Listen          ││
 *   │ ├───────────────────────┤│
 *   │ │   ✅  Done             ││
 *   │ └───────────────────────┘│
 *   └──────────────────────────┘
 *
 * Strict-rule audit
 *   * Huge task icon (5rem) + bold short phrase only — no
 *     instruction / timing / risk paragraphs. The voice channel
 *     carries the detail.
 *   * Two big buttons (≥ 60px tall, full-width) so a low-
 *     literacy farmer hits them without zooming.
 *   * Risk indicator is a SINGLE icon (🐛 / 🌵) — no risk text
 *     in Simple Mode. RiskBadge still renders separately on
 *     Today.jsx with full text + voice for accessibility tools.
 *   * Every visible string routes through tSafe with a calibrated
 *     English fallback.
 *   * Standalone — Today.jsx renders SimpleTodayCard XOR the
 *     standard MainTaskCard, never both. No duplicate task UI.
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { getTaskIcon, getRiskIcon, getActionIcon } from '../ux/iconDictionary.js';

export default function SimpleTodayCard({
  taskId    = 'check_farm',
  taskText  = '',
  onListen  = null,
  onDone    = null,
  busy      = false,
  riskKind  = null,
}) {
  const taskIcon  = getTaskIcon(taskId);
  const showRisk  = riskKind === 'pest' || riskKind === 'drought';
  const riskIcon  = showRisk ? getRiskIcon(riskKind) : null;

  // Visible task text. Caller passes the resolved string (already
  // through tSafe / voiceScripts); a missing value falls back to
  // the calm default.
  const phrase = taskText
    || tSafe('simple.checkFarm', 'Check farm');

  const listenIcon = getActionIcon('listen');
  const doneIcon   = getActionIcon('done');

  return (
    <section
      style={S.card}
      data-testid="simple-today-card"
      aria-label={tSafe('simple.today', 'Today')}
    >
      <div style={S.iconWrap} aria-hidden="true">
        <span style={S.icon}>{taskIcon}</span>
      </div>

      <div style={S.kicker}>
        {tSafe('simple.today', 'Today')}
      </div>

      <h1 style={S.phrase} data-testid="simple-today-phrase">
        {phrase}
      </h1>

      {showRisk && (
        <div
          style={S.riskRow}
          aria-label={tSafe(
            riskKind === 'pest' ? 'today.risk.pestHigh' : 'today.risk.droughtHigh',
            riskKind === 'pest' ? 'Pest risk: HIGH' : 'Drought risk: HIGH',
          )}
          data-testid="simple-today-risk"
        >
          <span style={S.riskIcon} aria-hidden="true">{riskIcon}</span>
        </div>
      )}

      <div style={S.actions}>
        <button
          type="button"
          onClick={onListen}
          style={S.listenBtn}
          disabled={busy}
          aria-label={tSafe('simple.listen', 'Listen')}
          data-testid="simple-today-listen"
        >
          <span style={S.btnIcon} aria-hidden="true">{listenIcon}</span>
          <span style={S.btnLabel}>
            {tSafe('simple.listen', 'Listen')}
          </span>
        </button>

        <button
          type="button"
          onClick={onDone}
          style={{ ...S.doneBtn, ...(busy ? S.btnBusy : null) }}
          disabled={busy}
          aria-label={tSafe('simple.done', 'Done')}
          data-testid="simple-today-done"
        >
          <span style={S.btnIcon} aria-hidden="true">{doneIcon}</span>
          <span style={S.btnLabel}>
            {tSafe('simple.done', 'Done')}
          </span>
        </button>
      </div>
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: '20px',
    padding: '1.75rem 1.25rem 1.5rem',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  iconWrap: {
    width: '5rem',
    height: '5rem',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: '3rem',
    lineHeight: 1,
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
  },
  phrase: {
    margin: 0,
    fontSize: '1.625rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.2,
    textAlign: 'center',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  riskRow: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    background: 'rgba(245,158,11,0.18)',
    border: '1px solid rgba(245,158,11,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.25rem',
  },
  riskIcon: {
    fontSize: '1.625rem',
    lineHeight: 1,
  },
  actions: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    marginTop: '0.5rem',
  },
  listenBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    width: '100%',
    minHeight: '64px',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.10)',
    color: '#EAF2FF',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  doneBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    width: '100%',
    minHeight: '64px',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.18)',
    WebkitTapHighlightColor: 'transparent',
  },
  btnBusy: { opacity: 0.7, cursor: 'wait' },
  btnIcon: { fontSize: '1.5rem', lineHeight: 1 },
  btnLabel: { letterSpacing: '0.01em' },
};
