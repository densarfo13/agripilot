/**
 * InterventionList — farmer rows that need NGO follow-up, with a
 * one-line reason for the row.
 *
 * Selection rules (per spec)
 * ──────────────────────────
 *   A row qualifies when ANY of:
 *     • score < 40                        → reason: "Missed tasks"
 *                                            (low score is dominated
 *                                            by missed completions)
 *     • activity flag `low_activity`      → reason: "Low activity"
 *     • intervention payload from server  → reason: server-supplied
 *                                            actionKey (or fallback)
 *
 * Data sources (already loaded by AdminDashboard)
 * ───────────────────────────────────────────────
 *   • scoring[]       — score per farm (drives the <40 cohort)
 *   • interventions[] — server-computed list with action labels
 *   • performance[]   — risk + crop + region for context
 *
 * Rows are de-duplicated by `farmId` (server intervention wins
 * over a derived score row when both apply, because the server
 * carries a richer `actionKey`).
 *
 * Output: a stacked card list, capped at `MAX_ROWS` to keep the
 * dashboard scannable. The component renders nothing when no
 * farms qualify — operators don't need a card titled "0 farmers".
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getCropLabelSafe } from '../../utils/crops.js';
import RiskBadge from './RiskBadge.jsx';

const MAX_ROWS = 10;

function _num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _resolveServerAction(t, intervention) {
  if (!intervention || typeof intervention !== 'object') return null;
  const key = intervention.actionKey;
  const fallback = intervention.actionFallback || 'Follow up with farmer';
  if (typeof t === 'function' && key) {
    const v = t(key);
    if (v && v !== key) return v;
  }
  return fallback;
}

export default function InterventionList({
  scoring,
  interventions,
  performance,
}) {
  const { t, lang } = useTranslation();

  const rows = useMemo(() => {
    const byId = new Map();

    // ─── Server-supplied interventions ────────────────────────
    if (Array.isArray(interventions)) {
      for (const i of interventions) {
        if (!i || !i.farmId) continue;
        const level = i.intervention?.level;
        if (level === 'safe') continue;
        byId.set(i.farmId, {
          farmId:  i.farmId,
          region:  i.region,
          crop:    i.crop || null,
          score:   null,
          risk:    i.risk,
          reasonKey:      'admin.intervention.reason.server',
          reasonFallback: _resolveServerAction(t, i.intervention),
          source:  'server',
        });
      }
    }

    // ─── Score-derived (score < 40) ───────────────────────────
    if (Array.isArray(scoring)) {
      for (const s of scoring) {
        if (!s || !s.farmId) continue;
        const score = _num(s.score, 0);
        if (!(score > 0 && score < 40)) continue;
        if (byId.has(s.farmId)) continue;   // server row wins
        byId.set(s.farmId, {
          farmId:  s.farmId,
          region:  s.region,
          crop:    s.crop || null,
          score,
          risk:    'high',
          reasonKey:      'admin.intervention.reason.missedTasks',
          reasonFallback: 'Missed tasks',
          source:  'score',
        });
      }
    }

    // ─── Activity-flag derived ────────────────────────────────
    if (Array.isArray(performance)) {
      for (const p of performance) {
        if (!p || !p.farmId) continue;
        const lowActivity =
          p.activity === 'low' || p.activityFlag === 'low' || p.lowActivity === true;
        if (!lowActivity) continue;
        if (byId.has(p.farmId)) continue;
        byId.set(p.farmId, {
          farmId:  p.farmId,
          region:  p.region,
          crop:    p.crop || null,
          score:   null,
          risk:    p.risk || 'medium',
          reasonKey:      'admin.intervention.reason.lowActivity',
          reasonFallback: 'Low activity',
          source:  'activity',
        });
      }
    }

    return Array.from(byId.values()).slice(0, MAX_ROWS);
  }, [scoring, interventions, performance, t]);

  if (rows.length === 0) return null;

  return (
    <section style={S.section} data-testid="admin-intervention-list">
      <h3 style={S.h3}>
        {tStrict('admin.intervention.title', 'Farmers Needing Intervention')}
      </h3>
      <ul style={S.list}>
        {rows.map((r) => (
          <li key={r.farmId} style={S.row} data-source={r.source}>
            <div style={S.rowMain}>
              <strong style={S.rowFarm}>{`${String(r.farmId).slice(0, 8)}…`}</strong>
              {r.region ? <span style={S.rowMeta}>{r.region}</span> : null}
              {r.crop   ? <span style={S.rowMeta}>{getCropLabelSafe(r.crop, lang) || r.crop}</span> : null}
              <RiskBadge band={r.risk} score={r.score} />
            </div>
            <div style={S.rowReason}>
              {tStrict(r.reasonKey, r.reasonFallback)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const S = {
  section: { marginTop: '1.25rem' },
  h3: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  row: {
    padding: '0.625rem 0.875rem',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.18)',
    background: 'rgba(239,68,68,0.06)',
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: '0.85rem',
  },
  rowFarm: { color: '#fff' },
  rowMeta: { color: 'rgba(255,255,255,0.6)' },
  rowReason: {
    fontSize: '0.9rem',
    color: '#FCA5A5',
    fontWeight: 600,
  },
};
