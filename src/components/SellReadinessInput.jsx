import { useState, useEffect } from 'react';
import { t } from '../lib/i18n.js';
import { getMySupplyReadiness, saveSupplyReadiness } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useNetwork } from '../context/NetworkContext.jsx';

const UNIT_OPTIONS = ['kg', 'bags', 'tonnes', 'crates'];

export default function SellReadinessInput({ onSkip, onSaved }) {
  const { isOnline } = useNetwork();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [readyToSell, setReadyToSell] = useState(null); // null = unanswered
  const [estimatedQuantity, setEstimatedQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('kg');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');

  // Load existing supply readiness
  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    getMySupplyReadiness()
      .then((data) => {
        if (data.supply) {
          setReadyToSell(data.supply.readyToSell);
          setEstimatedQuantity(data.supply.estimatedQuantity || '');
          setQuantityUnit(data.supply.quantityUnit || 'kg');
          setExpectedHarvestDate(
            data.supply.expectedHarvestDate
              ? data.supply.expectedHarvestDate.split('T')[0]
              : '',
          );
          setQualityNotes(data.supply.qualityNotes || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOnline]);

  if (dismissed) return null;

  const handleSkip = () => {
    setDismissed(true);
    safeTrackEvent('supply_readiness.skipped', {});
    if (onSkip) onSkip();
  };

  const handleSave = async () => {
    if (!isOnline) {
      setError(t('supply.offlineSave'));
      return;
    }
    if (readyToSell === null) {
      setError(t('supply.readyRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        readyToSell,
        estimatedQuantity: estimatedQuantity ? Number(estimatedQuantity) : null,
        quantityUnit,
        expectedHarvestDate: expectedHarvestDate || null,
        qualityNotes: qualityNotes || null,
      };
      const data = await saveSupplyReadiness(payload);
      setSuccess(true);
      safeTrackEvent('supply_readiness.saved', { readyToSell });
      if (onSaved) onSaved(data.supply);
    } catch (err) {
      setError(err.message || t('supply.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={S.container}>
      <div style={S.title}>{t('supply.title')}</div>
      <div style={S.desc}>{t('supply.desc')}</div>

      {!isOnline && (
        <div style={S.offlineHint}>{t('supply.offlineHint')}</div>
      )}

      {/* Ready to sell? — big tap targets */}
      <div style={S.label}>{t('supply.readyQuestion')}</div>
      <div style={S.toggleRow}>
        <button
          style={S.toggleBtn(readyToSell === true)}
          onClick={() => setReadyToSell(true)}
          type="button"
        >
          {t('common.yes')}
        </button>
        <button
          style={S.toggleBtn(readyToSell === false)}
          onClick={() => setReadyToSell(false)}
          type="button"
        >
          {t('common.no')}
        </button>
      </div>

      {readyToSell === true && (
        <>
          {/* Quantity */}
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('supply.quantity')}</label>
            <div style={S.row}>
              <input
                type="number"
                inputMode="numeric"
                style={{ ...S.input, flex: 1 }}
                value={estimatedQuantity}
                onChange={(e) => setEstimatedQuantity(e.target.value)}
                placeholder="100"
              />
              <select
                style={S.select}
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expected harvest date */}
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('supply.harvestDate')}</label>
            <input
              type="date"
              style={S.input}
              value={expectedHarvestDate}
              onChange={(e) => setExpectedHarvestDate(e.target.value)}
            />
          </div>

          {/* Quality notes (optional) */}
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('supply.qualityNotes')}</label>
            <input
              type="text"
              style={S.input}
              value={qualityNotes}
              onChange={(e) => setQualityNotes(e.target.value)}
              placeholder={t('supply.qualityPlaceholder')}
              maxLength={200}
            />
          </div>
        </>
      )}

      {/* Save button */}
      <button
        style={S.saveBtn(saving || readyToSell === null)}
        onClick={handleSave}
        disabled={saving || readyToSell === null}
        type="button"
      >
        {saving ? t('common.save') + '...' : t('common.save')}
      </button>

      {success && <div style={{ ...S.status, ...S.success }}>{t('supply.saved')}</div>}
      {error && <div style={{ ...S.status, ...S.error }}>{error}</div>}

      {/* Skip — always visible (RULE 2) */}
      <button style={S.skipBtn} onClick={handleSkip} type="button">
        {t('supply.skip')}
      </button>
    </div>
  );
}

const S = {
  container: { padding: '12px 0' },
  title: { fontSize: '16px', fontWeight: 600, marginBottom: '4px' },
  desc: { fontSize: '14px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.4 },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' },
  toggleRow: { display: 'flex', gap: '10px', marginBottom: '12px' },
  toggleBtn: (active) => ({
    flex: 1, padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
    minHeight: '48px', cursor: 'pointer', border: '2px solid',
    borderColor: active ? '#16a34a' : '#d1d5db',
    background: active ? '#dcfce7' : '#f9fafb',
    color: active ? '#166534' : '#374151',
  }),
  fieldGroup: { marginBottom: '10px' },
  row: { display: 'flex', gap: '8px' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
    fontSize: '16px', minHeight: '44px', boxSizing: 'border-box',
  },
  select: {
    width: '110px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
    fontSize: '16px', minHeight: '44px', background: '#fff', boxSizing: 'border-box',
  },
  saveBtn: (disabled) => ({
    padding: '12px 20px', borderRadius: '8px', border: 'none',
    background: disabled ? '#9ca3af' : '#16a34a', color: '#fff', fontSize: '16px',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%', minHeight: '48px', marginTop: '8px',
  }),
  skipBtn: {
    padding: '10px 16px', borderRadius: '8px', border: 'none',
    background: 'transparent', color: '#6b7280', fontSize: '14px',
    cursor: 'pointer', width: '100%', minHeight: '44px', marginTop: '6px',
    textDecoration: 'underline',
  },
  status: { fontSize: '13px', marginTop: '8px', textAlign: 'center' },
  success: { color: '#16a34a' },
  error: { color: '#dc2626' },
  offlineHint: {
    fontSize: '13px', color: '#f59e0b', background: '#fefce8', borderRadius: '8px',
    padding: '8px 12px', marginBottom: '10px',
  },
};
