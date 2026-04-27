/**
 * OutbreakReportModal — 3-step pest/disease report wizard.
 *
 *   Step 1: Issue type    (Pest / Disease / Not sure)
 *   Step 2: Severity      (Low / Medium / High)
 *   Step 3: Symptoms (chips, multi-select) + notes + optional
 *           photo, then Save.
 *
 * On Save we call `saveOutbreakReport` from outbreakStore. The
 * store handles IDB + mirror + outbox; the modal just drives the
 * UI. Empty state on close.
 *
 * Strict-rule audit:
 *   * never crashes on missing props (every input coerced)
 *   * works offline (saveOutbreakReport is local-first)
 *   * uses tSafe for every visible label per the strict rule
 *   * cropLabel resolved via getCropLabelSafe(code, lang)
 *   * inline styles match the codebase
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropLabelSafe } from '../../utils/crops.js';
import { saveOutbreakReport } from '../../outbreak/outbreakStore.js';

const ISSUES = [
  { id: 'pest',    icon: '\uD83D\uDC1B', key: 'outbreak.issuePest'    },
  { id: 'disease', icon: '\uD83C\uDF42', key: 'outbreak.issueDisease' },
  { id: 'unknown', icon: '\u2754',       key: 'outbreak.issueUnknown' },
];

const SEVERITIES = [
  { id: 'low',    color: '#22C55E', key: 'outbreak.severityLow'    },
  { id: 'medium', color: '#F59E0B', key: 'outbreak.severityMedium' },
  { id: 'high',   color: '#EF4444', key: 'outbreak.severityHigh'   },
];

const SYMPTOMS = [
  { id: 'yellow_leaves', key: 'outbreak.symptomYellowLeaves' },
  { id: 'leaf_holes',    key: 'outbreak.symptomLeafHoles'    },
  { id: 'wilting',       key: 'outbreak.symptomWilting'      },
  { id: 'spots',         key: 'outbreak.symptomSpots'        },
  { id: 'insects',       key: 'outbreak.symptomInsects'      },
];

export default function OutbreakReportModal({
  open       = false,
  onClose    = null,
  onSaved    = null,
  farm       = null,
  farmerId   = null,
}) {
  const { lang } = useTranslation();

  const [step, setStep]         = useState(1);
  const [issue, setIssue]       = useState(null);
  const [severity, setSeverity] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes]       = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const cropLabel = useMemo(() => {
    if (!farm) return '';
    const code = farm.crop || farm.cropType || '';
    return getCropLabelSafe(code, lang) || code || '';
  }, [farm, lang]);

  if (!open) return null;

  function reset() {
    setStep(1); setIssue(null); setSeverity(null);
    setSymptoms([]); setNotes(''); setPhotoUrl(null);
    setBusy(false); setSavedMsg('');
  }

  function handleClose() {
    reset();
    if (typeof onClose === 'function') onClose();
  }

  function toggleSymptom(id) {
    setSymptoms((prev) => prev.includes(id)
      ? prev.filter((s) => s !== id)
      : [...prev, id]);
  }

  function handlePhotoChange(e) {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        // Soft cap: refuse to store > ~250KB so IDB writes don't
        // hit quota on low-end devices. We still accept the
        // sighting; we just drop the photo blob.
        if (url.length > 250 * 1024) {
          setPhotoUrl(null);
        } else {
          setPhotoUrl(url);
        }
      };
      reader.onerror = () => setPhotoUrl(null);
      reader.readAsDataURL(file);
    } catch { setPhotoUrl(null); }
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    try {
      const record = await saveOutbreakReport({
        farmId:    farm && farm.id ? farm.id : null,
        farmerId,
        crop:      farm && (farm.crop || farm.cropType) ? (farm.crop || farm.cropType) : null,
        issueType: issue || 'unknown',
        severity:  severity || 'low',
        symptoms,
        notes,
        location:  {
          country:  farm && farm.country  ? farm.country  : '',
          region:   farm && (farm.region || farm.stateCode) ? (farm.region || farm.stateCode) : '',
          district: farm && farm.district ? farm.district : '',
          lat:      farm && farm.lat ? farm.lat : null,
          lng:      farm && farm.lng ? farm.lng : null,
        },
        photoUrl,
      });
      setSavedMsg(tSafe('outbreak.reportSaved',
        'Report saved. We will warn nearby farmers if more reports appear.'));
      if (typeof onSaved === 'function') {
        try { onSaved(record); } catch { /* swallow */ }
      }
      // Auto-close after a moment so the farmer sees the
      // confirmation but isn't trapped on the screen.
      setTimeout(handleClose, 1800);
    } catch {
      // saveOutbreakReport itself swallows; if we got here, just
      // unlock the button.
      setBusy(false);
    }
  }

  const canNext1 = !!issue;
  const canNext2 = !!severity;
  const canSave  = !busy;

  return (
    <div role="dialog" aria-modal="true" style={S.backdrop} onClick={handleClose}
         data-testid="outbreak-report-modal">
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <header style={S.header}>
          <h2 style={S.h2}>{tSafe('outbreak.reportTitle', 'Report pest or disease')}</h2>
          {cropLabel && <span style={S.crop}>{cropLabel}</span>}
          <button type="button" onClick={handleClose} style={S.close} aria-label="close">{'\u2715'}</button>
        </header>

        {/* Confirmation state takes over the body once saved. */}
        {savedMsg ? (
          <div style={S.savedBlock} data-testid="outbreak-report-saved">
            <span style={S.savedIcon} aria-hidden="true">{'\u2713'}</span>
            <p style={S.savedMsg}>{savedMsg}</p>
          </div>
        ) : (
          <>
            {/* ─── Step 1: issue type ─────────────────────────── */}
            {step === 1 && (
              <section style={S.body}>
                <p style={S.lede}>
                  {tSafe('outbreak.reportTitle', 'Report pest or disease')}
                </p>
                <div style={S.tileGrid}>
                  {ISSUES.map((it) => (
                    <button key={it.id} type="button"
                      onClick={() => setIssue(it.id)}
                      style={{ ...S.tile, ...(issue === it.id ? S.tileActive : null) }}
                      data-testid={`outbreak-issue-${it.id}`}
                    >
                      <span style={S.tileIcon} aria-hidden="true">{it.icon}</span>
                      <span style={S.tileLabel}>{tSafe(it.key, '')}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Step 2: severity ───────────────────────────── */}
            {step === 2 && (
              <section style={S.body}>
                <p style={S.lede}>
                  {tSafe('outbreak.symptomsTitle', 'How bad is it?')}
                </p>
                <div style={S.tileGrid}>
                  {SEVERITIES.map((sv) => (
                    <button key={sv.id} type="button"
                      onClick={() => setSeverity(sv.id)}
                      style={{
                        ...S.tile,
                        ...(severity === sv.id ? S.tileActive : null),
                        borderColor: severity === sv.id ? sv.color : 'rgba(255,255,255,0.12)',
                      }}
                      data-testid={`outbreak-severity-${sv.id}`}
                    >
                      <span style={{ ...S.dot, background: sv.color }} aria-hidden="true" />
                      <span style={S.tileLabel}>{tSafe(sv.key, '')}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Step 3: symptoms + notes + photo ───────────── */}
            {step === 3 && (
              <section style={S.body}>
                <p style={S.lede}>{tSafe('outbreak.symptomsTitle', 'What are you seeing?')}</p>
                <div style={S.chipRow}>
                  {SYMPTOMS.map((sx) => {
                    const on = symptoms.includes(sx.id);
                    return (
                      <button key={sx.id} type="button"
                        onClick={() => toggleSymptom(sx.id)}
                        style={{ ...S.chip, ...(on ? S.chipActive : null) }}
                        aria-pressed={on}
                        data-testid={`outbreak-symptom-${sx.id}`}
                      >
                        {tSafe(sx.key, '')}
                      </button>
                    );
                  })}
                </div>

                <label style={S.label}>
                  <span style={S.labelText}>{tSafe('outbreak.notes', 'Notes (optional)')}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={S.textarea}
                    rows={2}
                    data-testid="outbreak-notes"
                  />
                </label>

                <label style={S.photoBtn}>
                  <span style={S.photoIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
                  <span>{photoUrl
                    ? tSafe('outbreak.addPhoto', 'Photo added')
                    : tSafe('outbreak.addPhoto', 'Add photo')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                    data-testid="outbreak-photo-input"
                  />
                </label>
              </section>
            )}
          </>
        )}

        {!savedMsg && (
          <footer style={S.footer}>
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} style={S.secondary}
                data-testid="outbreak-back">
                {'\u2190'}
              </button>
            )}
            {step < 3 && (
              <button type="button"
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
                style={S.primary}
                data-testid="outbreak-next"
              >
                {'\u2192'}
              </button>
            )}
            {step === 3 && (
              <button type="button"
                onClick={handleSave}
                disabled={!canSave}
                style={{ ...S.primary, ...S.primaryWide }}
                data-testid="outbreak-save"
              >
                {busy
                  ? tSafe('common.saving', 'Saving\u2026')
                  : tSafe('outbreak.saveReport', 'Save report')}
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9100,
    background: 'rgba(8,20,35,0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: '32rem',
    background: '#0F2034',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
    padding: '1rem 1.125rem 1.25rem',
    color: '#EAF2FF',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' },
  h2: { margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#EAF2FF', flex: 1 },
  crop: {
    fontSize: '0.75rem', fontWeight: 700, color: '#86EFAC',
    padding: '0.25rem 0.5rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
  },
  close: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#EAF2FF', cursor: 'pointer', fontSize: '0.875rem',
  },
  body: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  lede: { margin: '0', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.75)' },
  tileGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.625rem',
  },
  tile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '0.375rem', minHeight: '88px',
    padding: '0.875rem 0.5rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', cursor: 'pointer',
    fontSize: '0.9375rem', fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  tileActive: {
    background: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.55)',
    color: '#DCFCE7',
  },
  tileIcon: { fontSize: '1.75rem', lineHeight: 1 },
  tileLabel: { textAlign: 'center' },
  dot: { width: '14px', height: '14px', borderRadius: '50%' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  chip: {
    padding: '0.5rem 0.75rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer', minHeight: '40px',
    WebkitTapHighlightColor: 'transparent',
  },
  chipActive: {
    background: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.55)',
    color: '#DCFCE7',
  },
  label: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  labelText: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
  textarea: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '0.625rem 0.75rem',
    color: '#EAF2FF', fontSize: '0.9375rem',
    outline: 'none', resize: 'vertical',
  },
  photoBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem', cursor: 'pointer',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.2)',
    color: '#EAF2FF', fontSize: '0.875rem',
    background: 'rgba(255,255,255,0.03)',
  },
  photoIcon: { fontSize: '1.125rem', lineHeight: 1 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
    marginTop: '1rem',
  },
  primary: {
    minHeight: '48px', minWidth: '48px',
    padding: '0.625rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E', color: '#fff',
    fontSize: '1.125rem', fontWeight: 800, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  primaryWide: { flex: 1, fontSize: '1rem' },
  secondary: {
    minHeight: '48px', minWidth: '48px',
    padding: '0.625rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'transparent', color: '#EAF2FF',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
  },
  savedBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '2rem 0.75rem', gap: '0.625rem',
  },
  savedIcon: {
    width: '52px', height: '52px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.55)',
    color: '#22C55E', fontSize: '1.5rem', fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  savedMsg: {
    margin: 0, fontSize: '0.9375rem', color: '#DCFCE7', textAlign: 'center', maxWidth: '24rem',
  },
};
