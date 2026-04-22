import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import {
  listBulkLots, requestBulkLot, formatPickupWindow,
} from '../lib/bulkLots.js';

/**
 * BulkLotsCard — buyer-facing browser of aggregated bulk lots.
 *
 * Loads the current active lots (optionally filtered by crop /
 * country / region), shows each as a row with total quantity,
 * contributor count, pickup window, and price range. "Request lot"
 * POSTs the buyer's interest, fans out a notification to every
 * contributing farmer, and reloads the list so the lot flips to
 * "Requested" locally if all contributors now have an open request.
 *
 * Props
 *   farm?         — optional farm for default filters (country + region)
 *   buyerName?    — optional buyer display name for the request
 *   buyerId?      — optional authenticated buyer user id
 *   filters?      — override filters { crop, country, region }
 *   compact?      — tighter spacing for embed
 *   onRequested?  — optional callback after a successful request
 */
export default function BulkLotsCard({
  farm = null,
  buyerName = null,
  buyerId = null,
  filters: propFilters = null,
  compact = true,
  onRequested = null,
}) {
  const { t, lang } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const initialFilters = {
    crop:    (propFilters && propFilters.crop)    || '',
    country: (propFilters && propFilters.country) || (farm && (farm.country || farm.countryCode)) || '',
    region:  (propFilters && propFilters.region)  || '',
  };
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busyLotId, setBusyLotId] = useState(null);

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await listBulkLots({
        crop: filters.crop || undefined,
        country: filters.country || undefined,
        region: filters.region || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.code || 'load_failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters.crop, filters.country, filters.region]);

  useEffect(() => { load(); }, [load]);

  const handleRequest = async (lot) => {
    if (busyLotId) return;
    setBusyLotId(lot.lotId); setError('');
    try {
      const out = await requestBulkLot(lot.lotId, { buyerName, buyerId });
      onRequested && onRequested({ lot, request: out });
      await load();
    } catch (err) {
      setError(err.code || 'request_failed');
    } finally {
      setBusyLotId(null);
    }
  };

  return (
    <section style={styles.root} data-testid="bulk-lots"
             aria-label={tr('bulk.title', 'Bulk lots near you')}>
      <header style={styles.header}>
        <h3 style={styles.title}>{tr('bulk.title', 'Bulk lots near you')}</h3>
        <button type="button" onClick={load} style={styles.refreshBtn}
                aria-label="Refresh">↻</button>
      </header>

      <div style={styles.filterRow}>
        <input style={styles.filterInput}
               value={filters.crop}
               onChange={(e) => setFilters({ ...filters, crop: e.target.value })}
               placeholder={tr('bulk.filter.crop', 'Filter by crop')}
               data-testid="bulk-filter-crop" />
        <input style={styles.filterInput}
               value={filters.region}
               onChange={(e) => setFilters({ ...filters, region: e.target.value })}
               placeholder={tr('bulk.filter.region', 'Filter by region')}
               data-testid="bulk-filter-region" />
      </div>

      {loading && (
        <div style={styles.info}>{tr('bulk.loading', 'Finding bulk lots…')}</div>
      )}
      {!loading && error && (
        <div style={styles.error} role="alert">
          {tr(`bulk.err.${error}`, tr('bulk.err.generic', 'Something went wrong.'))}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div style={styles.empty}>
          {tr('bulk.empty',
            'No bulk lots right now — farmers still need to post individual listings for aggregation to kick in.')}
        </div>
      )}

      <ul style={styles.list}>
        {rows.map((lot) => (
          <LotRow key={lot.lotId}
                  lot={lot}
                  onRequest={handleRequest}
                  busy={busyLotId === lot.lotId}
                  tr={tr} lang={lang} styles={styles} />
        ))}
      </ul>
    </section>
  );
}

function LotRow({ lot, onRequest, busy, tr, lang, styles }) {
  const pickup = formatPickupWindow(lot);
  const priceRange = lot.priceSignal
    ? formatPrice(lot.priceSignal)
    : null;

  return (
    <li style={styles.row} data-testid={`bulk-row-${lot.lotId}`}>
      <img src={getCropImage(lot.crop)} alt="" style={styles.thumb} />
      <div style={styles.main}>
        <div style={styles.titleLine}>
          <span style={styles.cropLabel}>{getCropLabel(lot.crop, lang)}</span>
          <span style={styles.qty}>{lot.totalQuantity} kg</span>
        </div>
        <div style={styles.meta}>
          {lot.contributors.length} {tr('bulk.contributors', 'farmers')}
          {lot.region && ` · ${lot.region}`}
          {lot.location && ` · ${lot.location}`}
        </div>
        <div style={styles.meta}>
          {pickup && (
            <>
              <span style={styles.pickupLabel}>
                {tr('bulk.pickup', 'Pickup')}:
              </span>{' '}{pickup}
            </>
          )}
          {priceRange && <> · {priceRange}</>}
        </div>
      </div>
      <button type="button"
              disabled={busy}
              onClick={() => onRequest(lot)}
              style={{ ...styles.primaryBtn, opacity: busy ? 0.6 : 1 }}
              data-testid={`bulk-request-${lot.lotId}`}>
        {busy
          ? tr('bulk.requesting', 'Requesting…')
          : tr('bulk.request', 'Request lot')}
      </button>
    </li>
  );
}

// ─── Formatters ──────────────────────────────────────────────
const CURRENCY_SYMBOLS = Object.freeze({
  USD: '$', GHS: 'GH\u20B5', NGN: '\u20A6', KES: 'KSh',
  INR: '\u20B9', TZS: 'TSh', UGX: 'USh', BRL: 'R$',
});
function formatPrice({ currency, low, high }) {
  const s = CURRENCY_SYMBOLS[String(currency || '').toUpperCase()] || '';
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '';
  return `${s}${low.toFixed(2)}\u2013${high.toFixed(2)}/kg`;
}

// ─── Styles ──────────────────────────────────────────────────
function buildStyles(compact) {
  const pad = compact ? 14 : 18;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 10, padding: pad,
      borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: { margin: 0, fontSize: 16, fontWeight: 700 },
    refreshBtn: {
      padding: '4px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'transparent', color: '#E6F4EA', cursor: 'pointer',
      fontSize: 14,
    },
    filterRow: { display: 'flex', gap: 8 },
    filterInput: {
      flex: 1, padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', fontSize: 13,
    },
    info:  { padding: 10, fontSize: 13, color: 'rgba(230,244,234,0.7)' },
    error: {
      padding: 10, borderRadius: 8, fontSize: 13, color: '#FEE2E2',
      background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.32)',
    },
    empty: {
      padding: 12, borderRadius: 8, fontSize: 13,
      color: 'rgba(230,244,234,0.6)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
    },
    list: { listStyle: 'none', margin: 0, padding: 0,
            display: 'flex', flexDirection: 'column', gap: 8 },
    row: {
      display: 'flex', gap: 10, alignItems: 'center',
      padding: 10, borderRadius: 10,
      background: 'rgba(56,189,248,0.06)',
      border: '1px solid rgba(56,189,248,0.22)',
    },
    thumb: { width: 48, height: 48, borderRadius: 10, objectFit: 'cover' },
    main:  { flex: 1, minWidth: 0 },
    titleLine: {
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    },
    cropLabel: { fontSize: 15, fontWeight: 700 },
    qty: {
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: 'rgba(56,189,248,0.22)', color: '#7DD3FC',
    },
    meta: { fontSize: 12, color: 'rgba(230,244,234,0.7)', marginTop: 2 },
    pickupLabel: { color: 'rgba(230,244,234,0.55)' },
    primaryBtn: {
      padding: '8px 14px', borderRadius: 10, border: 'none',
      background: '#22C55E', color: '#0B1D34', fontWeight: 600,
      fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
    },
  };
}
