import { useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { saveSeedScan } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import VoiceBar from './VoiceBar.jsx';

const SEED_TYPES = ['maize', 'rice', 'cassava', 'tomato', 'pepper', 'cocoa', 'yam', 'plantain', 'sorghum', 'millet'];

// Translate raw authenticity codes into simple farmer-friendly labels
function friendlyAuthLabel(auth) {
  if (auth === 'verified') return t('seedScan.statusOk');
  if (auth === 'warning') return t('seedScan.statusCheck');
  if (auth === 'failed') return t('seedScan.statusProblem');
  return t('seedScan.statusPending');
}

function badgeColor(auth) {
  if (auth === 'verified') return { bg: '#dcfce7', fg: '#166534' };
  if (auth === 'warning') return { bg: '#fef3c7', fg: '#92400e' };
  if (auth === 'failed') return { bg: '#fee2e2', fg: '#991b1b' };
  return { bg: '#f3f4f6', fg: '#6b7280' };
}

const S = {
  container: { padding: '12px 0' },
  title: { fontSize: '16px', fontWeight: 600, marginBottom: '4px' },
  desc: { fontSize: '14px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.4 },
  scanBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px 16px', borderRadius: '10px', border: '2px dashed #9ca3af',
    background: '#f9fafb', fontSize: '15px', cursor: 'pointer', width: '100%',
    minHeight: '52px', color: '#374151', marginBottom: '10px',
  },
  orText: { textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: '6px 0' },
  fieldGroup: { marginBottom: '10px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
    fontSize: '16px', minHeight: '44px', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
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
  scanList: { listStyle: 'none', padding: 0, margin: '8px 0' },
  scanItem: {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
    marginBottom: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  badge: (auth) => {
    const c = badgeColor(auth);
    return {
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: 600, background: c.bg, color: c.fg,
    };
  },
  offlineMsg: {
    fontSize: '13px', color: '#92400e', background: '#fef3c7', borderRadius: '8px',
    padding: '10px 12px', marginBottom: '8px', textAlign: 'center',
  },
};

export default function SeedScanFlow({ existingScans, onSaved, onSkip }) {
  const { isOnline } = useNetwork();
  const [step, setStep] = useState('choose'); // choose | manual | done
  const [form, setForm] = useState({ seedType: '', variety: '', supplier: '', batchNumber: '', expiryDate: '' });
  const [rawScanData, setRawScanData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const fileRef = useRef(null);

  // User chose to skip
  if (dismissed) return null;

  const handleSkip = () => {
    setDismissed(true);
    safeTrackEvent('seed_scan.skipped', {});
    if (onSkip) onSkip();
  };

  const handleScanAttempt = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFileCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawScanData(`image_capture_${Date.now()}`);
    setStep('manual');
    safeTrackEvent('seed_scan.camera_used', {});
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.seedType) {
      setStatus({ type: 'error', msg: t('seedScan.seedTypeRequired') });
      return;
    }
    if (!isOnline) {
      setStatus({ type: 'error', msg: t('seedScan.offlineSave') });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        scanMethod: rawScanData ? 'barcode' : 'manual',
        seedType: form.seedType,
        variety: form.variety || undefined,
        supplier: form.supplier || undefined,
        batchNumber: form.batchNumber || undefined,
        expiryDate: form.expiryDate || undefined,
        rawScanData: rawScanData || undefined,
      };
      const data = await saveSeedScan(payload);
      setStatus({ type: 'success', msg: t('seedScan.saved') });
      setStep('done');
      safeTrackEvent('seed_scan.saved', { method: payload.scanMethod, seedType: form.seedType });
      if (onSaved) onSaved(data.scan);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || t('seedScan.saveFailed') });
      trackPilotEvent('seed_scan_failed', { error: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    setStep('choose');
    setForm({ seedType: '', variety: '', supplier: '', batchNumber: '', expiryDate: '' });
    setRawScanData(null);
    setStatus(null);
  };

  // Existing scans summary — farmer-friendly labels, no raw codes
  const scansList = existingScans?.length > 0 && (
    <ul style={S.scanList}>
      {existingScans.map((s) => (
        <li key={s.id} style={S.scanItem}>
          <span><strong>{s.seedType ? s.seedType.charAt(0).toUpperCase() + s.seedType.slice(1) : t('seedScan.unknown')}</strong>
          {s.variety ? ` — ${s.variety}` : ''}</span>
          <span style={S.badge(s.authenticity)}>{friendlyAuthLabel(s.authenticity)}</span>
        </li>
      ))}
    </ul>
  );

  if (step === 'done') {
    return (
      <div style={S.container}>
        <div style={S.title}>{t('seedScan.title')}</div>
        {scansList}
        {status && <div style={{ ...S.status, ...S.success }}>{status.msg}</div>}
        <button style={{ ...S.scanBtn, borderColor: '#16a34a', color: '#16a34a' }} onClick={resetFlow}>
          {t('seedScan.scanAnother')}
        </button>
        <button style={S.skipBtn} onClick={handleSkip}>
          {t('seedScan.skip')}
        </button>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.title}>{t('seedScan.title')}</div>
      <VoiceBar voiceKey={step === 'done' ? 'seedScan.result' : (step === 'manual' ? 'seedScan.takePhoto' : 'seedScan.start')} compact />
      <div style={S.desc}>{t('seedScan.desc')}</div>

      {!isOnline && (
        <div style={S.offlineMsg}>{t('seedScan.offlineHint')}</div>
      )}

      {scansList}

      {step === 'choose' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileCapture}
          />
          <button style={S.scanBtn} onClick={handleScanAttempt}>
            {t('seedScan.scanPacket')}
          </button>
          <div style={S.orText}>{t('seedScan.or')}</div>
          <button style={{ ...S.scanBtn, borderStyle: 'solid' }} onClick={() => setStep('manual')}>
            {t('seedScan.enterManually')}
          </button>
        </>
      )}

      {step === 'manual' && (
        <>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('seedScan.seedTypeLabel')}</label>
            <select style={S.select} value={form.seedType} onChange={(e) => setField('seedType', e.target.value)}>
              <option value="">{t('seedScan.selectSeed')}</option>
              {SEED_TYPES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('seedScan.varietyLabel')}</label>
            <input style={S.input} value={form.variety} onChange={(e) => setField('variety', e.target.value)} placeholder={t('seedScan.varietyPlaceholder')} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('seedScan.supplierLabel')}</label>
            <input style={S.input} value={form.supplier} onChange={(e) => setField('supplier', e.target.value)} placeholder={t('seedScan.supplierPlaceholder')} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('seedScan.batchLabel')}</label>
            <input style={S.input} value={form.batchNumber} onChange={(e) => setField('batchNumber', e.target.value)} placeholder={t('seedScan.batchPlaceholder')} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>{t('seedScan.expiryLabel')}</label>
            <input style={S.input} type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
          </div>

          <button style={S.saveBtn(saving || !form.seedType)} onClick={handleSave} disabled={saving || !form.seedType}>
            {saving ? t('seedScan.saving') : t('seedScan.save')}
          </button>

          {status && (
            <div style={{ ...S.status, ...(status.type === 'success' ? S.success : S.error) }}>
              {status.msg}
            </div>
          )}
        </>
      )}

      <button style={S.skipBtn} onClick={handleSkip}>
        {t('seedScan.skip')}
      </button>
    </div>
  );
}
