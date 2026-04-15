/**
 * FarmEconomicsCard — farm profit tracking, cost logging, and economics summary.
 *
 * Fetches economics from GET /api/v2/farm-costs/:farmId/economics.
 * Fetches cost records from GET /api/v2/farm-costs/:farmId.
 * Inline form to log a new cost record.
 * Shows: Total Revenue, Total Costs, Estimated Profit, cost breakdown.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmCosts, createFarmCost, getFarmEconomics } from '../lib/api.js';

const COST_CATEGORIES = [
  'seeds', 'fertilizer', 'pesticide', 'herbicide', 'labor',
  'irrigation', 'transport', 'storage', 'equipment', 'land_preparation', 'other',
];

const CATEGORY_ICONS = {
  seeds: '\uD83C\uDF31',
  fertilizer: '\uD83E\uDDEA',
  pesticide: '\uD83D\uDC1B',
  herbicide: '\uD83C\uDF3F',
  labor: '\uD83D\uDC68\u200D\uD83C\uDF3E',
  irrigation: '\uD83D\uDCA7',
  transport: '\uD83D\uDE9A',
  storage: '\uD83C\uDFE0',
  equipment: '\u2699\uFE0F',
  land_preparation: '\uD83D\uDE9C',
  other: '\uD83D\uDCCB',
};

export default function FarmEconomicsCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();

  const [economics, setEconomics] = useState(null);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showCosts, setShowCosts] = useState(false);
  const prevFarmIdRef = useRef(null);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'seeds',
    description: '',
    amount: '',
    currency: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      category: 'seeds',
      description: '',
      amount: '',
      currency: '',
      notes: '',
    });
    setFormError(null);
  };

  const fetchData = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const [ecoData, costData] = await Promise.all([
        getFarmEconomics(farmId),
        getFarmCosts(farmId),
      ]);
      setEconomics(ecoData.economics || null);
      setCosts(costData.records || []);
    } catch (err) {
      console.error('Failed to fetch farm economics:', err);
      setError(err.message || 'Failed to load economics');
      setEconomics(null);
      setCosts([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setEconomics(null);
      setCosts([]);
      prevFarmIdRef.current = currentFarmId;
      fetchData(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchData(currentFarmId);
    }
  }, [currentFarmId, fetchData]);

  const handleSubmit = async () => {
    if (!currentFarmId || submitting) return;
    setFormError(null);

    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt < 0) {
      setFormError(t('economics.errorAmount'));
      return;
    }
    if (!form.date) {
      setFormError(t('economics.errorDate'));
      return;
    }
    if (!form.description.trim()) {
      setFormError(t('economics.errorDescription'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        farmId: currentFarmId,
        date: form.date,
        category: form.category,
        description: form.description.trim(),
        amount: amt,
      };
      if (form.currency) payload.currency = form.currency;
      if (form.notes) payload.notes = form.notes;

      await createFarmCost(payload);
      resetForm();
      setShowForm(false);
      fetchData(currentFarmId);
    } catch (err) {
      console.error('Failed to create cost record:', err);
      setFormError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="farm-economics-card">
        <h3 style={S.title}>{t('economics.title')}</h3>
        <div style={S.loadingText}>{t('economics.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="farm-economics-card">
        <h3 style={S.title}>{t('economics.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  const hasEconomics = economics != null;
  const profitPositive = economics?.estimatedProfit != null && economics.estimatedProfit >= 0;
  const profitNegative = economics?.estimatedProfit != null && economics.estimatedProfit < 0;
  const breakdown = economics?.categoryBreakdown || {};
  const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div style={S.card} data-testid="farm-economics-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('economics.title')}</h3>
        {costs.length > 0 && (
          <span style={S.countBadge}>{costs.length} {t('economics.costs')}</span>
        )}
      </div>

      {/* ─── Economics summary ────────────────── */}
      {hasEconomics && (economics.totalRevenue != null || economics.totalCosts > 0) && (
        <div style={S.metricsRow}>
          <div style={S.metricBox}>
            <div style={S.metricValue}>
              {economics.totalRevenue != null ? economics.totalRevenue.toLocaleString() : '--'}
            </div>
            <div style={S.metricLabel}>{t('economics.revenue')}</div>
            {economics.revenueIsPartial && (
              <div style={S.partialTag}>{t('economics.partial')}</div>
            )}
          </div>
          <div style={S.metricBox}>
            <div style={S.metricValueCost}>{economics.totalCosts.toLocaleString()}</div>
            <div style={S.metricLabel}>{t('economics.totalCosts')}</div>
          </div>
          <div style={S.metricBox}>
            <div style={{
              ...S.metricValueProfit,
              color: profitPositive ? '#86EFAC' : profitNegative ? '#FCA5A5' : 'rgba(255,255,255,0.4)',
            }}>
              {economics.estimatedProfit != null
                ? `${economics.estimatedProfit >= 0 ? '+' : ''}${economics.estimatedProfit.toLocaleString()}`
                : '--'
              }
            </div>
            <div style={S.metricLabel}>{t('economics.profit')}</div>
          </div>
        </div>
      )}

      {/* ─── Cost breakdown ───────────────────── */}
      {breakdownEntries.length > 0 && (
        <div style={S.breakdownSection}>
          <div style={S.breakdownTitle}>{t('economics.costBreakdown')}</div>
          {breakdownEntries.map(([cat, amt]) => (
            <div key={cat} style={S.breakdownRow}>
              <div style={S.breakdownLeft}>
                <span style={S.catIcon}>{CATEGORY_ICONS[cat] || '\uD83D\uDCCB'}</span>
                <span style={S.catName}>{t(`economics.cat.${cat}`) || cat}</span>
              </div>
              <span style={S.breakdownAmt}>{amt.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty state ──────────────────────── */}
      {costs.length === 0 && !showForm && (!hasEconomics || economics.totalCosts === 0) && (
        <div style={S.emptyState}>
          <span style={S.emptyIcon}>💰</span>
          <div style={S.emptyText}>{t('economics.noRecords')}</div>
          <div style={S.emptyHint}>{t('economics.noRecordsHint')}</div>
        </div>
      )}

      {/* ─── Add cost button ──────────────────── */}
      {!showForm && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={S.addBtn}
          data-testid="add-cost-btn"
        >
          <span>+</span>
          <span>{t('economics.addCost')}</span>
        </button>
      )}

      {/* ─── Inline form ──────────────────────── */}
      {showForm && (
        <div style={S.formWrap} data-testid="cost-form">
          <div style={S.formTitle}>{t('economics.formTitle')}</div>

          {formError && <div style={S.formError}>{formError}</div>}

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('economics.date')} *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={S.input}
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('economics.category')} *</label>
            <div style={S.catGrid}>
              {COST_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  style={{
                    ...S.catChip,
                    ...(form.category === c ? S.catChipActive : {}),
                  }}
                >
                  <span>{CATEGORY_ICONS[c]}</span>
                  <span style={S.catLabel}>{t(`economics.cat.${c}`) || c}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('economics.description')} *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('economics.descPlaceholder')}
              style={S.input}
            />
          </div>

          <div style={S.fieldRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('economics.amount')} *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                style={S.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('economics.currency')}</label>
              <div style={S.chipRow}>
                {['GHS', 'NGN', 'KES', 'TZS', 'USD', 'XOF'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, currency: form.currency === c ? '' : c })}
                    style={{
                      ...S.tapChipSmall,
                      ...(form.currency === c ? S.tapChipActive : {}),
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('economics.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('economics.notesPlaceholder')}
              rows={2}
              style={{ ...S.input, resize: 'vertical' }}
            />
          </div>

          <div style={S.formActions}>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={S.cancelBtn}>
              {t('economics.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={submitting} style={S.saveBtn}>
              {submitting ? t('economics.saving') : t('economics.save')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Cost history toggle ──────────────── */}
      {costs.length > 0 && (
        <div style={S.historySection}>
          <button
            onClick={() => setShowCosts(!showCosts)}
            style={S.historyToggle}
          >
            {showCosts ? t('economics.hideHistory') : t('economics.showHistory')}
            <span style={{ marginLeft: '0.25rem' }}>{showCosts ? '\u25B2' : '\u25BC'}</span>
          </button>

          {showCosts && costs.map((rec) => (
            <div key={rec.id} style={S.costItem}>
              <div style={S.costHeader}>
                <div style={S.costLeft}>
                  <span style={S.catIcon}>{CATEGORY_ICONS[rec.category] || '\uD83D\uDCCB'}</span>
                  <div>
                    <div style={S.costDesc}>{rec.description}</div>
                    <div style={S.costDate}>{new Date(rec.date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={S.costAmount}>
                  {rec.amount.toLocaleString()} {rec.currency || ''}
                </div>
              </div>
              {rec.notes && <div style={S.costNotes}>{rec.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
    color: '#fff',
  },
  countBadge: {
    fontSize: '0.8125rem',
    color: '#86EFAC',
    fontWeight: 600,
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.75rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    marginTop: '0.75rem',
  },
  // ─── Metrics ─────────────────
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  metricBox: {
    textAlign: 'center',
  },
  metricValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#86EFAC',
  },
  metricValueCost: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#FCA5A5',
  },
  metricValueProfit: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  metricLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.125rem',
  },
  partialTag: {
    fontSize: '0.5625rem',
    color: '#FDBA74',
    fontStyle: 'italic',
    marginTop: '0.125rem',
  },
  // ─── Breakdown ───────────────
  breakdownSection: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    borderRadius: '10px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  breakdownTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.25rem 0',
  },
  breakdownLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  catIcon: {
    fontSize: '0.875rem',
    flexShrink: 0,
  },
  catName: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'capitalize',
  },
  breakdownAmt: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#FCA5A5',
  },
  // ─── Empty state ─────────────
  emptyState: {
    textAlign: 'center',
    marginTop: '1rem',
    padding: '1.25rem',
  },
  emptyIcon: {
    fontSize: '2rem',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.5rem',
  },
  emptyHint: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '0.25rem',
  },
  // ─── Add button ──────────────
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem',
    marginTop: '0.75rem',
    background: 'rgba(34,197,94,0.12)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  // ─── Form ────────────────────
  formWrap: {
    marginTop: '1rem',
    padding: '1rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  formTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#FDE68A',
    marginBottom: '0.75rem',
  },
  formError: {
    fontSize: '0.8125rem',
    color: '#FCA5A5',
    marginBottom: '0.5rem',
    padding: '0.5rem',
    borderRadius: '8px',
    background: 'rgba(239,68,68,0.1)',
  },
  fieldGroup: {
    marginBottom: '0.625rem',
  },
  fieldRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.625rem',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '0.25rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.625rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: '#0F172A',
    color: '#fff',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  },
  catGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  catChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.5rem',
    borderRadius: '8px',
    background: '#0F172A',
    border: '2px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.6875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '32px',
    transition: 'border-color 0.15s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  catChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#86EFAC',
  },
  catLabel: {
    fontSize: '0.6875rem',
    lineHeight: 1.2,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  tapChipSmall: {
    padding: '0.375rem 0.625rem',
    borderRadius: '8px',
    background: '#0F172A',
    border: '2px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '32px',
    transition: 'border-color 0.15s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  tapChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#86EFAC',
  },
  formActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    marginTop: '0.75rem',
  },
  cancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '0.5rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  // ─── History ─────────────────
  historySection: {
    marginTop: '0.75rem',
  },
  historyToggle: {
    width: '100%',
    padding: '0.5rem',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'center',
    marginBottom: '0.5rem',
  },
  costItem: {
    padding: '0.625rem',
    borderRadius: '10px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '0.375rem',
  },
  costHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  costLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
  },
  costDesc: {
    fontSize: '0.8125rem',
    color: '#fff',
    fontWeight: 500,
  },
  costDate: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
  },
  costAmount: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#FCA5A5',
    flexShrink: 0,
  },
  costNotes: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '0.25rem',
    fontStyle: 'italic',
  },
};
