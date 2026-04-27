/**
 * DailyReward — small, voice-friendly streak card.
 *
 *   <DailyReward />
 *
 * Reads `getStreak()` synchronously and renders a one-line
 * "🔥 X day streak" with an encouraging message. A small voice
 * button speaks the streak count aloud for low-literacy farmers.
 *
 * Optional `tasksDoneToday` + `tasksTotalToday` props render the
 * progress mini-bar from spec section 8 inline. Both default to
 * undefined so the bar only shows when the caller actually has
 * counts to render.
 *
 * Strict rules respected:
 *   * additive       - mount it anywhere; nothing else changes
 *   * lightweight    - inline styles, no animation libs
 *   * voice-first    - tap the speaker icon to hear the streak
 *   * not punishing  - day 0 still shows an encouraging line,
 *                      not "you have no streak"
 */

import React from 'react';
import { getStreak } from '../utils/streak.js';
import { speakReward } from '../utils/voiceReward.js';
import { tSafe } from '../i18n/tSafe.js';

export default function DailyReward({
  tasksDoneToday  = undefined,
  tasksTotalToday = undefined,
}) {
  const streak = getStreak();
  const showBar = Number.isFinite(Number(tasksDoneToday))
                  && Number.isFinite(Number(tasksTotalToday))
                  && Number(tasksTotalToday) > 0;
  const pct = showBar
    ? Math.max(0, Math.min(100, Math.round((Number(tasksDoneToday) / Number(tasksTotalToday)) * 100)))
    : 0;

  const headline = streak > 0
    ? tSafe('reward.streak.title', `${streak} day streak`)
        // tSafe drops the param when the key is missing, so build
        // the user-visible string here too:
        .replace('{n}', String(streak))
    : tSafe('reward.streak.start', 'Let\u2019s build a streak today');

  const subline = streak > 0
    ? tSafe('reward.streak.encourage', 'Keep going - you\u2019re doing great.')
    : tSafe('reward.streak.encourageStart', 'One task today starts your streak.');

  function handleSpeak() {
    const extra = streak > 0
      ? tSafe('reward.streak.voiceCount', `Streak ${streak} days`)
          .replace('{n}', String(streak))
      : '';
    speakReward(extra);
  }

  return (
    <section style={S.card} data-testid="daily-reward-card">
      <div style={S.headRow}>
        <span style={S.flame} aria-hidden="true">{streak > 0 ? '\uD83D\uDD25' : '\uD83C\uDF31'}</span>
        <div style={S.headText}>
          <h3 style={S.title}>
            {streak > 0
              ? `${streak} ${tSafe('reward.streak.daysWord', 'day streak')}`
              : tSafe('reward.streak.start', 'Let\u2019s build a streak today')}
          </h3>
          <p style={S.sub}>{subline}</p>
        </div>
        <button
          type="button"
          onClick={handleSpeak}
          style={S.speakBtn}
          aria-label={tSafe('reward.streak.voiceLabel', 'Hear streak')}
          data-testid="daily-reward-voice"
        >
          <span aria-hidden="true">{'\uD83D\uDD0A'}</span>
        </button>
      </div>

      {showBar && (
        <div style={S.barRow} aria-hidden="true">
          <div style={S.bar}>
            <div style={{ ...S.barFill, width: `${pct}%` }} />
          </div>
          <span style={S.barLabel}>
            {`${Number(tasksDoneToday)} / ${Number(tasksTotalToday)}`}
          </span>
        </div>
      )}

      {/* Suppress the unused-headline lint; we kept it computed
          above for callers that want to override the inner copy
          via a future prop without re-deriving it. */}
      {false && headline}
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    color: '#EAF2FF',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  flame: { fontSize: '2rem', lineHeight: 1, flexShrink: 0 },
  headText: { flex: 1, minWidth: 0 },
  title: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '0.01em',
  },
  sub: {
    margin: '0.125rem 0 0',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.4,
  },
  speakBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.22)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  bar: {
    flex: 1,
    height: '8px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: '999px',
    transition: 'width 0.25s ease',
  },
  barLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#DCFCE7',
    minWidth: '3rem',
    textAlign: 'right',
  },
};
