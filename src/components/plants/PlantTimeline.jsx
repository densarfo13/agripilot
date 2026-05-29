/**
 * PlantTimeline.jsx — date-grouped, newest-first plant history.
 *
 *   <PlantTimeline timeline={runtime.timeline} />
 *
 * What this is
 * ────────────
 *   Renders the output of buildPlantTimeline (or
 *   universalPlantRuntime().timeline) as the spec-shaped:
 *     • grouped by date
 *     • newest first
 *     • photo / scan / task / treatment chips when attachments
 *       carry them
 *
 *   Pure render. PlantProfile composes this component instead
 *   of embedding the markup inline.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Caller-injected data only.
 *   • All copy via tSafe.
 *   • No camera-error wording.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');

const S = {
  wrap: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  date: {
    fontSize: 11, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '10px 0 4px',
  },
  entry: {
    background: 'rgba(31,41,51,0.04)',
    border: '1px solid rgba(31,41,51,0.04)',
    borderRadius: 8,
    padding: '8px 10px',
    marginBottom: 4,
  },
  entryHead: {
    display: 'flex', alignItems: 'baseline',
    gap: 8,
  },
  kind: {
    fontSize: 11, fontWeight: 800, color: '#1F2933',
    background: 'rgba(22,163,74,0.10)',
    padding: '2px 6px', borderRadius: 4,
  },
  summary: { fontSize: 13, color: '#1F2933' },
  chips: {
    display: 'flex', gap: 4, flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    fontSize: 10, fontWeight: 700,
    background: 'rgba(148,163,184,0.18)',
    color: '#475569',
    padding: '2px 6px', borderRadius: 999,
  },
  empty: {
    fontSize: 13, color: '#94A3B8',
    fontStyle: 'italic', margin: 0,
  },
};

function _chips(att) {
  if (!_isObj(att)) return null;
  const out = [];
  if (_arr(att.photos).length > 0) out.push({
    key: 'photos', n: _arr(att.photos).length,
    label: 'photo',
  });
  if (_arr(att.scans).length > 0) out.push({
    key: 'scans', n: _arr(att.scans).length,
    label: 'scan',
  });
  if (_arr(att.tasks).length > 0) out.push({
    key: 'tasks', n: _arr(att.tasks).length,
    label: 'task',
  });
  if (_arr(att.treatments).length > 0) out.push({
    key: 'treatments', n: _arr(att.treatments).length,
    label: 'treatment',
  });
  if (out.length === 0) return null;
  return (
    <div style={S.chips}>
      {out.map((c) => (
        <span key={c.key} style={S.chip}
          data-testid={`plant-timeline-chip-${c.key}`}>
          {c.n} {c.label}{c.n === 1 ? '' : 's'}
        </span>
      ))}
    </div>
  );
}

export default function PlantTimeline({ timeline, maxGroups = 8,
                                          maxEntriesPerGroup = 6 }) {
  if (!_isObj(timeline) || timeline.totalCount === 0) {
    return (
      <div style={S.wrap} data-testid="plant-timeline-component">
        <p style={S.empty}>
          {tSafe('plantTimeline.empty',
            'No history yet — scans and tasks will appear here.')}
        </p>
      </div>
    );
  }
  return (
    <div style={S.wrap} data-testid="plant-timeline-component">
      {_arr(timeline.groups).slice(0, maxGroups).map((g) => (
        <div key={g.date} data-testid={`plant-timeline-group-${g.date}`}>
          <div style={S.date}>{g.date}</div>
          {_arr(g.entries).slice(0, maxEntriesPerGroup).map((e) => (
            <div key={e.id} style={S.entry}
              data-testid={`plant-timeline-entry-${e.kind}`}>
              <div style={S.entryHead}>
                <span style={S.kind}>{_str(e.kind)}</span>
                <span style={S.summary}>{_str(e.summary)}</span>
              </div>
              {_chips(e.attachments)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
