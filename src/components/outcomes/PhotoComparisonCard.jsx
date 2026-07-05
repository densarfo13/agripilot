/**
 * PhotoComparisonCard.jsx — store a before / after image pair for
 * a scan so the user (or an admin) can review improvement.
 *
 *   <PhotoComparisonCard
 *     scanId="scan_xxx"
 *     existingBeforeUrl={...}      optional — prefills the before pane
 *     onUpdated={(pair) => {}}
 *   />
 *
 * UX:
 *   - One file input each for "Before" + "After".
 *   - Save button POSTs both URLs to /api/outcomes/photo-pair.
 *   - After save, shows the verdict picker (Better / Same / Worse).
 *
 * Never throws. Self-hides if the user has no scanId context.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { recordPhotoPair } from
  '../../runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker';

function _fileToDataUrl(file) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    } catch { resolve(''); }
  });
}

function PhotoComparisonCardInner(props) {
  const { scanId, existingBeforeUrl, onUpdated } = props || {};
  const [beforeUrl, setBeforeUrl] = React.useState(existingBeforeUrl || '');
  const [afterUrl, setAfterUrl] = React.useState('');
  const [note, setNote] = React.useState('');
  const [verdict, setVerdict] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [savedId, setSavedId] = React.useState('');

  // NOTE: the `!scanId` early return lives BELOW the hooks. It used to sit here —
  // between the useStates and the useCallbacks — so the moment a scan completed and
  // scanId flipped falsy→truthy, this component rendered MORE hooks than the previous
  // render and React threw ("Rendered more hooks…") → the scan error boundary →
  // "Scan temporarily unavailable". Production root cause, 2026-07-04.

  const pickBefore = React.useCallback(async (e) => {
    const file = (e.target.files && e.target.files[0]) || null;
    if (!file) return;
    setBeforeUrl(await _fileToDataUrl(file));
  }, []);

  const pickAfter = React.useCallback(async (e) => {
    const file = (e.target.files && e.target.files[0]) || null;
    if (!file) return;
    setAfterUrl(await _fileToDataUrl(file));
  }, []);

  const save = React.useCallback(async () => {
    if (!beforeUrl || saving) return;
    setSaving(true);
    try {
      const res = await recordPhotoPair({
        scanId: String(scanId),
        beforeUrl,
        afterUrl: afterUrl || undefined,
        improvementNote: note || undefined,
        verdict: ['better', 'same', 'worse'].includes(verdict)
          ? verdict : undefined,
      });
      if (res && res.ok) {
        setSavedId(res.id);
        if (typeof onUpdated === 'function') {
          try { onUpdated({ id: res.id, beforeUrl, afterUrl, verdict }); }
          catch { /* swallow */ }
        }
      }
    } finally {
      setSaving(false);
    }
  }, [scanId, beforeUrl, afterUrl, note, verdict, saving, onUpdated]);

  // All hooks above are unconditional — safe to bail now (see note near the top).
  if (!scanId) return null;

  return (
    <div
      style={S.wrap}
      data-testid="photo-comparison-card"
      data-scan-id={scanId}>
      <p style={S.eyebrow}>{tSafe('outcomes.photo.eyebrow', 'Before / After')}</p>
      <div style={S.grid}>
        <div style={S.col}>
          <p style={S.colLabel}>{tSafe('outcomes.photo.before', 'Before')}</p>
          {beforeUrl ? (
            <img src={beforeUrl} alt="" style={S.img} />
          ) : (
            <span style={S.placeholder}>—</span>
          )}
          <input type="file" accept="image/*" onChange={pickBefore}
            data-testid="photo-comparison-before-input" style={S.input} />
        </div>
        <div style={S.col}>
          <p style={S.colLabel}>{tSafe('outcomes.photo.after', 'After')}</p>
          {afterUrl ? (
            <img src={afterUrl} alt="" style={S.img} />
          ) : (
            <span style={S.placeholder}>—</span>
          )}
          <input type="file" accept="image/*" onChange={pickAfter}
            data-testid="photo-comparison-after-input" style={S.input} />
        </div>
      </div>
      <input type="text" placeholder={tSafe('outcomes.photo.note', 'What changed? (optional)')}
        value={note} onChange={(e) => setNote(e.target.value)}
        style={S.textInput} />
      <div style={S.verdictRow}>
        <span style={S.verdictLabel}>{tSafe('outcomes.photo.verdict', 'Verdict:')}</span>
        {['better', 'same', 'worse'].map((v) => (
          <button key={v} type="button"
            style={v === verdict ? S.verdictBtnOn : S.verdictBtnOff}
            onClick={() => setVerdict(v)}>{v}</button>
        ))}
      </div>
      <button type="button"
        style={S.saveBtn}
        disabled={!beforeUrl || saving}
        onClick={save}
        data-testid="photo-comparison-save">
        {saving ? tSafe('outcomes.photo.saving', 'Saving…')
                : tSafe('outcomes.photo.save', 'Save pair')}
      </button>
      {savedId ? <p style={S.done}>✓ {tSafe('outcomes.photo.saved', 'Saved')}</p> : null}
    </div>
  );
}

export default class PhotoComparisonCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <PhotoComparisonCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.10)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
    fontFamily: 'system-ui',
  },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  col: { display: 'flex', flexDirection: 'column', gap: 6 },
  colLabel: { margin: 0, fontSize: 11, fontWeight: 700,
    color: 'rgba(60,72,55,0.7)' },
  img: { width: '100%', height: 120, objectFit: 'cover', borderRadius: 8,
    background: 'rgba(60,72,55,0.06)' },
  placeholder: { display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 120, borderRadius: 8, background: 'rgba(60,72,55,0.04)',
    color: 'rgba(60,72,55,0.3)', fontSize: 24 },
  input: { fontSize: 11 },
  textInput: { padding: '8px 10px', borderRadius: 8,
    border: '1px solid rgba(60,72,55,0.20)', fontSize: 13, width: '100%',
    boxSizing: 'border-box', background: '#fff' },
  verdictRow: { display: 'flex', flexDirection: 'row', gap: 8,
    alignItems: 'center', flexWrap: 'wrap' },
  verdictLabel: { fontSize: 12, color: 'rgba(60,72,55,0.7)' },
  verdictBtnOn: { padding: '6px 12px', borderRadius: 8, border: 'none',
    background: '#1F2933', color: '#fff', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', textTransform: 'capitalize' },
  verdictBtnOff: { padding: '6px 12px', borderRadius: 8,
    border: '1px solid rgba(60,72,55,0.20)', background: '#fff',
    color: '#1F2933', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    textTransform: 'capitalize' },
  saveBtn: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#2f7a3a', color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', alignSelf: 'flex-start' },
  done: { margin: 0, fontSize: 12, color: '#2f7a3a', fontWeight: 700 },
};
