/**
 * ScanHistory — compact list of recent scans on this device.
 *
 * Reads from the local-first store at `src/data/scanHistory.js`.
 * Each row links to `/scan/result/:scanId` for the deep-link
 * detail view.
 *
 * Self-hides when no entries exist — the parent page chooses
 * whether to show an empty state above this.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getScanHistory } from '../../data/scanHistory.js';

const STYLES = {
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
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    color: '#fff',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    objectFit: 'cover',
    flexShrink: 0,
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowMeta:  { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  empty: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
};

const CONFIDENCE_DOT = {
  low:    { color: '#FDE68A', label: 'Low' },
  medium: { color: '#7DD3FC', label: 'Medium' },
  high:   { color: '#86EFAC', label: 'High' },
};

function _formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); }
  catch { return iso.slice(0, 10); }
}

export default function ScanHistory({ limit = 6 }) {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();

  const [entries, setEntries] = useState(() => {
    try { return getScanHistory(); } catch { return []; }
  });

  // Refresh when another tab writes a new scan.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (e) => {
      if (e?.key === 'farroway_scan_history') {
        try { setEntries(getScanHistory()); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const visible = Array.isArray(entries) ? entries.slice(-limit).reverse() : [];

  if (visible.length === 0) return null;

  return (
    <section style={STYLES.wrap} data-testid="scan-history">
      <h3 style={STYLES.title}>{tStrict('scan.history.title', 'Recent scans')}</h3>
      <ul style={STYLES.list}>
        {visible.map((entry) => {
          const conf = CONFIDENCE_DOT[entry.confidence] || CONFIDENCE_DOT.low;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  try { navigate('/scan/result/' + encodeURIComponent(entry.id)); }
                  catch { /* ignore */ }
                }}
                style={STYLES.row}
                data-testid={`scan-history-row-${entry.id}`}
              >
                {entry.thumbnail ? (
                  <img src={entry.thumbnail} alt="" style={STYLES.thumb} />
                ) : (
                  <div style={STYLES.thumbPlaceholder} aria-hidden="true">{'\uD83C\uDF31'}</div>
                )}
                <div style={STYLES.rowText}>
                  <div style={STYLES.rowTitle}>
                    {entry.possibleIssue || tStrict('scan.fallback.headline', 'Needs closer inspection')}
                  </div>
                  <div style={STYLES.rowMeta}>
                    <span style={{ color: conf.color, fontWeight: 700, marginRight: 6 }}>{'\u25CF'}</span>
                    {_formatDate(entry.createdAt)}
                    {entry.plantName ? ` \u00B7 ${entry.plantName}` : ''}
                  </div>
                </div>
                <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.4)' }}>{'\u203A'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
