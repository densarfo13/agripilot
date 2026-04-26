/**
 * YieldRecordsCard — harvest yield logging and post-harvest recordkeeping.
 *
 * Fetches records from GET /api/v2/harvest-records/:farmId.
 * Shows summary (total harvested/sold/stored/lost/revenue).
 * Inline form to log a new harvest record.
 * History list of previous records.
 * Farm-scoped: clears and re-fetches when currentFarmId changes.
 * Dark theme, low-literacy friendly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getHarvestRecords, createHarvestRecord } from '../lib/api.js';

const QUANTITY_UNITS = ['kg', 'bags', 'tonnes', 'crates', 'bundles'];
const QUALITY_GRADES = ['A', 'B', 'C', 'poor', 'good', 'excellent'];

export default function YieldRecordsCard() {
  const { currentFarmId, profile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const prevFarmIdRef = useRef(null);

  // Form state
  const [form, setForm] = useState({
    harvestDate: new Date().toISOString().split('T')[0],
    quantityHarvested: '',
    quantityUnit: 'kg',
    quantitySold: '',
    quantityStored: '',
    quantityLost: '',
    averageSellingPrice: '',
    currency: '',
    qualityGrade: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({
      harvestDate: new Date().toISOString().split('T')[0],
      quantityHarvested: '',
      quantityUnit: 'kg',
      quantitySold: '',
      quantityStored: '',
      quantityLost: '',
      averageSellingPrice: '',
      currency: '',
      qualityGrade: '',
      notes: '',
    });
    setFormError(null);
  };

  const fetchRecords = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getHarvestRecords(farmId);
      setRecords(data.records || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch harvest records:', err);
      setError(err.message || 'Failed to load records');
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setRecords([]);
      setSummary(null);
      prevFarmIdRef.current = currentFarmId;
      fetchRecords(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      fetchRecords(currentFarmId);
    }
  }, [currentFarmId, fetchRecords]);

  const handleSubmit = async () => {
    if (!currentFarmId || submitting) return;
    setFormError(null);

    const qty = parseFloat(form.quantityHarvested);
    if (isNaN(qty) || qty < 0) {
      setFormError(t('yield.errorQuantity'));
      return;
    }
    if (!form.harvestDate) {
      setFormError(t('yield.errorDate'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        farmId: currentFarmId,
        cropId: profile?.crop || 'unknown',
        cropLabel: profile?.crop || 'Unknown',
        harvestDate: form.harvestDate,
        quantityHarvested: qty,
        quantityUnit: form.quantityUnit,
      };

      // Optional fields
      if (form.quantitySold !== '') payload.quantitySold = parseFloat(form.quantitySold);
      if (form.quantityStored !== '') payload.quantityStored = parseFloat(form.quantityStored);
      if (form.quantityLost !== '') payload.quantityLost = parseFloat(form.quantityLost);
      if (form.averageSellingPrice !== '') payload.averageSellingPrice = parseFloat(form.averageSellingPrice);
      if (form.currency) payload.currency = form.currency;
      if (form.qualityGrade) payload.qualityGrade = form.qualityGrade;
      if (form.notes) payload.notes = form.notes;

      await createHarvestRecord(payload);
      resetForm();
      setShowForm(false);
      fetchRecords(currentFarmId);
    } catch (err) {
      console.error('Failed to create harvest record:', err);
      setFormError(err.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  if (loading) {
    return (
      <div style={S.card} data-testid="yield-records-card">
        <h3 style={S.title}>{t('yield.title')}</h3>
        <div style={S.loadingText}>{t('yield.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.card} data-testid="yield-records-card">
        <h3 style={S.title}>{t('yield.title')}</h3>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  return (
    <div style={S.card} data-testid="yield-records-card">
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('yield.title')}</h3>
        {records.length > 0 && (
          <span style={S.countBadge}>{records.length} {t('yield.records')}</span>
        )}
      </div>

      {/* ─── Summary ──────────────────────────── */}
      {summary && summary.totalRecords > 0 && (
        <div style={S.summaryGrid}>
          <div style={S.summaryItem}>
            <div style={S.summaryValue}>{summary.totalHarvested}</div>
            <div style={S.summaryLabel}>{t('yield.harvested')} ({summary.dominantUnit})</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryValue}>{summary.totalSold}</div>
            <div style={S.summaryLabel}>{t('yield.sold')}</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryValue}>{summary.totalStored}</div>
            <div style={S.summaryLabel}>{t('yield.stored')}</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryValue}>{summary.totalLost}</div>
            <div style={S.summaryLabel}>{t('yield.lost')}</div>
          </div>
          {summary.estimatedRevenue != null && (
            <div style={{ ...S.summaryItem, gridColumn: '1 / -1' }}>
              <div style={S.revenueValue}>{summary.estimatedRevenue.toLocaleString()}</div>
              <div style={S.summaryLabel}>{t('yield.estimatedRevenue')}</div>
            </div>
          )}
        </div>
      )}

      {/* ─── Empty state ──────────────────────── */}
      {records.length === 0 && !showForm && (
        <div style={S.emptyState}>
          <span style={S.emptyIcon}>📊</span>
          <div style={S.emptyText}>{t('yield.noRecords')}</div>
          <div style={S.emptyHint}>{t('yield.noRecordsHint')}</div>
        </div>
      )}

      {/* ─── Add record button ────────────────── */}
      {!showForm && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={S.addBtn}
          data-testid="add-yield-btn"
        >
          <span>+</span>
          <span>{t('yield.addRecord')}</span>
        </button>
      )}

      {/* ─── Inline form ──────────────────────── */}
      {showForm && (
        <div style={S.formWrap} data-testid="yield-form">
          <div style={S.formTitle}>{t('yield.formTitle')}</div>

          {formError && <div style={S.formError}>{formError}</div>}

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('yield.harvestDate')} *</label>
            <input
              type="date"
              value={form.harvestDate}
              onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
              style={S.input}
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('yield.quantityHarvested')} *</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.quantityHarvested}
              onChange={(e) => setForm({ ...form, quantityHarvested: e.target.value })}
              placeholder="0"
              style={S.input}
            />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('yield.unit')}</label>
            <div style={S.chipRow}>
              {QUANTITY_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setForm({ ...form, quantityUnit: u })}
                  style={{
                    ...S.tapChip,
                    ...(form.quantityUnit === u ? S.tapChipActive : {}),
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div style={S.fieldRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('yield.sold')}</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.quantitySold}
                onChange={(e) => setForm({ ...form, quantitySold: e.target.value })}
                placeholder="0"
                style={S.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('yield.stored')}</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.quantityStored}
                onChange={(e) => setForm({ ...form, quantityStored: e.target.value })}
                placeholder="0"
                style={S.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('yield.lost')}</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.quantityLost}
                onChange={(e) => setForm({ ...form, quantityLost: e.target.value })}
                placeholder="0"
                style={S.input}
              />
            </div>
          </div>

          <div style={S.fieldRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('yield.sellingPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.averageSellingPrice}
                onChange={(e) => setForm({ ...form, averageSellingPrice: e.target.value })}
                placeholder="0"
                style={S.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('yield.currency')}</label>
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
            <label style={S.label}>{t('yield.qualityGrade')}</label>
            <div style={S.chipRow}>
              {QUALITY_GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, qualityGrade: form.qualityGrade === g ? '' : g })}
                  style={{
                    ...S.tapChipSmall,
                    ...(form.qualityGrade === g ? S.tapChipActive : {}),
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{t('yield.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('yield.notesPlaceholder')}
              rows={2}
              style={{ ...S.input, resize: 'vertical' }}
            />
          </div>

          <div style={S.formActions}>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={S.cancelBtn}>
              {t('yield.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={submitting} style={S.saveBtn}>
              {submitting ? t('yield.saving') : t('yield.save')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Records history ──────────────────── */}
      {records.length > 0 && (
        <div style={S.historySection}>
          <div style={S.historyTitle}>{t('yield.history')}</div>
          {records.map((rec) => (
            <div key={rec.id} style={S.recordItem}>
              <div style={S.recordHeader}>
                <div style={S.recordDate}>
                  {new Date(rec.harvestDate).toLocaleDateString()}
                </div>
                <div style={S.recordCrop}>{rec.cropLabel}</div>
              </div>
              <div style={S.recordDetails}>
                <span style={S.recordStat}>
                  {t('yield.harvested')}: {rec.quantityHarvested} {rec.quantityUnit}
                </span>
                {rec.quantitySold != null && (
                  <span style={S.recordStat}>
                    {t('yield.sold')}: {rec.quantitySold}
                  </span>
                )}
                {rec.quantityStored != null && (
                  <span style={S.recordStat}>
                    {t('yield.stored')}: {rec.quantityStored}
                  </span>
                )}
                {rec.quantityLost != null && rec.quantityLost > 0 && (
                  <span style={S.lostStat}>
                    {t('yield.lost')}: {rec.quantityLost}
                  </span>
                )}
              </div>
              {rec.averageSellingPrice != null && (
                <div style={S.recordPrice}>
                  {rec.averageSellingPrice.toLocaleString()} {rec.currency || ''}/{rec.quantityUnit}
                </div>
              )}
              {rec.qualityGrade && (
                <div style={S.recordGrade}>
                  {t('yield.grade')}: {rec.qualityGrade}
                </div>
              )}
              {rec.notes && (
                <div style={S.recordNotes}>{rec.notes}</div>
              )}
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
  // ─── Summary grid ────────────
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  summaryItem: {
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#fff',
  },
  summaryLabel: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '0.125rem',
    textTransform: 'capitalize',
  },
  revenueValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#86EFAC',
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
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  tapChip: {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    background: '#0F172A',
    border: '2px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '36px',
    transition: 'border-color 0.15s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
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
    marginTop: '1rem',
  },
  historyTitle: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.5rem',
  },
  recordItem: {
    padding: '0.75rem',
    borderRadius: '10px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '0.5rem',
  },
  recordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.375rem',
  },
  recordDate: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#fff',
  },
  recordCrop: {
    fontSize: '0.75rem',
    color: '#FDBA74',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  recordDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.625rem',
  },
  recordStat: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
  },
  lostStat: {
    fontSize: '0.75rem',
    color: '#FCA5A5',
  },
  recordPrice: {
    fontSize: '0.75rem',
    color: '#86EFAC',
    marginTop: '0.25rem',
  },
  recordGrade: {
    fontSize: '0.6875rem',
    color: '#93C5FD',
    marginTop: '0.25rem',
  },
  recordNotes: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '0.25rem',
    fontStyle: 'italic',
  },
};
