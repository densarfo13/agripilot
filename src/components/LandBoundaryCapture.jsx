import { useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { saveLandBoundary } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useNetwork } from '../context/NetworkContext.jsx';

const S = {
  container: { padding: '12px 0' },
  title: { fontSize: '16px', fontWeight: 600, marginBottom: '4px' },
  desc: { fontSize: '14px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.4 },
  methodRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
  methodBtn: (active) => ({
    padding: '10px 14px', borderRadius: '8px', border: active ? '2px solid #16a34a' : '1px solid #d1d5db',
    background: active ? '#f0fdf4' : '#fff', fontSize: '14px', cursor: 'pointer',
    fontWeight: active ? 600 : 400, minHeight: '44px', flex: '1 1 45%',
  }),
  pointCount: {
    fontSize: '14px', color: '#374151', padding: '8px 12px', background: '#f3f4f6',
    borderRadius: '8px', marginBottom: '8px', textAlign: 'center',
  },
  actionBtn: {
    padding: '12px 16px', borderRadius: '8px', border: '1px dashed #9ca3af',
    background: '#f9fafb', fontSize: '14px', cursor: 'pointer', width: '100%',
    minHeight: '44px', color: '#374151', marginBottom: '8px',
  },
  saveBtn: (disabled) => ({
    padding: '12px 20px', borderRadius: '8px', border: 'none',
    background: disabled ? '#9ca3af' : '#16a34a', color: '#fff', fontSize: '16px',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%', minHeight: '48px',
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
  savedArea: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '12px', marginTop: '8px', fontSize: '14px', color: '#166534',
  },
  offlineMsg: {
    fontSize: '13px', color: '#92400e', background: '#fef3c7', borderRadius: '8px',
    padding: '10px 12px', marginBottom: '8px', textAlign: 'center',
  },
  warningBox: {
    fontSize: '13px', color: '#92400e', background: '#fef3c7', borderRadius: '8px',
    padding: '10px 12px', marginBottom: '8px', lineHeight: 1.5,
    border: '1px solid #fbbf24',
  },
};

export default function LandBoundaryCapture({ existingBoundary, onSaved, onSkip }) {
  const { isOnline } = useNetwork();
  const [method, setMethod] = useState('gps_walk');
  const [points, setPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [capturingGPS, setCapturingGPS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const watchRef = useRef(null);

  // User chose to skip
  if (dismissed) return null;

  // If boundary already exists, show simple summary
  if (existingBoundary && !points.length && !status) {
    const b = existingBoundary;
    return (
      <div style={S.container}>
        <div style={S.title}>{t('boundary.title')}</div>
        <div style={S.savedArea}>
          {t('boundary.mapped')} — {b.pointCount} {t('boundary.points')}
          {b.measuredArea != null ? `, ${b.measuredArea.toFixed(1)} ha` : ''}
        </div>
      </div>
    );
  }

  const handleSkip = () => {
    setDismissed(true);
    safeTrackEvent('boundary.skipped', {});
    if (onSkip) onSkip();
  };

  const addCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: t('boundary.noGPS') });
      return;
    }
    setCapturingGPS(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoints((prev) => [
          ...prev,
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
        ]);
        setCapturingGPS(false);
        safeTrackEvent('boundary.point_added', { method });
      },
      () => {
        setCapturingGPS(false);
        setStatus({ type: 'error', msg: t('boundary.gpsFailed') });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const startGPSWalk = () => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: t('boundary.noGPS') });
      return;
    }
    if (watchRef.current != null) return;
    setCapturingGPS(true);
    setStatus(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPoints((prev) => [
          ...prev,
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
        ]);
      },
      () => {
        stopGPSWalk();
        setStatus({ type: 'error', msg: t('boundary.gpsFailed') });
      },
      { enableHighAccuracy: true, timeout: 30000 },
    );
  };

  const stopGPSWalk = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setCapturingGPS(false);
  };

  // Boundary quality warnings (computed from points)
  const boundaryWarnings = (() => {
    const warns = [];
    if (points.length > 0 && points.length < 4) {
      warns.push(t('boundary.warnFewPoints') || 'Too few points — walk more of the boundary for better accuracy.');
    }
    const lowAccuracy = points.filter(p => p.accuracy && p.accuracy > 30);
    if (lowAccuracy.length > 0) {
      warns.push(t('boundary.warnLowAccuracy') || `${lowAccuracy.length} point(s) have low GPS accuracy. Move to open sky and retry.`);
    }
    // Check for duplicate/very-close points
    if (points.length >= 2) {
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      const dist = Math.abs(last.latitude - prev.latitude) + Math.abs(last.longitude - prev.longitude);
      if (dist < 0.00001) {
        warns.push(t('boundary.warnDuplicate') || 'Last point is very close to previous — move further before adding another.');
      }
    }
    return warns;
  })();

  const handleSave = async () => {
    if (points.length < 3) {
      setStatus({ type: 'error', msg: t('boundary.minPoints') });
      return;
    }
    if (!isOnline) {
      setStatus({ type: 'error', msg: t('boundary.offlineSave') });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const data = await saveLandBoundary({ captureMethod: method, points });
      const boundary = data?.boundary || data;
      // Show validation feedback from server if available
      if (boundary?.validationStatus === 'failed' || boundary?.validationStatus === 'review_needed') {
        setStatus({ type: 'error', msg: boundary.validationReason || t('boundary.validationFailed') || 'Boundary validation failed — try redrawing with more points.' });
        safeTrackEvent('boundary.validation_warning', { status: boundary.validationStatus });
      } else {
        setStatus({ type: 'success', msg: t('boundary.saved') });
      }
      safeTrackEvent('boundary.saved', { method, pointCount: points.length });
      if (onSaved) onSaved(boundary);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || t('boundary.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const methods = [
    { key: 'gps_walk', label: t('boundary.methodWalk') },
    { key: 'manual_pin', label: t('boundary.methodPin') },
    { key: 'fallback_pin', label: t('boundary.methodFallback') },
  ];

  return (
    <div style={S.container}>
      <div style={S.title}>{t('boundary.title')}</div>
      <div style={S.desc}>{t('boundary.desc')}</div>

      {!isOnline && (
        <div style={S.offlineMsg}>{t('boundary.offlineHint')}</div>
      )}

      <div style={S.methodRow}>
        {methods.map((m) => (
          <button key={m.key} style={S.methodBtn(method === m.key)} onClick={() => { setMethod(m.key); stopGPSWalk(); }}>
            {m.label}
          </button>
        ))}
      </div>

      {method === 'gps_walk' && !capturingGPS && (
        <button style={S.actionBtn} onClick={startGPSWalk}>{t('boundary.startWalk')}</button>
      )}
      {method === 'gps_walk' && capturingGPS && (
        <button style={{ ...S.actionBtn, borderColor: '#ef4444', color: '#ef4444' }} onClick={stopGPSWalk}>
          {t('boundary.stopWalk')}
        </button>
      )}

      {method !== 'gps_walk' && (
        <button style={S.actionBtn} onClick={addCurrentLocation} disabled={capturingGPS}>
          {capturingGPS ? t('boundary.gettingGPS') : t('boundary.addPoint')}
        </button>
      )}

      {/* Simple point count — no raw coordinates shown to farmer */}
      {points.length > 0 && (
        <div style={S.pointCount}>
          {points.length} {t('boundary.points')} {t('boundary.recorded')}
        </div>
      )}

      {/* Boundary quality warnings */}
      {boundaryWarnings.length > 0 && (
        <div style={S.warningBox}>
          {boundaryWarnings.map((w, i) => (
            <div key={i} style={{ marginBottom: i < boundaryWarnings.length - 1 ? '4px' : 0 }}>{w}</div>
          ))}
        </div>
      )}

      <button style={S.saveBtn(saving || points.length < 3)} onClick={handleSave} disabled={saving || points.length < 3}>
        {saving ? t('boundary.saving') : t('boundary.saveBoundary')}
      </button>

      {status && (
        <div style={{ ...S.status, ...(status.type === 'success' ? S.success : S.error) }}>
          {status.msg}
        </div>
      )}

      <button style={S.skipBtn} onClick={handleSkip}>
        {t('boundary.skip')}
      </button>
    </div>
  );
}
