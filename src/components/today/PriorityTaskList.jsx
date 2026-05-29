/**
 * PriorityTaskList.jsx — Phase 11 3-bucket task display.
 *
 *   <PriorityTaskList today={useToday(...)} onTaskClick={...} />
 *
 * Renders the ranker output as three calm sections:
 *   Do Now · Do Today · Catch up
 *   (can_wait bucket is collapsed inside a <details> footer)
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Caller wires task tap to whatever action they want — no
 *     direct task store writes from this component.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _isFn  = (v) => typeof v === 'function';

const STYLES = {
  wrap: { margin: '12px 0' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: 14,
    marginBottom: 6,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    appearance: 'none',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 10,
    background: '#FFFFFF',
    padding: '11px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    color: '#1F2933',
    boxShadow: '0 1px 1px rgba(31,41,51,0.03)',
  },
  rowDoNow: {
    border: '1px solid rgba(239,68,68,0.30)',
    background: 'rgba(239,68,68,0.04)',
  },
  rowDoToday: {
    border: '1px solid rgba(245,158,11,0.30)',
    background: 'rgba(245,158,11,0.04)',
  },
  rowRecovery: {
    border: '1px solid rgba(120,53,15,0.20)',
    background: 'rgba(254,243,199,0.40)',
  },
  rowCanWait: {
    border: '1px dashed rgba(31,41,51,0.16)',
  },
  rowTitle: { fontSize: 14, fontWeight: 700 },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  empty: {
    fontSize: 12, color: '#94A3B8', fontStyle: 'italic',
    padding: '6px 0',
  },
};

const BUCKET_HEADER = Object.freeze({
  do_now:   { key: 'today.priority.doNow.title',   def: 'Do Now',  style: STYLES.rowDoNow },
  do_today: { key: 'today.priority.doToday.title', def: 'Do Today', style: STYLES.rowDoToday },
  recovery: { key: 'today.priority.recovery.title', def: 'Catch up', style: STYLES.rowRecovery },
  can_wait: { key: 'today.priority.canWait.title', def: 'Can Wait', style: STYLES.rowCanWait },
});

function _label(task) {
  if (!_isObj(task)) return '';
  return _str(task.title) || _str(task.label) || _str(task.headline)
      || _str(task.text)  || _str(task.kind)  || 'Task';
}

function _meta(task, priority) {
  if (!_isObj(task) || !_isObj(priority)) return '';
  const due = _str(task.dueAt) || _str(task.dueDate);
  if (priority.isPastDue) return 'Past due';
  if (due) return 'Due ' + due.slice(0, 10);
  return '';
}

function _Section({ bucket, ranked, onTaskClick }) {
  const header = BUCKET_HEADER[bucket];
  const inBucket = _arr(ranked)
    .filter((r) => r && r.priority && r.priority.bucket === bucket);
  if (inBucket.length === 0) return null;
  return (
    <div data-testid={`today-priority-bucket-${bucket}`}>
      <div style={STYLES.sectionTitle}>
        {tSafe(header.key, header.def)} ({inBucket.length})
      </div>
      <div style={STYLES.list}>
        {inBucket.map((r, i) => (
          <button
            key={(r.task && (r.task.id || r.task.scanId)) || (bucket + '-' + i)}
            type="button"
            style={{ ...STYLES.row, ...header.style }}
            onClick={_isFn(onTaskClick) ? () => onTaskClick(r.task) : undefined}
            disabled={!_isFn(onTaskClick)}
            data-testid={`today-priority-task-${bucket}-${i}`}
          >
            <div style={STYLES.rowTitle}>{_label(r.task)}</div>
            {_meta(r.task, r.priority) ? (
              <div style={STYLES.rowMeta}>{_meta(r.task, r.priority)}</div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PriorityTaskList({ today, onTaskClick }) {
  if (!_isObj(today)) return null;
  const ranked = _arr(today.prioritizedTasks);
  if (ranked.length === 0) return null;
  const canWait = ranked.filter((r) => r && r.priority
                                && r.priority.bucket === 'can_wait');
  return (
    <section style={STYLES.wrap}
      data-testid="today-priority-task-list"
      aria-label={tSafe('today.priority.aria', 'Today’s tasks')}
    >
      <_Section bucket="do_now"   ranked={ranked} onTaskClick={onTaskClick} />
      <_Section bucket="do_today" ranked={ranked} onTaskClick={onTaskClick} />
      <_Section bucket="recovery" ranked={ranked} onTaskClick={onTaskClick} />
      {canWait.length > 0 ? (
        <details style={{ marginTop: 10 }}
          data-testid="today-priority-bucket-can_wait-details"
        >
          <summary style={{ ...STYLES.sectionTitle, cursor: 'pointer' }}>
            {tSafe('today.priority.canWait.summary',
              canWait.length + ' can wait', { n: canWait.length })}
          </summary>
          <_Section bucket="can_wait" ranked={ranked} onTaskClick={onTaskClick} />
        </details>
      ) : null}
    </section>
  );
}
