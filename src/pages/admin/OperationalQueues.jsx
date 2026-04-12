import React, { useState, useEffect, useCallback } from 'react';
import {
  getQueueSummary,
  getFalsePositiveQueue,
  getBoundaryReviewQueue,
  getAlertReviewQueue,
  autoValidateBoundary,
  reviewPestReport,
  suppressAlert,
} from '../../lib/intelligenceAdminApi.js';

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(d); }
}

function shortId(id) {
  if (!id) return '-';
  const s = String(id);
  return s.length > 12 ? s.slice(0, 8) + '...' : s;
}

const TABS = [
  { key: 'summary', label: 'Overview' },
  { key: 'false-positive', label: 'False Positives' },
  { key: 'boundary-review', label: 'Boundary Review' },
  { key: 'alert-review', label: 'Alert Review' },
];

// ─── Component ──────────────────────────────────────────────

export default function OperationalQueues() {
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [queueData, setQueueData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTab = useCallback(async (tabKey) => {
    setLoading(true);
    setError(null);
    try {
      if (tabKey === 'summary') {
        const res = await getQueueSummary();
        setSummary(res?.data || res);
      } else if (tabKey === 'false-positive') {
        const res = await getFalsePositiveQueue();
        setQueueData(res?.data || (Array.isArray(res) ? res : []));
      } else if (tabKey === 'boundary-review') {
        const res = await getBoundaryReviewQueue();
        setQueueData(res?.data || (Array.isArray(res) ? res : []));
      } else if (tabKey === 'alert-review') {
        const res = await getAlertReviewQueue();
        setQueueData(res?.data || (Array.isArray(res) ? res : []));
      }
    } catch (err) {
      setError(err.message || 'Failed to load queue data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const handleAutoValidate = async (boundaryId) => {
    setActionLoading(boundaryId);
    try {
      await autoValidateBoundary(boundaryId);
      fetchTab(tab);
    } catch { /* error shown via reload */ }
    finally { setActionLoading(null); }
  };

  const handleReviewReport = async (reportId, decision) => {
    setActionLoading(reportId);
    try {
      await reviewPestReport(reportId, { decision });
      fetchTab(tab);
    } catch { /* error shown via reload */ }
    finally { setActionLoading(null); }
  };

  const handleSuppressAlert = async (alertId) => {
    setActionLoading(alertId);
    try {
      await suppressAlert(alertId, 'admin_queue_review');
      fetchTab(tab);
    } catch { /* error shown via reload */ }
    finally { setActionLoading(null); }
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>Operational Queues</h1>
      <p style={S.subtitle}>Review items requiring admin attention: false positives, boundary issues, and alert reviews.</p>

      {/* Tab bar */}
      <div style={S.tabRow}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...S.tabBtn, ...(tab === t.key ? S.tabActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={S.errorBanner}>
          {error}
          <button style={S.retryBtn} onClick={() => fetchTab(tab)}>Retry</button>
        </div>
      )}

      {loading && <div style={S.emptyState}><div style={S.spinner} /></div>}

      {/* Summary tab */}
      {!loading && tab === 'summary' && summary && (
        <div style={S.summaryGrid}>
          {[
            { label: 'False Positives', count: summary.falsePositives ?? summary.false_positives ?? 0, color: '#F59E0B' },
            { label: 'Boundary Reviews', count: summary.boundaryReviews ?? summary.boundary_reviews ?? 0, color: '#3B82F6' },
            { label: 'Alert Reviews', count: summary.alertReviews ?? summary.alert_reviews ?? 0, color: '#EF4444' },
            { label: 'Total Pending', count: summary.total ?? 0, color: '#fff' },
          ].map((item, i) => (
            <div key={i} style={S.summaryCard}>
              <div style={S.summaryLabel}>{item.label}</div>
              <div style={{ ...S.summaryValue, color: item.color }}>{item.count}</div>
            </div>
          ))}
        </div>
      )}

      {/* False positive queue */}
      {!loading && tab === 'false-positive' && (
        queueData.length === 0 ? (
          <div style={S.emptyState}>No false-positive reports pending review.</div>
        ) : (
          <div style={S.cardList}>
            {queueData.map((item) => (
              <div key={item.id} style={S.queueCard}>
                <div style={S.queueRow}>
                  <span style={S.queueId}>Report {shortId(item.id)}</span>
                  <span style={S.queueDate}>{formatDate(item.createdAt ?? item.created_at)}</span>
                </div>
                <div style={S.queueDetail}>
                  Farm: {shortId(item.profileId ?? item.profile_id)} | Risk: {item.riskScore ?? item.risk_score ?? '-'} | Feedback: {item.userFeedback ?? item.user_feedback ?? '-'}
                </div>
                <div style={S.queueActions}>
                  <button
                    style={{ ...S.btn, ...S.btnGreen }}
                    disabled={actionLoading === item.id}
                    onClick={() => handleReviewReport(item.id, 'confirmed_false_positive')}
                  >
                    Confirm False Positive
                  </button>
                  <button
                    style={{ ...S.btn, ...S.btnOutline }}
                    disabled={actionLoading === item.id}
                    onClick={() => handleReviewReport(item.id, 'upheld')}
                  >
                    Uphold Original
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Boundary review queue */}
      {!loading && tab === 'boundary-review' && (
        queueData.length === 0 ? (
          <div style={S.emptyState}>No boundaries pending review.</div>
        ) : (
          <div style={S.cardList}>
            {queueData.map((item) => (
              <div key={item.id} style={S.queueCard}>
                <div style={S.queueRow}>
                  <span style={S.queueId}>Boundary {shortId(item.id)}</span>
                  <span style={S.queueDate}>{formatDate(item.createdAt ?? item.created_at)}</span>
                </div>
                <div style={S.queueDetail}>
                  Farm: {shortId(item.profileId ?? item.profile_id)} | Points: {item.pointCount ?? item.point_count ?? '-'} | Confidence: {item.boundaryConfidence ?? item.boundary_confidence ?? '-'}% | Reason: {item.validationReason ?? item.validation_reason ?? '-'}
                </div>
                <div style={S.queueActions}>
                  <button
                    style={{ ...S.btn, ...S.btnGreen }}
                    disabled={actionLoading === item.id}
                    onClick={() => handleAutoValidate(item.id)}
                  >
                    Auto-Validate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Alert review queue */}
      {!loading && tab === 'alert-review' && (
        queueData.length === 0 ? (
          <div style={S.emptyState}>No alerts pending review.</div>
        ) : (
          <div style={S.cardList}>
            {queueData.map((item) => (
              <div key={item.id} style={S.queueCard}>
                <div style={S.queueRow}>
                  <span style={S.queueId}>Alert {shortId(item.id)}</span>
                  <span style={{ ...S.badge, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}>
                    {item.alertLevel ?? item.alert_level ?? '-'}
                  </span>
                  <span style={S.queueDate}>{formatDate(item.createdAt ?? item.created_at)}</span>
                </div>
                <div style={S.queueDetail}>
                  Target: {shortId(item.targetId ?? item.target_id)} | Confidence: {item.confidenceScore ?? item.confidence_score ?? '-'}% | {item.alertMessage ?? item.alert_message ?? ''}
                </div>
                <div style={S.queueActions}>
                  <button
                    style={{ ...S.btn, ...S.btnRed }}
                    disabled={actionLoading === item.id}
                    onClick={() => handleSuppressAlert(item.id)}
                  >
                    Suppress
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const S = {
  page: { padding: '1.5rem', color: '#fff', minHeight: '100vh' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' },
  subtitle: { color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem' },
  tabRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  tabBtn: {
    padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: '#94A3B8', fontSize: '0.85rem', fontWeight: 600,
    cursor: 'pointer', minHeight: '40px',
  },
  tabActive: {
    background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderColor: '#22C55E',
  },
  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem',
  },
  summaryCard: {
    background: '#1E293B', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)',
  },
  summaryLabel: { fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryValue: { fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem' },
  cardList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  queueCard: {
    background: '#1E293B', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)',
  },
  queueRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' },
  queueId: { fontWeight: 600, fontSize: '0.9rem' },
  queueDate: { fontSize: '0.75rem', color: '#64748B', marginLeft: 'auto' },
  queueDetail: { fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.75rem', lineHeight: 1.5 },
  queueActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  btn: {
    padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', minHeight: '32px',
  },
  btnGreen: { background: '#22C55E', color: '#fff' },
  btnRed: { background: '#EF4444', color: '#fff' },
  btnOutline: { background: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.15)' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 },
  errorBanner: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px',
    padding: '0.75rem 1rem', color: '#FCA5A5', marginBottom: '1rem', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  retryBtn: {
    background: 'rgba(252,165,165,0.15)', border: '1px solid #FCA5A5', borderRadius: '6px',
    color: '#FCA5A5', fontSize: '0.8rem', fontWeight: 600, padding: '6px 14px', cursor: 'pointer',
  },
  emptyState: { textAlign: 'center', padding: '3rem 1rem', color: '#64748B' },
  spinner: {
    display: 'inline-block', width: 24, height: 24, border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },
};
