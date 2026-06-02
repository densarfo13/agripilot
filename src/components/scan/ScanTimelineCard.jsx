/**
 * ScanTimelineCard.jsx — §STAGE 12.
 *
 * Self-contained visual scan timeline. Renders a vertical timeline of
 * scan-related events for a single plant: first scan, issue found,
 * task created, follow-up, outcome recorded.
 *
 * Data source: dynamic import of
 *   ../../runtime/scanAccuracy/ScanTimelineRuntime
 * via `buildScanTimeline(plantKey)`. Never blocks the host surface —
 * if the runtime is absent or throws, the card silently falls back to
 * the empty state. Honest: never fabricates events.
 *
 * Error-boundary class wrapper pattern mirrors
 *   src/components/commandCenter/CommandCenterDeck.jsx.
 *
 * Decision support, not a guarantee.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const KIND_ICON = Object.freeze({
  first_scan:   '\u{1F331}', // sprout
  issue_found:  '\u{26A0}\u{FE0F}', // warning
  task_created: '\u{1F4CB}', // clipboard
  follow_up:    '\u{1F504}', // cycle
  outcome:      '\u{2705}', // check
});

const KIND_LABEL_KEY = Object.freeze({
  first_scan:   'scanTimeline.kind.first_scan',
  issue_found:  'scanTimeline.kind.issue_found',
  task_created: 'scanTimeline.kind.task_created',
  follow_up:    'scanTimeline.kind.follow_up',
  outcome:      'scanTimeline.kind.outcome',
});

const KIND_LABEL_FALLBACK = Object.freeze({
  first_scan:   'First scan',
  issue_found:  'Issue found',
  task_created: 'Task created',
  follow_up:    'Follow-up',
  outcome:      'Outcome recorded',
});

function _relativeTime(at, now) {
  return _safe(() => {
    if (typeof at !== 'number' || !isFinite(at)) return '';
    const ref = typeof now === 'number' && isFinite(now) ? now : Date.now();
    const diffMs = Math.max(0, ref - at);
    const sec = Math.round(diffMs / 1000);
    if (sec < 60)  return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60)  return `${min}m ago`;
    const hr  = Math.round(min / 60);
    if (hr  < 24)  return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30)  return `${day}d ago`;
    const mo  = Math.round(day / 30);
    if (mo  < 12)  return `${mo}mo ago`;
    const yr  = Math.round(day / 365);
    return `${yr}y ago`;
  }, '');
}

function _iconFor(kind) {
  return _safe(() => KIND_ICON[kind] || '\u{2022}', '\u{2022}');
}

function _labelFor(kind) {
  return _safe(() => {
    const key = KIND_LABEL_KEY[kind];
    const fb  = KIND_LABEL_FALLBACK[kind] || String(kind || '');
    if (!key) return fb;
    return tSafe(key, fb);
  }, String(kind || ''));
}

function ScanTimelineCardInner(props) {
  const plantKey = _safe(() => String(props && props.plantKey != null ? props.plantKey : ''), '');
  const limit    = _safe(() => {
    const n = props && typeof props.limit === 'number' ? props.limit : 8;
    return n > 0 ? Math.floor(n) : 8;
  }, 8);

  const [events, setEvents] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    if (!plantKey) { setEvents([]); return () => { alive = false; }; }
    import('../../runtime/scanAccuracy/ScanTimelineRuntime')
      .then((mod) => {
        const out = _safe(() => {
          const fn = mod && (mod.buildScanTimeline || (mod.default && mod.default.buildScanTimeline));
          if (typeof fn !== 'function') return [];
          const env = fn(plantKey);
          // Accept either a raw array or an envelope { events: [...] }.
          if (Array.isArray(env)) return env;
          if (env && Array.isArray(env.events)) return env.events;
          return [];
        }, []);
        if (alive) setEvents(out);
      })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, [plantKey]);

  const title = tSafe('scanTimeline.title', 'Scan Timeline');
  const emptyTitle = tSafe('scanTimeline.empty.title', 'No scan history yet.');
  const emptySub   = tSafe('scanTimeline.empty.sub', 'Your first scan will start the timeline.');

  // Sort newest-first, clamp to limit.
  const rows = _safe(() => {
    if (!Array.isArray(events)) return [];
    const copy = events.slice();
    copy.sort((a, b) => {
      const aa = (a && typeof a.at === 'number') ? a.at : 0;
      const bb = (b && typeof b.at === 'number') ? b.at : 0;
      return bb - aa;
    });
    return copy.slice(0, limit);
  }, []);

  const isEmpty = events !== null && rows.length === 0;
  const now = _safe(() => Date.now(), 0);

  return (
    <section
      style={S.section}
      data-testid="scan-timeline-card"
      data-plant-key={plantKey}>
      <p style={S.eyebrow}>{title}</p>

      {isEmpty ? (
        <div style={S.emptyCard} data-testid="scan-timeline-empty">
          <p style={S.emptyTitle}>{emptyTitle}</p>
          <p style={S.emptySub}>{emptySub}</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ol style={S.list} data-testid="scan-timeline-list">
          {rows.map((ev, i) => {
            const kind   = _safe(() => String(ev && ev.kind ? ev.kind : ''), '');
            const at     = _safe(() => (ev && typeof ev.at === 'number') ? ev.at : null, null);
            const detail = _safe(() => (ev && typeof ev.detail === 'string') ? ev.detail : '', '');
            const id     = _safe(() => (ev && ev.id != null) ? String(ev.id) : `${kind}-${at}-${i}`, `row-${i}`);
            const rel    = at != null ? _relativeTime(at, now) : '';

            return (
              <li
                key={id}
                style={S.row}
                data-testid="scan-timeline-row"
                data-kind={kind}>
                <span style={S.icon} aria-hidden="true">{_iconFor(kind)}</span>
                <div style={S.body}>
                  <div style={S.headLine}>
                    <span style={S.label}>{_labelFor(kind)}</span>
                    {rel ? <span style={S.time}>{rel}</span> : null}
                  </div>
                  {detail ? <p style={S.detail}>{detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

export default class ScanTimelineCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never block host surface */ }
  render() {
    if (this.state.failed) return null;
    try { return <ScanTimelineCardInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  section: {
    display: 'flex', flexDirection: 'column', gap: 10,
    marginBottom: 16, minWidth: 0,
  },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  emptyCard: {
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 4,
    minWidth: 0,
  },
  emptyTitle: {
    margin: 0, fontSize: 14, fontWeight: 700,
    color: 'rgba(40,52,40,0.9)',
  },
  emptySub: {
    margin: 0, fontSize: 12, lineHeight: 1.4,
    color: 'rgba(60,72,55,0.7)',
  },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
    minWidth: 0,
  },
  row: {
    display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
    gap: 10,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12,
    padding: '10px 12px',
    minWidth: 0,
  },
  icon: {
    flex: '0 0 auto',
    fontSize: 18, lineHeight: 1.2,
    width: 24, textAlign: 'center',
  },
  body: {
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  headLine: {
    display: 'flex', flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', gap: 8,
    minWidth: 0,
  },
  label: {
    fontSize: 14, fontWeight: 700, color: 'rgba(40,52,40,0.95)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    minWidth: 0, flex: 1,
  },
  time: {
    flex: '0 0 auto',
    fontSize: 11, fontWeight: 600, color: 'rgba(60,72,55,0.6)',
  },
  detail: {
    margin: 0, fontSize: 12, lineHeight: 1.4,
    color: 'rgba(60,72,55,0.78)',
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    minWidth: 0,
  },
};
