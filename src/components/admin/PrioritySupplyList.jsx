/**
 * PrioritySupplyList — top farmer rows for buyer-side prioritisation.
 *
 * Filter (per spec)
 * ─────────────────
 *   keep when readyToSell === true AND score > 60
 *
 * Sort
 * ────
 *   highest score first; ties broken by farmId for stable order.
 *
 * Inputs
 * ──────
 * Accepts the same `scoring`, `farmers`, and `performance` arrays
 * the parent dashboard already loaded. We try multiple sources for
 * the readyToSell signal:
 *   • row.readyToSell === true (explicit flag, e.g. on a storage
 *     dashboard payload that the admin endpoint may surface)
 *   • farmers[].stage ∈ {harvest, post_harvest, ready_to_sell}
 *     joined by farmId
 *
 * The component renders nothing when no rows qualify — operators
 * don't need a card titled "0 priority farms".
 *
 * Typical use: shipped to a buyer-facing surface OR used as an NGO
 * decision tile to call out who's ready to move produce.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getCropLabelSafe } from '../../utils/crops.js';
import RiskBadge from './RiskBadge.jsx';

const READY_STAGES = new Set(['harvest', 'post_harvest', 'ready_to_sell', 'ready']);
const MAX_ROWS = 10;

function _num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _isReady(row, farmStageById) {
  if (!row) return false;
  if (row.readyToSell === true) return true;
  if (row.farmId && farmStageById.has(row.farmId)) {
    return READY_STAGES.has(farmStageById.get(row.farmId));
  }
  if (row.stage && READY_STAGES.has(String(row.stage).toLowerCase())) return true;
  return false;
}

export default function PrioritySupplyList({
  scoring,
  farmers,
  performance,
}) {
  // Subscribe to language change + grab `lang` for crop labels.
  const { lang } = useTranslation();

  const rows = useMemo(() => {
    const farmStageById = new Map();
    if (Array.isArray(farmers)) {
      for (const f of farmers) {
        if (!f || !f.id) continue;
        farmStageById.set(f.id, String(f.stage || '').toLowerCase());
      }
    }

    // Build a unified list keyed by farmId. Pull score from
    // scoring[] (preferred), fall back to performance[].
    const byId = new Map();
    if (Array.isArray(scoring)) {
      for (const s of scoring) {
        if (!s || !s.farmId) continue;
        byId.set(s.farmId, {
          farmId: s.farmId,
          score:  _num(s.score, 0),
          crop:   s.crop || null,
          region: s.region || null,
          readyToSell: s.readyToSell === true ? true : null,
        });
      }
    }
    if (Array.isArray(performance)) {
      for (const p of performance) {
        if (!p || !p.farmId) continue;
        const cur = byId.get(p.farmId) || { farmId: p.farmId };
        byId.set(p.farmId, {
          ...cur,
          crop:   cur.crop   || p.crop   || null,
          region: cur.region || p.region || null,
          score:  cur.score  != null ? cur.score : _num(p.score, 0),
          readyToSell: cur.readyToSell ?? (p.readyToSell === true ? true : null),
        });
      }
    }

    const merged = Array.from(byId.values());
    const filtered = merged.filter(r => _num(r.score, 0) > 60 && _isReady(r, farmStageById));
    filtered.sort((a, b) => {
      const sa = _num(a.score, 0);
      const sb = _num(b.score, 0);
      if (sb !== sa) return sb - sa;
      return String(a.farmId || '').localeCompare(String(b.farmId || ''));
    });
    return filtered.slice(0, MAX_ROWS);
  }, [scoring, farmers, performance]);

  if (rows.length === 0) return null;

  return (
    <section style={S.section} data-testid="admin-priority-supply-list">
      <h3 style={S.h3}>
        {tStrict('admin.prioritySupply.title', 'Priority Supply (Ready & High Score)')}
      </h3>
      <ul style={S.list}>
        {rows.map((r) => (
          <li key={r.farmId} style={S.row}>
            <div style={S.rowLeft}>
              <strong style={S.farm}>{`${String(r.farmId).slice(0, 8)}…`}</strong>
              {r.region ? <span style={S.meta}>{r.region}</span> : null}
              {r.crop   ? <span style={S.meta}>{getCropLabelSafe(r.crop, lang) || r.crop}</span> : null}
            </div>
            <div style={S.rowRight}>
              <span style={S.score}>{r.score}</span>
              <RiskBadge score={r.score} />
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '0.625rem 0.875rem',
    borderRadius: 10,
    border: '1px solid rgba(34,197,94,0.22)',
    background: 'rgba(34,197,94,0.06)',
    marginBottom: 8,
  },
  rowLeft:  { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem' },
  rowRight: { display: 'flex', alignItems: 'center', gap: 8 },
  farm: { color: '#fff' },
  meta: { color: 'rgba(255,255,255,0.6)' },
  score: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#86EFAC',
    minWidth: 32,
    textAlign: 'right',
  },
};
