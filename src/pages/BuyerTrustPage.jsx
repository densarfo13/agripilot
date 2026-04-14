import { useEffect, useState, useCallback } from 'react';
import { getBuyerTrustFarms } from '../lib/api.js';
import { useTranslation } from '../i18n/index.js';

const FILTERS = [
  { key: '', label: 'buyer.allFarms' },
  { key: 'safe', label: 'buyer.safe' },
  { key: 'needs_review', label: 'buyer.needsReview' },
  { key: 'not_safe', label: 'buyer.notSafe' },
];

const STATUS_COLORS = {
  compliant: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  needs_review: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  non_compliant: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

const CONFIDENCE_BADGE = {
  verified: { bg: '#dbeafe', text: '#1e40af', label: 'buyer.verified' },
  self_reported: { bg: '#f3f4f6', text: '#6b7280', label: 'buyer.selfReported' },
};

const TIMELINE_ICONS = { pesticide: '\uD83E\uDDEA', harvest: '\uD83C\uDF3E', safe_date: '\u2705', update: '\uD83D\uDCDD' };

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BuyerTrustPage() {
  const t = useTranslation();
  const [farms, setFarms] = useState([]);
  const [summary, setSummary] = useState({ total: 0, safe: 0, needsReview: 0, notSafe: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // farmerId with timeline open

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBuyerTrustFarms({ status: filter || undefined });
      setFarms(data.farms || []);
      setSummary(data.summary || { total: 0, safe: 0, needsReview: 0, notSafe: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const toggleTimeline = (farmerId) => {
    setExpanded(prev => prev === farmerId ? null : farmerId);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <h1 style={S.title}>{t('buyer.title')}</h1>

      {/* Summary pills */}
      <div style={S.summaryRow}>
        <div style={{ ...S.pill, background: '#f3f4f6' }}>
          <span style={S.pillCount}>{summary.total}</span>
          <span style={S.pillLabel}>{t('buyer.allFarms')}</span>
        </div>
        <div style={{ ...S.pill, background: STATUS_COLORS.compliant.bg }}>
          <span style={{ ...S.pillCount, color: STATUS_COLORS.compliant.text }}>{summary.safe}</span>
          <span style={S.pillLabel}>{t('buyer.safe')}</span>
        </div>
        <div style={{ ...S.pill, background: STATUS_COLORS.needs_review.bg }}>
          <span style={{ ...S.pillCount, color: STATUS_COLORS.needs_review.text }}>{summary.needsReview}</span>
          <span style={S.pillLabel}>{t('buyer.needsReview')}</span>
        </div>
        <div style={{ ...S.pill, background: STATUS_COLORS.non_compliant.bg }}>
          <span style={{ ...S.pillCount, color: STATUS_COLORS.non_compliant.text }}>{summary.notSafe}</span>
          <span style={S.pillLabel}>{t('buyer.notSafe')}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={S.filterRow}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            style={filter === f.key ? { ...S.filterBtn, ...S.filterBtnActive } : S.filterBtn}
            onClick={() => setFilter(f.key)}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {error && <div style={S.error}>{error}</div>}
      {loading && <div style={S.loading}>Loading...</div>}

      {/* Farm cards */}
      {!loading && farms.length === 0 && (
        <div style={S.empty}>{t('buyer.noFarms')}</div>
      )}

      {!loading && farms.map(farm => {
        const sc = STATUS_COLORS[farm.status] || STATUS_COLORS.needs_review;
        const cb = CONFIDENCE_BADGE[farm.confidence] || CONFIDENCE_BADGE.self_reported;
        const isExpanded = expanded === farm.farmerId;

        return (
          <div key={farm.farmerId} style={{ ...S.card, borderLeft: `4px solid ${sc.border}` }}>
            {/* Card header */}
            <div style={S.cardHeader}>
              <div style={S.cardMain}>
                <div style={S.farmName}>{farm.farmName}</div>
                <div style={S.cropLine}>{farm.crop}{farm.location ? ` \u00B7 ${farm.location}` : ''}</div>
              </div>
              <div style={{ ...S.statusBadge, background: sc.bg, color: sc.text }}>
                {farm.buyerLabel}
              </div>
            </div>

            {/* Key facts */}
            <div style={S.factsRow}>
              <div style={S.fact}>
                <span style={S.factLabel}>{t('buyer.lastPesticide')}</span>
                <span style={S.factValue}>{fmtDate(farm.lastPesticideDate)}</span>
              </div>
              <div style={S.fact}>
                <span style={S.factLabel}>{t('buyer.safeHarvestDate')}</span>
                <span style={S.factValue}>{fmtDate(farm.safeHarvestDate)}</span>
              </div>
              <div style={S.fact}>
                <span style={S.factLabel}>{t('buyer.confidence')}</span>
                <span style={{ ...S.confidenceBadge, background: cb.bg, color: cb.text }}>
                  {t(cb.label)}
                </span>
              </div>
            </div>

            {/* Violations */}
            {farm.violationCount > 0 && (
              <div style={S.violationLine}>
                {t('buyer.violations')}: {farm.violationCount} &mdash; {farm.reason}
              </div>
            )}

            {/* Timeline toggle */}
            <button style={S.timelineBtn} onClick={() => toggleTimeline(farm.farmerId)}>
              {isExpanded ? '\u25B2' : '\u25BC'} {t('buyer.timeline')}
            </button>

            {/* Expanded timeline */}
            {isExpanded && farm.timeline && farm.timeline.length > 0 && (
              <div style={S.timeline}>
                {farm.timeline.slice(-10).map((evt, i) => (
                  <div key={i} style={S.tlEvent}>
                    <span style={S.tlIcon}>{TIMELINE_ICONS[evt.type] || '\uD83D\uDD18'}</span>
                    <span style={S.tlDate}>{fmtDate(evt.date)}</span>
                    <span style={S.tlLabel}>{evt.label}</span>
                    {evt.detail && <span style={S.tlDetail}>{evt.detail}</span>}
                  </div>
                ))}
              </div>
            )}

            {isExpanded && (!farm.timeline || farm.timeline.length === 0) && (
              <div style={S.tlEmpty}>No activity recorded yet.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Styles (mobile-friendly, no heavy dashboard) ───────────
const S = {
  page: { padding: '1rem', maxWidth: '640px', margin: '0 auto' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem' },

  // Summary
  summaryRow: { display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' },
  pill: { flex: '1 1 0', minWidth: '70px', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' },
  pillCount: { display: 'block', fontSize: '1.25rem', fontWeight: 700 },
  pillLabel: { fontSize: '11px', color: '#6b7280' },

  // Filters
  filterRow: { display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' },
  filterBtn: {
    padding: '6px 14px', borderRadius: '20px', border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#374151',
  },
  filterBtnActive: {
    background: '#2563eb', color: '#fff', borderColor: '#2563eb',
  },

  // States
  error: { color: '#dc2626', fontSize: '14px', marginBottom: '1rem' },
  loading: { color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '2rem 0' },
  empty: { color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '2rem 0' },

  // Card
  card: {
    background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '10px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  cardMain: { flex: 1 },
  farmName: { fontWeight: 600, fontSize: '15px' },
  cropLine: { fontSize: '13px', color: '#6b7280', marginTop: '2px' },
  statusBadge: {
    padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600,
    whiteSpace: 'nowrap', flexShrink: 0,
  },

  // Facts
  factsRow: { display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' },
  fact: { flex: '1 1 0', minWidth: '100px' },
  factLabel: { display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '2px' },
  factValue: { fontSize: '13px', fontWeight: 500 },
  confidenceBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 500 },

  // Violations
  violationLine: { fontSize: '12px', color: '#991b1b', marginTop: '8px', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px' },

  // Timeline
  timelineBtn: {
    marginTop: '8px', background: 'none', border: 'none', color: '#2563eb',
    cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: '4px 0',
  },
  timeline: { marginTop: '6px', paddingLeft: '4px' },
  tlEvent: { display: 'flex', gap: '6px', alignItems: 'baseline', fontSize: '13px', padding: '3px 0', borderBottom: '1px solid #f3f4f6' },
  tlIcon: { fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 },
  tlDate: { fontSize: '12px', color: '#9ca3af', width: '80px', flexShrink: 0 },
  tlLabel: { flex: 1 },
  tlDetail: { fontSize: '12px', color: '#6b7280' },
  tlEmpty: { fontSize: '13px', color: '#9ca3af', padding: '8px 0' },
};
