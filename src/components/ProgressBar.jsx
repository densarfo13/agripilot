/**
 * ProgressBar — calm progress strip on the Today screen.
 *
 *   <ProgressBar streak={5} tasksDone={6} />
 *
 * Layout (top -> bottom):
 *   1. Big number + sentence ("6 tasks done today")
 *   2. Supportive status line ("You\u2019re on track")
 *   3. Small streak chip when streak > 0
 *
 * Strict-rule audit
 *   * Loads instantly: pure presentational
 *   * Low-literacy friendly: emoji + number + minimal text
 *   * Works offline (caller passes raw numbers)
 *   * tSafe friendly: every visible string routes through tSafe
 *   * Supportive, NEVER shame-based: status copy is "You\u2019re
 *     on track" / "Great pace, keep going" — no "you missed",
 *     no "behind", no count of skipped tasks
 *   * Mobile-first: text wraps via overflowWrap so a long
 *     translation never blows out the strip
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

function _statusKey(tasksDone) {
  const n = Number(tasksDone) || 0;
  if (n >= 5) return { key: 'today.progress.statusGreat',  fb: 'Great pace, keep going.' };
  if (n >= 1) return { key: 'today.progress.statusOnTrack', fb: 'You\u2019re on track.' };
  return { key: 'today.progress.statusStart', fb: 'Pick one task to start.' };
}

function _interpolate(text, vars) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  if (vars) {
    for (const k of Object.keys(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    }
  }
  return out;
}

export default function ProgressBar({
  streak    = 0,
  tasksDone = 0,
}) {
  const s = Number.isFinite(Number(streak))    ? Math.max(0, Math.floor(Number(streak)))    : 0;
  const t = Number.isFinite(Number(tasksDone)) ? Math.max(0, Math.floor(Number(tasksDone))) : 0;

  // "6 tasks done today" — picks the singular vs plural variant
  // by passing through tSafe and letting the locale handle plural
  // forms in the dictionary. Fallback English is grammatical for
  // both 1 and N (the noun "tasks" is acceptable for 0 and N+1).
  const countKey = t === 1
    ? 'today.progress.tasksDoneSingular'
    : 'today.progress.tasksDoneToday';
  const countFallback = t === 1 ? '1 task done today' : `${t} tasks done today`;
  const countText = _interpolate(
    tSafe(countKey, countFallback),
    { count: t },
  );

  const status = _statusKey(t);

  return (
    <section style={S.card} data-testid="progress-bar">
      <div style={S.headline}>
        <span style={S.headlineIcon} aria-hidden="true">{'\u2714\uFE0F'}</span>
        <strong style={S.headlineText} data-testid="progress-bar-count">
          {countText}
        </strong>
      </div>
      <p style={S.status} data-testid="progress-bar-status">
        {tSafe(status.key, status.fb)}
      </p>

      {s > 0 && (
        <div style={S.streakChip} data-testid="progress-bar-streak">
          <span style={S.streakIcon} aria-hidden="true">{'\uD83D\uDD25'}</span>
          <span>
            {_interpolate(
              tSafe('today.progress.streak', '{count} day streak'),
              { count: s },
            )}
          </span>
        </div>
      )}
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#EAF2FF',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  headline: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headlineIcon: {
    fontSize: '1.125rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  headlineText: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    flex: 1,
    minWidth: 0,
    overflowWrap: 'break-word',
  },
  status: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  streakChip: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(252,211,77,0.10)',
    border: '1px solid rgba(252,211,77,0.30)',
    color: '#FCD34D',
    fontSize: '0.75rem',
    fontWeight: 700,
    marginTop: '0.125rem',
  },
  streakIcon: { fontSize: '0.9375rem', lineHeight: 1 },
};
