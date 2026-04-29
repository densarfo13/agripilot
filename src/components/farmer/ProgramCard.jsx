/**
 * ProgramCard — secondary Today-screen card showing a
 * delivered NGO program message.
 *
 *   <ProgramCard
 *     program={p}
 *     delivery={d}
 *     onAck={() => markActed(p.id, farmerId)}
 *     onView={() => markOpened(p.id, farmerId)}
 *   />
 *
 * Spec contract (NGO Programs, § 4 + § 9)
 *   * Tap card → onView (mark OPENED)
 *   * Tap primary CTA "I'll do this" → onAck (mark ACTED)
 *   * No modal, no nested route — keeps the Today flow
 *     uninterrupted.
 *   * Brand-neutral styling — sits at scan-crop / sell
 *     priority, never competes with the main task.
 *
 * Strict-rule audit
 *   * Calm copy — never "you must" / "approved" / "act
 *     now" alarmist phrasing. Just the operator's message.
 *   * Status pill shows current state (SENT / OPENED /
 *     ACTED) so a farmer understands they've responded.
 *   * Forward-only callbacks: parent routes them through
 *     `markOpened`/`markActed`, both safe no-ops if
 *     status is already ahead.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

const STATUS_PILL = {
  SENT:   { bg: 'rgba(255,255,255,0.05)', fg: 'rgba(255,255,255,0.7)', label: 'New' },
  OPENED: { bg: 'rgba(245,158,11,0.18)',  fg: '#FCD34D',               label: 'Read' },
  ACTED:  { bg: 'rgba(34,197,94,0.15)',   fg: C.lightGreen,            label: 'Acted' },
};

export default function ProgramCard({
  program, delivery, onView, onAck,
  testId = 'program-card',
}) {
  if (!program || !delivery) return null;
  const status = String(delivery.status || 'SENT').toUpperCase();
  const pill = STATUS_PILL[status] || STATUS_PILL.SENT;

  const deadlineLabel = program.deadline
    ? new Date(program.deadline).toLocaleDateString(undefined,
        { month: 'short', day: 'numeric' })
    : null;

  function handleView() {
    if (status === 'SENT' && typeof onView === 'function') {
      onView();
    }
  }

  return (
    <article
      style={S.card}
      data-testid={`${testId}-${program.id}`}
      data-status={status}
      onClick={handleView}
    >
      <header style={S.header}>
        <span style={S.typeBadge}>
          {(program.type || 'announcement').replace('_', ' ')}
        </span>
        <span style={{
          ...S.statusPill,
          background: pill.bg, color: pill.fg,
        }}>
          {pill.label}
        </span>
      </header>

      <h3 style={S.title}>{program.title}</h3>
      {program.message && (
        <p style={S.message}>{program.message}</p>
      )}

      {deadlineLabel && (
        <p style={S.deadline}>
          📅 {tSafe('program.untilDeadline', 'Until')} {deadlineLabel}
        </p>
      )}

      {/* Primary action — only when not yet ACTED. Parent
          handles the markActed call. We stop event prop
          so the card's own handleView doesn't double-fire
          when the button is tapped. */}
      {status !== 'ACTED' && typeof onAck === 'function' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAck(); }}
          style={S.btn}
          data-testid={`${testId}-act-${program.id}`}
        >
          ✓ {tSafe('program.illDoThis', 'I\u2019ll do this')}
        </button>
      )}

      {status === 'ACTED' && (
        <p style={S.actedHint}>
          {tSafe('program.thanks',
            'Thank you. The program team can see you\u2019re acting on this.')}
        </p>
      )}
    </article>
  );
}

const S = {
  card: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '14px',
    padding: '0.95rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.45rem',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '0.4rem',
  },
  typeBadge: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.18rem 0.55rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  statusPill: {
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.18rem 0.55rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  title: {
    margin: '0.15rem 0 0',
    fontSize: '1rem', fontWeight: 800, color: C.white,
    letterSpacing: '-0.005em',
  },
  message: {
    margin: 0, color: 'rgba(255,255,255,0.78)',
    fontSize: '0.875rem', lineHeight: 1.5,
  },
  deadline: { margin: 0, color: '#FCD34D',
              fontSize: '0.75rem', fontWeight: 700 },
  btn: {
    marginTop: '0.4rem',
    alignSelf: 'flex-start',
    padding: '0.55rem 1rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(34,197,94,0.20)',
  },
  actedHint: {
    margin: '0.25rem 0 0', color: C.lightGreen,
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
};
