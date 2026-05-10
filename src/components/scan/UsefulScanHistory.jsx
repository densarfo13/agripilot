/**
 * UsefulScanHistory — compact history list for FEATURE_SCAN_USEFULNESS.
 *
 * Reads from farroway_scan_history_v1 via scanHistoryStore.
 * Each row shows: category chip + date + task-added indicator.
 * Tapping a row navigates to /scan/result/:scanId (deep-link detail).
 *
 * Self-hides when no entries exist.
 *
 * Rules
 * ─────
 *   • Hooks called unconditionally — rules-of-hooks safe.
 *   • Never throws.
 *   • Subscribes to the browser storage event for cross-tab refresh.
 *   • No network, no blocking render.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';
import { SCAN_HISTORY_KEY } from '../../lib/scan/scanHistoryStore.js';

// ─── Per-category display ─────────────────────────────────────────

// Plantix-style upgrade — added wilting + nutrient_stress so the
// history list renders the new safe categories with proper
// labels and emojis. Unknown categories still fall through the
// _meta() default below.
const CATEGORY_META = Object.freeze({
  healthy:                  { emoji: '✅', label: 'Healthy' },
  yellowing:                { emoji: '🌿', label: 'Yellowing' },
  holes_or_pest_damage:     { emoji: '🐛', label: 'Pest damage' },
  spots_or_disease_concern: { emoji: '🍂', label: 'Leaf spots' },
  wilting:                  { emoji: '💧', label: 'Wilting' },
  nutrient_stress:          { emoji: '🌱', label: 'Nutrient stress' },
  needs_review:             { emoji: '📷', label: 'Unclear photo' },
});

function _meta(category) {
  return CATEGORY_META[category] || { emoji: '🌱', label: category || 'Scan' };
}

function _formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); }
  catch { return String(iso).slice(0, 10); }
}

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  row: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: '9px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    color: '#fff',
    textAlign: 'left',
    fontFamily: 'inherit',
    width: '100%',
  },
  rowEmoji: {
    fontSize: 18,
    flexShrink: 0,
    width: 24,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#C8944D',
    display: 'inline-block',
  },
  chevron: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    flexShrink: 0,
  },
};

// ─── Component ───────────────────────────────────────────────────

export default function UsefulScanHistory({ limit = 6 }) {
  // All hooks unconditional — rules-of-hooks safe.
  const navigate = useNavigate();

  const [entries, setEntries] = useState(() => {
    try { return getScanUsefulHistory(); } catch { return []; }
  });

  // Cross-tab refresh when another tab saves a new scan.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function _onStorage(e) {
      if (e && e.key === SCAN_HISTORY_KEY) {
        try { setEntries(getScanUsefulHistory()); } catch { /* ignore */ }
      }
    }

    try { window.addEventListener('storage', _onStorage); }
    catch { /* swallow */ }

    return () => {
      try { window.removeEventListener('storage', _onStorage); }
      catch { /* swallow */ }
    };
  }, []);

  const visible = Array.isArray(entries) ? entries.slice(0, limit) : [];

  if (visible.length === 0) return null;

  return (
    <section style={S.wrap} data-testid="useful-scan-history">
      <h3 style={S.title}>Recent scans</h3>
      <ul style={S.list}>
        {visible.map((entry) => {
          const meta = _meta(entry.category);
          return (
            <li key={entry.id}>
              <button
                type="button"
                style={S.row}
                data-testid={`useful-scan-history-row-${entry.id}`}
                onClick={() => {
                  try {
                    navigate('/scan/result/' + encodeURIComponent(entry.id));
                  } catch { /* ignore */ }
                }}
              >
                <span style={S.rowEmoji} aria-hidden="true">
                  {meta.emoji}
                </span>
                <div style={S.rowText}>
                  <div style={S.rowLabel}>{meta.label}</div>
                  <div style={S.rowMeta}>
                    {entry.taskAdded ? (
                      <span
                        style={S.taskDot}
                        title="Follow-up task added"
                        aria-hidden="true"
                      />
                    ) : null}
                    {_formatDate(entry.createdAt)}
                  </div>
                </div>
                <span aria-hidden="true" style={S.chevron}>›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
