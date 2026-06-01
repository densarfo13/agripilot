/**
 * SimpleActionCard.jsx — the canonical action-first card.
 *
 * Standard layout (§1):
 *   [icon + priority dot]
 *   DO THIS NOW:    <action>           (≤ 12 words)
 *   WHY:            <reason>           (≤ 10 words)
 *   WHEN:           <today / soon>     (≤  4 words)
 *   BUTTONS:        [Done] [secondary] [secondary]
 *   (voice button:  🔊 plays the voicePrompt)
 *
 * Used by SimpleModeHomeSection, the simple Daily Plan, the simple Tasks
 * surface, and the simple Post-Harvest surface. Localized via tSafe; never
 * blocks the page; records SimpleActionShown / SimpleActionCompleted /
 * SimpleActionSkipped / SimpleReminderRequested artifacts.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const PRIORITY_COLORS = Object.freeze({
  red: '#B91C1C', yellow: '#B45309', green: '#15803D', blue: '#1D4ED8',
});
const PRIORITY_LABEL_KEYS = Object.freeze({
  red: 'simple.priority.doNow', yellow: 'simple.priority.doSoon',
  green: 'simple.priority.good', blue: 'simple.priority.scan',
});
const PRIORITY_LABEL_DEFAULTS = Object.freeze({
  red: 'Do now', yellow: 'Do soon', green: 'Good', blue: 'Scan',
});

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _recordArtifact(kind, actionId) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const KEY = 'farroway_simple_mode_artifacts';
    const raw = window.localStorage.getItem(KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    const idempotencyKey = `${kind}:${actionId || 'noid'}:${Date.now()}`;
    list.push({ kind, idempotencyKey, actionId: actionId || null, ts: Date.now() });
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

function _speak(text, lang) {
  return _safe(() => {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return false;
    if (!text || typeof text !== 'string') return false;
    const u = new window.SpeechSynthesisUtterance(text);
    if (lang) u.lang = lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  }, false);
}

export default function SimpleActionCard({
  action,
  onDone,
  onSkip,
  onRemindLater,
  onScan,
  onCallHelper,
  language,
  testId,
}) {
  const [acted, setActed] = React.useState(null);
  // Record SimpleActionShown once per mount for diagnostics.
  React.useEffect(() => {
    if (action && action.id) _recordArtifact('SimpleActionShown', action.id);
  }, [action && action.id]);

  if (!action) return null;
  const priority = action.priority || 'green';
  const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.green;

  const renderAction = action.actionKey
    ? tSafe(action.actionKey, action.actionDefault || '')
    : (action.actionDefault || '');
  const renderReason = action.reasonKey
    ? tSafe(action.reasonKey, action.reasonDefault || '')
    : (action.reasonDefault || '');
  const renderWhen = action.whenKey
    ? tSafe(action.whenKey, action.whenDefault || 'Today')
    : (action.whenDefault || 'Today');
  const voicePrompt = action.voiceKey
    ? tSafe(action.voiceKey, action.voiceDefault || '')
    : (action.voiceDefault || '');

  const handleDone = () => {
    _recordArtifact('SimpleActionCompleted', action.id);
    setActed('done');
    _safe(() => typeof onDone === 'function' && onDone(action), null);
  };
  const handleSkip = () => {
    _recordArtifact('SimpleActionSkipped', action.id);
    setActed('skip');
    _safe(() => typeof onSkip === 'function' && onSkip(action), null);
  };
  const handleRemind = () => {
    _recordArtifact('SimpleReminderRequested', action.id);
    setActed('remind');
    _safe(() => typeof onRemindLater === 'function' && onRemindLater(action), null);
  };
  const handleScan = () => _safe(() => typeof onScan === 'function' && onScan(action), null);
  const handleCallHelper = () => _safe(() => typeof onCallHelper === 'function' && onCallHelper(action), null);
  const handleVoice = () => _speak(voicePrompt, language);

  return (
    <article style={{ ...S.card, ...(acted ? S.cardActed : null) }}
      data-testid={testId || 'simple-action-card'}
      data-priority={priority}>
      <header style={S.head}>
        <span style={S.icon} aria-hidden="true">{action.icon || '🌱'}</span>
        <span style={{ ...S.priorityChip, background: color + '1A', color }}>
          ● {tSafe(PRIORITY_LABEL_KEYS[priority], PRIORITY_LABEL_DEFAULTS[priority])}
        </span>
        {voicePrompt ? (
          <button type="button" style={S.voiceBtn} onClick={handleVoice}
            aria-label={tSafe('simple.voice.play', 'Play voice')}
            data-testid="simple-action-voice">
            🔊
          </button>
        ) : null}
      </header>

      <p style={S.actionLabel}>{tSafe('simple.label.doThisNow', 'Do this now')}</p>
      <h2 style={S.action} data-testid="simple-action-text">{renderAction}</h2>

      {renderReason ? (
        <>
          <p style={S.metaLabel}>{tSafe('simple.label.why', 'Why')}</p>
          <p style={S.reason} data-testid="simple-action-reason">{renderReason}</p>
        </>
      ) : null}

      <p style={S.metaLabel}>{tSafe('simple.label.when', 'When')}</p>
      <p style={S.when} data-testid="simple-action-when">{renderWhen}</p>

      <div style={S.btnRow}>
        <button type="button" style={S.btnPrimary} onClick={handleDone}
          disabled={!!acted} data-testid="simple-action-done">
          {acted === 'done' ? '✓ ' : ''}{tSafe('simple.button.done', 'Done')}
        </button>
        {onSkip ? (
          <button type="button" style={S.btnGhost} onClick={handleSkip}
            disabled={!!acted} data-testid="simple-action-skip">
            {tSafe('simple.button.skip', 'Skip')}
          </button>
        ) : null}
        {onRemindLater ? (
          <button type="button" style={S.btnGhost} onClick={handleRemind}
            disabled={!!acted} data-testid="simple-action-remind">
            {tSafe('simple.button.remindLater', 'Remind me')}
          </button>
        ) : null}
        {onScan ? (
          <button type="button" style={S.btnGhost} onClick={handleScan}
            data-testid="simple-action-scan">
            {tSafe('simple.button.scan', 'Scan plant')}
          </button>
        ) : null}
        {onCallHelper ? (
          <button type="button" style={S.btnGhost} onClick={handleCallHelper}
            data-testid="simple-action-call">
            {tSafe('simple.button.callHelper', 'Call helper')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18,
    padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    boxShadow: '0 14px 28px -14px rgba(0,0,0,0.10)' },
  cardActed: { opacity: 0.55 },
  head: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { fontSize: 32, lineHeight: 1 },
  priorityChip: { fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999 },
  voiceBtn: { marginLeft: 'auto', fontSize: 18, padding: '6px 10px',
    background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 999,
    cursor: 'pointer' },
  actionLabel: { margin: '4px 0 0', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' },
  action: { margin: 0, fontSize: 22, fontWeight: 800, color: '#1F2937', lineHeight: 1.2 },
  metaLabel: { margin: '8px 0 0', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280' },
  reason: { margin: 0, fontSize: 15, color: '#374151', lineHeight: 1.4 },
  when: { margin: 0, fontSize: 15, fontWeight: 700, color: '#1F2937', lineHeight: 1.4 },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnPrimary: { flex: '1 1 auto', minWidth: 110, padding: '0.85rem 1.2rem',
    border: 'none', borderRadius: 999, background: '#6E8B61', color: '#FFFFFF',
    fontSize: 16, fontWeight: 800, cursor: 'pointer', minHeight: 48 },
  btnGhost: { flex: '0 1 auto', padding: '0.85rem 1rem',
    border: '1px solid #D1D5DB', borderRadius: 999, background: '#FFFFFF',
    color: '#1F2937', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
};
