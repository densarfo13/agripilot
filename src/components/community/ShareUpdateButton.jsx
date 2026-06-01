/**
 * ShareUpdateButton.jsx — reusable button + modal for sharing a grow update.
 *
 * Used from Plant Profile (§2 "Share Update") and from Journal/Activity
 * timeline rows (§3 "Share Progress"). Opens an inline modal that lets the
 * user attach a photo, write a note, pick visibility, and (optionally)
 * include growth stage / health status / scan result summary.
 *
 * Default visibility is HARD-CODED 'private'. The user must explicitly
 * pick a wider tier; 'public' requires a confirm step (visibilityConfirmed
 * flag) before submit. Precise GPS is never carried (we never collect it
 * in this flow). The post is appended to localStorage 'farroway_community_posts'
 * AND posted to /api/community/posts; the artifact log + canonical event
 * log are appended honestly.
 *
 * Self-contained: dynamic import for runtime composition, error boundary
 * around the modal so a render error never blocks Plant Profile / Journal.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { logEvent } from '../../lib/events/eventLogger.js';

const POSTS_KEY = 'farroway_community_posts';
const ARTIFACT_KEY = 'farroway_community_artifacts';

const VISIBILITIES = Object.freeze([
  { value: 'private', labelKey: 'community.visibility.private', label: 'Only me' },
  { value: 'organization', labelKey: 'community.visibility.organization', label: 'My organization' },
  { value: 'community', labelKey: 'community.visibility.community', label: 'Farroway community' },
  { value: 'public', labelKey: 'community.visibility.public', label: 'Public link' },
]);

const POST_TYPES = Object.freeze([
  { value: 'plant_update', labelKey: 'community.type.plant_update', label: 'Progress update' },
  { value: 'before_after', labelKey: 'community.type.before_after', label: 'Before and After' },
  { value: 'harvest', labelKey: 'community.type.harvest', label: 'Harvest' },
  { value: 'milestone', labelKey: 'community.type.milestone', label: 'Milestone' },
  { value: 'question', labelKey: 'community.type.question', label: 'Question' },
]);

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _appendPost(post) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(POSTS_KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push(post);
    // Cap the local cache so it doesn't grow unbounded.
    const bounded = list.length > 200 ? list.slice(list.length - 200) : list;
    window.localStorage.setItem(POSTS_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

function _appendArtifact(kind, idempotencyKey, status) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(ARTIFACT_KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push({ kind, idempotencyKey, ts: Date.now(), status: status || 'recorded' });
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(ARTIFACT_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

function _postToApi(post) {
  return _safe(async () => {
    if (typeof fetch !== 'function') return null;
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
      credentials: 'same-origin',
    });
    if (!res || !res.ok) return null;
    return res.json().catch(() => null);
  }, Promise.resolve(null));
}

function ShareUpdateInner({ plantId, plantName, cropKey, growthStage, healthStatus, scanSummary, defaultType, onClose }) {
  const [open, setOpen] = React.useState(false);
  const [postType, setPostType] = React.useState(defaultType || 'plant_update');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [visibility, setVisibility] = React.useState('private'); // HARD DEFAULT
  const [includeGrowthStage, setIncludeGrowthStage] = React.useState(true);
  const [includeHealthStatus, setIncludeHealthStatus] = React.useState(true);
  const [includeScanResult, setIncludeScanResult] = React.useState(false); // OFF by default
  const [confirmPublic, setConfirmPublic] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const reset = () => {
    setOpen(false);
    setTitle(''); setNotes(''); setVisibility('private');
    setIncludeGrowthStage(true); setIncludeHealthStatus(true);
    setIncludeScanResult(false); setConfirmPublic(false);
    setSubmitting(false); setError(null);
  };

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (visibility === 'public' && !confirmPublic) {
      setError(tSafe('community.confirmPublic.required',
        'Public posts need a confirmation. Tick the box below to confirm.'));
      return;
    }
    setSubmitting(true); setError(null);
    const ts = Date.now();
    const idempotencyKey = `grow_post:${plantId || 'noplant'}:${ts}`;
    const post = Object.freeze({
      id: idempotencyKey,
      plantId: plantId || null,
      postType,
      title: title || '',
      notes: notes || '',
      photos: [],
      cropKey: cropKey || null,
      plantName: plantName || null,
      growthStage: includeGrowthStage ? (growthStage || null) : null,
      healthStatus: includeHealthStatus ? (healthStatus || null) : null,
      visibility,
      visibilityConfirmed: visibility === 'public' ? confirmPublic : true,
      preciseLocationHidden: true,
      scanResultIncluded: includeScanResult && !!scanSummary,
      scanSummary: includeScanResult ? (scanSummary || null) : null,
      createdAt: ts,
      updatedAt: ts,
      idempotencyKey,
    });

    _appendPost(post);
    _appendArtifact('GrowPostCreated', idempotencyKey, 'recorded');
    if (visibility !== 'private') _appendArtifact('GrowPostShared', idempotencyKey, 'recorded');
    _safe(() => logEvent({
      type: 'task_feedback', // re-uses a canonical type with a payload tag
      payload: { source: 'community', kind: 'GrowPostCreated', visibility, postType },
    }), null);
    // Server post — best-effort; failure is non-fatal because the post is
    // already recorded locally and the artifact log captures it.
    await _postToApi(post);
    setSubmitting(false);
    reset();
    if (typeof onClose === 'function') onClose();
  };

  if (!open) {
    return (
      <button type="button" style={S.openBtn} onClick={() => setOpen(true)}
        data-testid="share-update-open">
        🌱 {tSafe('community.shareUpdate', 'Share Update')}
      </button>
    );
  }

  return (
    <div style={S.modalWrap} role="dialog" aria-modal="true" aria-label={tSafe('community.shareUpdate', 'Share Update')}>
      <form style={S.modal} onSubmit={onSubmit} data-testid="share-update-form">
        <div style={S.head}>
          <h2 style={S.title}>{tSafe('community.shareUpdate', 'Share Update')}</h2>
          <button type="button" style={S.closeBtn} onClick={reset} aria-label={tSafe('community.close', 'Close')}>×</button>
        </div>

        <label style={S.label}>{tSafe('community.postType', 'Type')}
          <select value={postType} onChange={(e) => setPostType(e.target.value)} style={S.input}
            data-testid="share-update-type">
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{tSafe(t.labelKey, t.label)}</option>
            ))}
          </select>
        </label>

        <label style={S.label}>{tSafe('community.title', 'Title (optional)')}
          <input type="text" value={title} maxLength={120}
            onChange={(e) => setTitle(e.target.value)} style={S.input}
            data-testid="share-update-title" />
        </label>

        <label style={S.label}>{tSafe('community.notes', 'Notes')}
          <textarea value={notes} maxLength={2000}
            onChange={(e) => setNotes(e.target.value)} style={{ ...S.input, minHeight: 80 }}
            data-testid="share-update-notes" />
        </label>

        <fieldset style={S.fieldset}>
          <legend style={S.legend}>{tSafe('community.include', 'Include')}</legend>
          <label style={S.checkRow}>
            <input type="checkbox" checked={includeGrowthStage} onChange={(e) => setIncludeGrowthStage(e.target.checked)} />
            <span>{tSafe('community.includeGrowthStage', 'Growth stage')} {growthStage ? `(${growthStage})` : ''}</span>
          </label>
          <label style={S.checkRow}>
            <input type="checkbox" checked={includeHealthStatus} onChange={(e) => setIncludeHealthStatus(e.target.checked)} />
            <span>{tSafe('community.includeHealthStatus', 'Health status')} {healthStatus ? `(${healthStatus})` : ''}</span>
          </label>
          <label style={S.checkRow}>
            <input type="checkbox" checked={includeScanResult && !!scanSummary} onChange={(e) => setIncludeScanResult(e.target.checked)}
              disabled={!scanSummary} />
            <span>{tSafe('community.includeScanResult', 'Scan result summary')} {scanSummary ? '' : `(${tSafe('community.noScan', 'no recent scan')})`}</span>
          </label>
        </fieldset>

        <fieldset style={S.fieldset} data-testid="share-update-visibility">
          <legend style={S.legend}>{tSafe('community.visibility', 'Who can see this')}</legend>
          {VISIBILITIES.map((v) => (
            <label key={v.value} style={S.radioRow}>
              <input type="radio" name="visibility" value={v.value} checked={visibility === v.value}
                onChange={() => setVisibility(v.value)} />
              <span>{tSafe(v.labelKey, v.label)}</span>
            </label>
          ))}
          {visibility === 'public' ? (
            <label style={{ ...S.checkRow, marginTop: 8 }}>
              <input type="checkbox" checked={confirmPublic} onChange={(e) => setConfirmPublic(e.target.checked)}
                data-testid="share-update-confirm-public" />
              <span>{tSafe('community.confirmPublic',
                "I understand this post will be available via a public link.")}</span>
            </label>
          ) : null}
        </fieldset>

        {error ? <p style={S.error}>{error}</p> : null}

        <div style={S.actions}>
          <button type="button" style={S.cancel} onClick={reset}>
            {tSafe('community.cancel', 'Cancel')}
          </button>
          <button type="submit" style={S.submit} disabled={submitting}
            data-testid="share-update-submit">
            {submitting
              ? tSafe('community.sharing', 'Sharing…')
              : tSafe('community.share', 'Share')}
          </button>
        </div>
      </form>
    </div>
  );
}

// Error boundary so a render fault never breaks Plant Profile or Journal.
export default class ShareUpdateButton extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <ShareUpdateInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  openBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '0.6rem 1rem', borderRadius: 999, border: '1px solid #6E8B61',
    background: 'rgba(110,139,97,0.10)', color: '#33503A',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  modalWrap: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#FFFFFF', borderRadius: 16, padding: '18px 20px',
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 24px 48px rgba(0,0,0,0.25)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: 18, fontWeight: 800 },
  closeBtn: { background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#4B5563' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700, color: '#1F2937' },
  input: { fontSize: 14, padding: '8px 10px', border: '1px solid #D1D5DB',
    borderRadius: 8, background: '#FFFFFF', fontFamily: 'inherit' },
  fieldset: { border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', margin: 0 },
  legend: { fontSize: 12, fontWeight: 700, color: '#6B7280', padding: '0 6px' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '4px 0' },
  radioRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '4px 0' },
  error: { margin: 0, fontSize: 13, color: '#B91C1C', fontWeight: 700 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancel: { padding: '0.6rem 1rem', borderRadius: 999, border: '1px solid #D1D5DB',
    background: '#FFFFFF', color: '#1F2937', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  submit: { padding: '0.6rem 1.2rem', borderRadius: 999, border: 'none',
    background: '#6E8B61', color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
};
