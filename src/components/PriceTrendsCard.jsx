import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import {
  fetchPriceInsight, formatPriceRange, formatTrend, PRICE_SOURCE_LABELS,
} from '../lib/priceIntelligence.js';

/**
 * PriceTrendsCard — "Price trends in your region" dashboard section.
 *
 * Fetches a small basket of price insights in parallel:
 *   • the farmer's current crop (first row, highlighted)
 *   • 3 regionally-relevant staples as a comparison set
 *
 * Every row shows: crop thumb + label, suggested range, big trend
 * arrow, scope label (Your region / Country average / Global).
 * Empty / unavailable rows fail soft — the card never blocks the
 * dashboard on a missing API call.
 *
 * Props
 *   farm       — required. Provides crop + country + region context.
 *   compact    — tighter spacing for dashboard embed.
 *   basket     — optional: crops to show alongside farm.crop.
 *                Default = ['maize', 'rice', 'cassava'] de-duped
 *                against the farm's own crop.
 */
const DEFAULT_BASKET = Object.freeze(['maize', 'rice', 'cassava', 'tomato']);

export default function PriceTrendsCard({ farm, compact = true, basket = DEFAULT_BASKET }) {
  const { t, lang } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  // Assemble the list of crops to fetch: farmer's crop first, then
  // the basket with duplicates removed. Up to 4 rows.
  const cropsToFetch = useMemo(() => {
    const myCrop = farm && farm.crop ? String(farm.crop).toLowerCase() : null;
    const out = [];
    if (myCrop) out.push(myCrop);
    for (const c of basket) {
      const k = String(c).toLowerCase();
      if (out.indexOf(k) === -1) out.push(k);
      if (out.length >= 4) break;
    }
    return out;
  }, [farm && farm.crop, basket]);

  const country = farm && (farm.country || farm.countryCode);
  const region  = farm && (farm.region || farm.state);

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(cropsToFetch.map((crop) =>
      fetchPriceInsight({ crop, country, region, windowDays: 30 })
        .then((insight) => (insight ? { crop, insight } : null))
        .catch(() => null),
    )).then((results) => {
      if (cancelled) return;
      setRows(results.filter(Boolean));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [JSON.stringify(cropsToFetch), country, region]);

  if (!farm) return null;

  return (
    <section style={styles.root} data-testid="price-trends"
             aria-label={tr('priceInsight.title', 'Price trends in your region')}>
      <header style={styles.header}>
        <h3 style={styles.title}>
          {tr('priceInsight.title', 'Price trends in your region')}
        </h3>
        <span style={styles.window}>
          {tr('priceInsight.window30', 'Last 30 days')}
        </span>
      </header>

      {loading && rows.length === 0 && (
        <div style={styles.info}>{tr('priceInsight.loading', 'Loading prices…')}</div>
      )}

      <ul style={styles.list}>
        {rows.map(({ crop, insight }, i) => (
          <PriceRow key={crop}
                    crop={crop}
                    insight={insight}
                    primary={i === 0}
                    lang={lang}
                    tr={tr}
                    styles={styles} />
        ))}
        {!loading && rows.length === 0 && (
          <li style={styles.empty}>
            {tr('priceInsight.empty',
                'Market prices aren\u2019t available yet for your crops.')}
          </li>
        )}
      </ul>
    </section>
  );
}

function PriceRow({ crop, insight, primary, lang, tr, styles }) {
  const range = formatPriceRange(insight, { short: true });
  const trend = formatTrend(insight);
  const scopeLabel =
    insight.source === 'local'    ? tr('priceInsight.scope.local',    'Your region')
  : insight.source === 'country'  ? tr('priceInsight.scope.country',  'Country average')
  : insight.source === 'global'   ? tr('priceInsight.scope.global',   'Global benchmark')
                                   : tr('priceInsight.scope.fallback', 'Generic estimate');
  const trendLabel =
    insight.trend === 'up'     ? tr('priceInsight.trend.up',     'Up this week')
  : insight.trend === 'down'   ? tr('priceInsight.trend.down',   'Down this week')
  : insight.trend === 'stable' ? tr('priceInsight.trend.stable', 'Steady this week')
                                 : null;
  return (
    <li style={primary ? { ...styles.row, ...styles.rowPrimary } : styles.row}
        data-testid={`price-row-${crop}`}>
      <img src={getCropImage(crop)} alt="" style={styles.thumb} />
      <div style={styles.main}>
        <div style={styles.titleLine}>
          <span style={styles.cropLabel}>{getCropLabel(crop, lang)}</span>
          {primary && (
            <span style={styles.primaryPill}>
              {tr('priceInsight.yourCrop', 'Your crop')}
            </span>
          )}
        </div>
        <div style={styles.price}>
          {range || '—'}
          <span style={{ color: trend.color, fontWeight: 700, marginLeft: 8 }}>
            {trend.arrow}
          </span>
        </div>
        <div style={styles.meta}>
          {scopeLabel}
          {insight.sampleSize > 0 && ` · ${insight.sampleSize}`}
          {trendLabel && ` · ${trendLabel}`}
        </div>
      </div>
    </li>
  );
}

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
    title:   { margin: 0, fontSize: 16, fontWeight: 700 },
    window:  { fontSize: 11, color: 'rgba(230,244,234,0.55)' },
    info:    { padding: 10, fontSize: 13, color: 'rgba(230,244,234,0.7)' },
    list:    { listStyle: 'none', margin: 0, padding: 0,
               display: 'flex', flexDirection: 'column', gap: 8 },
    row: {
      display: 'flex', gap: 10, alignItems: 'center',
      padding: 10, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    rowPrimary: {
      background: 'rgba(34,197,94,0.08)',
      borderColor: 'rgba(34,197,94,0.22)',
    },
    thumb: { width: 44, height: 44, borderRadius: 10, objectFit: 'cover' },
    main:  { flex: 1, minWidth: 0 },
    titleLine: {
      display: 'flex', alignItems: 'center', gap: 8,
      flexWrap: 'wrap',
    },
    cropLabel: { fontSize: 14, fontWeight: 600 },
    primaryPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
      background: 'rgba(34,197,94,0.18)', color: '#86EFAC',
      textTransform: 'uppercase', letterSpacing: 0.3,
    },
    price: { fontSize: 15, fontWeight: 700, marginTop: 2 },
    meta:  { fontSize: 12, color: 'rgba(230,244,234,0.6)', marginTop: 2 },
    empty: {
      padding: 12, borderRadius: 8, fontSize: 13,
      color: 'rgba(230,244,234,0.6)',
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.14)',
      listStyle: 'none',
    },
  };
}
