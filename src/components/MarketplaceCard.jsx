import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropImage } from '../config/crops/index.js';
import {
  listMarketplaceListings,
  createMarketplaceListing,
  createMarketplaceListingOfflineAware,
  requestMarketplaceListing,
  updateMarketplaceListingStatus,
  LISTING_STATUS,
} from '../lib/marketplace.js';
import {
  usePriceInsight,
  formatPriceRange,
  formatTrend,
  PRICE_SOURCE_LABELS,
} from '../lib/priceIntelligence.js';
import { getCropLabelSafe } from '../utils/crops.js';

/**
 * MarketplaceCard — one widget that renders either:
 *   mode="browse"  → buyer view: list of active listings + filters +
 *                    "Request" button on each
 *   mode="list"    → farmer view: "Mark ready for sale" form +
 *                    listings this farmer owns with status controls
 *
 * Deliberately compact. For a full page surface, use the existing
 * src/pages/farmer/CreateListingPage.jsx and
 * src/pages/buyer/BrowseListingsPage.jsx. This component is the
 * dashboard tile + a drop-in quick-action surface.
 *
 * Props
 *   mode           — 'browse' (default) | 'list'
 *   farm           — farmer's current farm (for mode=list defaults)
 *   onRequest      — optional callback invoked after a successful
 *                    buyer request: (result) => void
 *   onListingCreated — callback for farmer mode after create
 *   filters        — initial { crop, region } for browse mode
 *   compact        — tighter spacing for dashboard embed
 */
export default function MarketplaceCard({
  mode = 'browse',
  farm = null,
  onRequest = null,
  onListingCreated = null,
  filters: initialFilters = {},
  compact = false,
}) {
  const { t, lang } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  if (mode === 'list') {
    return <FarmerListingMode farm={farm} onCreated={onListingCreated}
                              t={t} tr={tr} styles={styles} />;
  }
  return <BuyerBrowseMode filters={initialFilters} onRequest={onRequest}
                          farm={farm} t={t} tr={tr} styles={styles} lang={lang} />;
}

// ═══════════════════════════════════════════════════════════════
// Buyer: browse + request
// ═══════════════════════════════════════════════════════════════
function BuyerBrowseMode({ filters, onRequest, farm, t, tr, styles, lang }) {
  const [listings, setListings] = useState([]);
  const [crop, setCrop]         = useState(filters.crop || '');
  const [region, setRegion]     = useState(filters.region || '');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(null); // listingId currently being requested

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await listMarketplaceListings({ crop, region, status: 'active' });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.code || 'load_failed');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [crop, region]);

  useEffect(() => { load(); }, [load]);

  const handleRequest = async (listing) => {
    setBusy(listing.id); setError('');
    try {
      const result = await requestMarketplaceListing({
        listingId: listing.id,
        buyerName: farm && farm.farmerName ? farm.farmerName : undefined,
      });
      onRequest && onRequest({ listing, request: result });
      // Optimistic: the listing stays "active" in DB until the farmer
      // accepts, so we don't hide it — just flip the button state.
      await load();
    } catch (err) {
      setError(err.code || 'request_failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={styles.root} data-testid="marketplace-browse"
             aria-label={tr('marketplace.browse.title', 'Available crops')}>
      <header style={styles.header}>
        <h3 style={styles.title}>{tr('marketplace.browse.title', 'Available crops')}</h3>
        <button type="button" onClick={load} style={styles.refreshBtn} aria-label="Refresh">
          ↻
        </button>
      </header>

      <div style={styles.filterRow}>
        <input style={styles.filterInput}
               value={crop} onChange={(e) => setCrop(e.target.value)}
               placeholder={tr('marketplace.filter.cropPlaceholder', 'Filter by crop')}
               data-testid="marketplace-filter-crop" />
        <input style={styles.filterInput}
               value={region} onChange={(e) => setRegion(e.target.value)}
               placeholder={tr('marketplace.filter.regionPlaceholder', 'Filter by region')}
               data-testid="marketplace-filter-region" />
      </div>

      {loading && (
        <div style={styles.info}>{tr('marketplace.loading', 'Loading listings…')}</div>
      )}
      {!loading && error && (
        <div style={styles.error} role="alert">
          {tr(`marketplace.err.${error}`, tr('marketplace.err.generic', 'Could not load listings.'))}
        </div>
      )}
      {!loading && !error && listings.length === 0 && (
        <div style={styles.empty}>
          {tr('marketplace.empty', 'No active listings matching your filters yet.')}
        </div>
      )}

      <ul style={styles.list}>
        {listings.map((l) => (
          <li key={l.id} style={styles.row} data-testid={`listing-${l.id}`}>
            <img src={getCropImage(l.crop)} alt="" style={styles.thumb} />
            <div style={styles.rowMain}>
              <div style={styles.rowTitle}>{getCropLabelSafe(l.crop, lang)}</div>
              <div style={styles.rowMeta}>
                <span>{l.quantity} kg</span>
                {l.region && <span> · {l.region}</span>}
                {l.location && <span> · {l.location}</span>}
                {l.priceFdUnit != null && <span> · {l.priceFdUnit}/kg</span>}
              </div>
            </div>
            <button type="button"
                    disabled={busy === l.id}
                    onClick={() => handleRequest(l)}
                    style={{ ...styles.primaryBtn, opacity: busy === l.id ? 0.6 : 1 }}
                    data-testid={`request-${l.id}`}>
              {busy === l.id
                ? tr('marketplace.requesting', 'Requesting…')
                : tr('marketplace.request', 'Request')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// Farmer: "Mark ready for sale"
// ═══════════════════════════════════════════════════════════════
function FarmerListingMode({ farm, onCreated, t, tr, styles }) {
  const [crop, setCrop]           = useState(farm && farm.crop ? String(farm.crop).toUpperCase() : '');
  const [quantity, setQuantity]   = useState('');
  const [price, setPrice]         = useState('');
  const [location, setLocation]   = useState((farm && farm.location) || '');
  const [region, setRegion]       = useState((farm && (farm.region || farm.state)) || '');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [created, setCreated]     = useState(null);

  // Live suggested price range for the current (crop, country, region).
  // Re-queries whenever any of the three change; stays silent when
  // crop is empty so the form doesn't thrash on keystrokes.
  const { insight: priceInsight } = usePriceInsight({
    crop,
    country: farm && (farm.country || farm.countryCode),
    region:  region || (farm && (farm.region || farm.state)) || null,
    windowDays: 30,
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!crop.trim())     return setError('missing_crop');
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) return setError('invalid_quantity');
    setBusy(true);
    try {
      // Offline-aware: tries direct POST, falls back to the action
      // queue + syncs automatically when the device reconnects.
      const result = await createMarketplaceListingOfflineAware({
        crop, quantity: q,
        price:    price ? Number(price) : undefined,
        location: location || undefined,
        region:   region   || undefined,
        farmId:   farm && farm.id,
      });
      setCreated(result);
      setQuantity(''); setPrice('');
      onCreated && onCreated(result);
    } catch (err) {
      setError(err.code || 'create_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={styles.root} data-testid="marketplace-list"
             aria-label={tr('marketplace.list.title', 'Mark crop ready for sale')}>
      <header style={styles.header}>
        <h3 style={styles.title}>
          {tr('marketplace.list.title', 'Mark crop ready for sale')}
        </h3>
      </header>

      {created && !created.queued && (
        <div style={styles.success} data-testid="listing-created">
          {tr('marketplace.created', 'Your listing is live — buyers can now find it.')}
        </div>
      )}
      {created && created.queued && (
        <div style={{ ...styles.success,
                       background: 'rgba(252,211,77,0.14)',
                       color: '#FCD34D',
                       border: '1px solid rgba(252,211,77,0.32)' }}
             data-testid="listing-queued">
          {tr('marketplace.listingQueued',
            'Saved offline — we\u2019ll publish this listing the moment you reconnect.')}
        </div>
      )}

      <form onSubmit={submit} style={styles.form}>
        <label style={styles.label}>
          {tr('marketplace.field.crop', 'Crop')}
          <input style={styles.input} value={crop}
                 onChange={(e) => setCrop(e.target.value.toUpperCase())}
                 placeholder="MAIZE" required
                 data-testid="list-crop" />
        </label>
        <label style={styles.label}>
          {tr('marketplace.field.quantity', 'Quantity (kg)')}
          <input style={styles.input} value={quantity} type="number" min="1"
                 onChange={(e) => setQuantity(e.target.value)}
                 required data-testid="list-quantity" />
        </label>
        <label style={styles.label}>
          {tr('marketplace.field.price', 'Price per kg (optional)')}
          <input style={styles.input} value={price} type="number" min="0" step="0.01"
                 onChange={(e) => setPrice(e.target.value)}
                 data-testid="list-price" />
          {priceInsight && priceInsight.suggested && (
            <PriceSuggestionHint insight={priceInsight} tr={tr} />
          )}
        </label>
        <label style={styles.label}>
          {tr('marketplace.field.region', 'Region')}
          <input style={styles.input} value={region}
                 onChange={(e) => setRegion(e.target.value)}
                 data-testid="list-region" />
        </label>
        <label style={styles.label}>
          {tr('marketplace.field.location', 'Location')}
          <input style={styles.input} value={location}
                 onChange={(e) => setLocation(e.target.value)}
                 data-testid="list-location" />
        </label>
        {error && (
          <div style={styles.error} role="alert" data-testid="list-error">
            {tr(`marketplace.err.${error}`, tr('marketplace.err.generic', 'Could not create the listing.'))}
          </div>
        )}
        <button type="submit" style={styles.primaryBtn} disabled={busy}
                data-testid="list-submit">
          {busy ? tr('marketplace.saving', 'Saving…') : tr('marketplace.submit', 'Mark ready for sale')}
        </button>
      </form>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// PriceSuggestionHint — shown under the listing-form price field.
// ═══════════════════════════════════════════════════════════════
function PriceSuggestionHint({ insight, tr }) {
  const range = formatPriceRange(insight, { short: true });
  if (!range) return null;
  const trend = formatTrend(insight);
  const confColor = insight.confidence === 'high'   ? '#86EFAC'
                  : insight.confidence === 'medium' ? '#FCD34D'
                                                      : '#CBD5E1';
  const scopeLabel = PRICE_SOURCE_LABELS[insight.source] || insight.source;
  const rangeLabel = tr('priceInsight.suggestedShort', 'Market range');
  const confLabel  = tr(`priceInsight.conf.${insight.confidence}`,
                         insight.confidence === 'high'   ? 'High confidence'
                       : insight.confidence === 'medium' ? 'Medium'
                                                           : 'Low');
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      marginTop: 4, padding: '6px 8px', borderRadius: 8,
      background: 'rgba(34,197,94,0.08)',
      border: '1px solid rgba(34,197,94,0.22)',
      fontSize: 12, color: '#E6F4EA',
    }} data-testid="list-price-suggestion">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>{rangeLabel}:</span>
        <span>{range}</span>
        {trend.label && (
          <span style={{ color: trend.color, fontWeight: 600, marginLeft: 4 }}>
            {trend.arrow}
          </span>
        )}
      </div>
      <div style={{ color: 'rgba(230,244,234,0.6)' }}>
        {scopeLabel}
        {insight.sampleSize > 0 && ` · ${insight.sampleSize} ${tr('priceInsight.listings', 'listings')}`}
        <span style={{ color: confColor, marginLeft: 6 }}>· {confLabel}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════
function buildStyles(compact) {
  const pad = compact ? 12 : 16;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 10, padding: pad,
      borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8,
    },
    title:   { margin: 0, fontSize: 16, fontWeight: 700 },
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
    info:  { padding: 12, fontSize: 13, color: 'rgba(230,244,234,0.75)' },
    error: {
      padding: 10, borderRadius: 8, fontSize: 13, color: '#FEE2E2',
      background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.32)',
    },
    success: {
      padding: 10, borderRadius: 8, fontSize: 13, color: '#86EFAC',
      background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)',
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
      padding: 8, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    thumb:     { width: 48, height: 48, borderRadius: 10, objectFit: 'cover' },
    rowMain:   { flex: 1, minWidth: 0 },
    rowTitle:  { fontSize: 15, fontWeight: 600 },
    rowMeta:   { fontSize: 12, color: 'rgba(230,244,234,0.65)', marginTop: 2 },
    primaryBtn:{
      padding: '8px 14px', borderRadius: 10, border: 'none',
      background: '#22C55E', color: '#0B1D34', fontWeight: 600,
      fontSize: 13, cursor: 'pointer',
    },
    form:  { display: 'flex', flexDirection: 'column', gap: 8 },
    label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12,
             color: 'rgba(230,244,234,0.78)' },
    input: {
      padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)', color: '#E6F4EA', fontSize: 14,
    },
  };
}
