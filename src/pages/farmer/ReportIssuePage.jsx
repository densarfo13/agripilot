/**
 * ReportIssuePage — farmer-facing "Report a crop / farm issue" form.
 *
 * Structured inputs per spec §3:
 *   • issue type   — dropdown (ISSUE_TYPES from issueStore)
 *   • severity     — dropdown (low / medium / high)
 *   • description  — required free text
 *   • image (opt.) — file input; stored as a data URL
 *
 * On submit:
 *   createIssue(...) → toast "Your issue has been reported" →
 *   navigate to /my-issues so the farmer can see the new entry.
 *
 * Every visible string goes through t() with a safe English fallback.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useTranslation } from '../../i18n/index.js';
import {
  createIssue,
  getIssuesForRole,
  ISSUE_TYPES,
  ISSUE_SEVERITY,
} from '../../lib/issues/issueStore.js';
import { getActiveFarm, getActiveFarmId } from '../../store/farrowayLocal.js';
import { getFarmerSignals } from '../../lib/signals/farmerSignalEngine.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function fileToDataUrl(file) {
  return new Promise((res) => {
    if (!file) return res(null);
    const reader = new FileReader();
    reader.onload  = () => res(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => res(null);
    reader.readAsDataURL(file);
  });
}

export default function ReportIssuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [issueType, setIssueType]   = useState(ISSUE_TYPES[0]);
  const [severity,  setSeverity]    = useState(ISSUE_SEVERITY.MEDIUM);
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile]   = useState(null);
  const [error,   setError]         = useState('');
  const [saving,  setSaving]        = useState(false);
  const [done,    setDone]          = useState(null); // set to created issue on success

  const titleLbl    = resolve(t, 'issues.report.title',      'Report a farm issue');
  const subLbl      = resolve(t, 'issues.report.subtitle',
    'Tell us what\u2019s happening. A field officer will review it.');
  const typeLbl     = resolve(t, 'issues.report.type',       'Issue type');
  const sevLbl      = resolve(t, 'issues.report.severity',   'How serious is it?');
  const descLbl     = resolve(t, 'issues.report.description','Describe what you see');
  const imageLbl    = resolve(t, 'issues.report.image',      'Photo (optional)');
  const submitLbl   = resolve(t, 'issues.report.submit',     'Report issue');
  const submittingLbl = resolve(t, 'issues.report.submitting','Sending\u2026');
  const backLbl     = resolve(t, 'issues.report.back',       'Back to home');
  const successTitle = resolve(t, 'issues.report.successTitle','Your issue has been reported');
  // When auto-triage picked an officer, the farmer sees the stronger
  // ack ("received and assigned"); otherwise the standard "received,
  // admin reviewing" line surfaces. Either way this string is purely
  // advisory — nothing auto-resolves.
  const successMsg   = (done && done.farmerAck)
    || resolve(t, 'issues.report.successMsg',
         'A field officer will review your report. You can check its status any time.');
  const viewMineLbl = resolve(t, 'issues.report.viewMine',   'View my issues');
  const descReq     = resolve(t, 'issues.report.descRequired',
    'Please describe the issue in a few words.');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!description.trim()) { setError(descReq); return; }

    setSaving(true);
    try {
      const imageUrl = imageFile ? await fileToDataUrl(imageFile) : null;
      const activeFarm = getActiveFarm();
      const farmId     = getActiveFarmId();
      const issue = createIssue({
        farmerId:   (activeFarm && activeFarm.farmerId) || farmId || null,
        farmId:     farmId || null,
        farmerName: (activeFarm && activeFarm.name) || null,
        program:    (activeFarm && activeFarm.program) || null,
        location:   (activeFarm && (activeFarm.location || activeFarm.stateLabel)) || null,
        crop:       (activeFarm && activeFarm.crop) || null,
        issueType,
        severity,
        description,
        imageUrl,
        // Automation — rules-based triage + assignment + suggested
        // response. Never auto-resolves; routes to admin queue when
        // no officer matches.
        autoTriage: true,
      });
      if (!issue) throw new Error('create_failed');
      setDone(issue);
    } catch {
      setError(resolve(t, 'issues.report.genericError',
        'Could not save your report. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    // Compute a signal snapshot off the just-created issue + the
    // farmer's recent history. Pure + deterministic — no network.
    // Safe-hedged wording only; never claims a specific disease.
    const activeFarm = getActiveFarm();
    const farmId     = getActiveFarmId();
    const recentIssues = (() => {
      try { return getIssuesForRole('farmer') || []; } catch { return []; }
    })();
    const signal = getFarmerSignals({
      farm: activeFarm
        ? { id: farmId, farmerId: activeFarm.farmerId,
            crop: activeFarm.crop, farmType: activeFarm.farmType,
            location: activeFarm.location }
        : { id: farmId },
      issues: recentIssues,
      symptomReport: {
        symptoms: [],  // ReportIssuePage v1 has no structured symptom
                       // picker yet — the signal still uses description
                       // keywords via the issueType dropdown.
        affectedPart: null,
        extent: severity === 'high' ? 'many_plants' : 'few_plants',
        description,
      },
      imageMeta: done.imageUrl ? { url: done.imageUrl } : null,
      weather: null,
    });
    return (
      <main style={S.page} data-screen="report-issue" data-state="done">
        <h1 style={S.title}>{successTitle}</h1>
        <p style={S.success}>{successMsg}</p>
        {signal.signalScore >= 30 && (
          <SignalBanner t={t} signal={signal} resolve={resolve} />
        )}
        <div style={S.buttonsRow}>
          <button
            type="button"
            onClick={() => navigate('/my-issues')}
            style={S.primary}
            data-testid="report-issue-view-mine"
          >
            {viewMineLbl}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={S.secondary}
          >
            {backLbl}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="report-issue">
      <h1 style={S.title}>{titleLbl}</h1>
      <p style={S.sub}>{subLbl}</p>

      {error && <div style={S.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} style={S.form} noValidate>
        <label style={S.label}>
          {typeLbl}
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            style={S.input}
            data-testid="report-issue-type"
          >
            {ISSUE_TYPES.map((code) => (
              <option key={code} value={code}>
                {resolve(t, `issues.type.${code}`, humanizeType(code))}
              </option>
            ))}
          </select>
        </label>

        <label style={S.label}>
          {sevLbl}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={S.input}
            data-testid="report-issue-severity"
          >
            <option value={ISSUE_SEVERITY.LOW}>
              {resolve(t, 'issues.severity.low',    'Low')}
            </option>
            <option value={ISSUE_SEVERITY.MEDIUM}>
              {resolve(t, 'issues.severity.medium', 'Medium')}
            </option>
            <option value={ISSUE_SEVERITY.HIGH}>
              {resolve(t, 'issues.severity.high',   'High')}
            </option>
          </select>
        </label>

        <label style={S.label}>
          {descLbl}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={resolve(t, 'issues.report.descPlaceholder',
              'e.g. Brown spots on maize leaves after heavy rain')}
            style={{ ...S.input, minHeight: 96, resize: 'vertical' }}
            data-testid="report-issue-description"
          />
        </label>

        <label style={S.label}>
          {imageLbl}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            style={S.input}
            data-testid="report-issue-image"
          />
        </label>

        <button
          type="submit"
          style={{ ...S.primary, ...(saving ? S.primaryDisabled : {}) }}
          disabled={saving}
          data-testid="report-issue-submit"
        >
          {saving ? submittingLbl : submitLbl}
        </button>

        <div style={S.footerRow}>
          <Link to="/my-issues" style={S.link}>
            {resolve(t, 'issues.report.myIssues', 'My reported issues')}
          </Link>
        </div>
      </form>
    </main>
  );
}

function humanizeType(code) {
  return String(code).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * SignalBanner — safe, hedged wording about what the signal engine
 * inferred. Rendered only when signalScore ≥ 30 so low-noise reports
 * don\u2019t get a warning treatment. Every string goes through t()
 * with English fallbacks; one language per render.
 */
function SignalBanner({ t, signal, resolve }) {
  const toneStyle =
    signal.severityTone === 'danger' ? S.bannerDanger
    : signal.severityTone === 'warn' ? S.bannerWarn
    :                                   S.bannerInfo;
  const title   = resolve(t, 'signal.banner.detected', 'We noticed a possible risk');
  const catLbl  = resolve(t, signal.likelyCategoryKey, signal.likelyCategoryFallback);
  const riskLbl = resolve(t, `signal.risk.${signal.riskLevel}`,
    signal.riskLevel === 'high' ? 'Needs review soon'
      : signal.riskLevel === 'medium' ? 'Needs attention' : 'Low risk');
  const nextLbl = resolve(t, signal.suggestedActionKey, signal.suggestedActionFallback);
  const reviewLine = signal.requiresReview
    ? resolve(t, 'signal.banner.reviewLine', 'A field officer has been notified to review your report.')
    : resolve(t, 'signal.banner.noReviewLine', 'Keep watching your plants over the next few days.');
  return (
    <div
      style={{ ...S.banner, ...toneStyle }}
      role="status"
      data-testid="signal-banner"
      data-risk={signal.riskLevel}
      data-category={signal.likelyCategory}
    >
      <div style={S.bannerTitle}>{title}</div>
      <div style={S.bannerLine}>
        <span style={S.bannerPill}>{catLbl}</span>
        <span style={S.bannerDot}>{'\u00B7'}</span>
        <span>{riskLbl}</span>
      </div>
      <div style={S.bannerBody}>{nextLbl}</div>
      <div style={S.bannerSub}>{reviewLine}</div>
    </div>
  );
}

const S = {
  page:    { minHeight: '100vh', background: '#0B1D34', color: '#fff',
             padding: '1.25rem 1rem 2rem', maxWidth: '32rem', margin: '0 auto',
             boxSizing: 'border-box' },
  title:   { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem' },
  sub:     { margin: '0 0 1rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem' },
  form:    { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:   { display: 'flex', flexDirection: 'column', gap: '0.25rem',
             fontSize: '0.8125rem', color: 'rgba(255,255,255,0.72)', fontWeight: 600 },
  input:   { padding: '0.625rem 0.75rem', borderRadius: 10,
             border: '1px solid rgba(255,255,255,0.15)',
             background: 'rgba(255,255,255,0.05)', color: '#fff',
             fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box' },
  primary: { padding: '0.75rem', borderRadius: 12, border: 'none',
             background: '#22C55E', color: '#000', fontSize: '0.95rem',
             fontWeight: 700, cursor: 'pointer' },
  primaryDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  secondary: { padding: '0.75rem', borderRadius: 12,
               border: '1px solid rgba(255,255,255,0.18)',
               background: 'transparent', color: 'rgba(255,255,255,0.85)',
               fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },
  buttonsRow: { display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' },
  success: { padding: '0.75rem 1rem', borderRadius: 12,
             background: 'rgba(34,197,94,0.1)',
             border: '1px solid rgba(34,197,94,0.35)',
             color: '#86EFAC', fontSize: '0.95rem' },
  error:   { padding: '0.625rem 0.75rem', borderRadius: 10,
             background: 'rgba(239,68,68,0.1)',
             border: '1px solid rgba(239,68,68,0.3)',
             color: '#FCA5A5', fontSize: '0.875rem', margin: '0 0 0.5rem' },
  link:    { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  footerRow: { marginTop: '0.5rem', textAlign: 'center' },
  // ─── Signal banner ───
  banner:  { marginTop: '0.75rem', padding: '0.75rem 0.875rem', borderRadius: 12,
             border: '1px solid rgba(255,255,255,0.12)' },
  bannerInfo:   { background: 'rgba(59,130,246,0.08)',
                  borderColor: 'rgba(59,130,246,0.3)' },
  bannerWarn:   { background: 'rgba(245,158,11,0.08)',
                  borderColor: 'rgba(245,158,11,0.35)' },
  bannerDanger: { background: 'rgba(239,68,68,0.08)',
                  borderColor: 'rgba(239,68,68,0.35)' },
  bannerTitle:  { fontWeight: 700, fontSize: '0.95rem',
                  color: 'rgba(255,255,255,0.95)', marginBottom: 4 },
  bannerLine:   { display: 'flex', gap: 6, alignItems: 'center',
                  fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)',
                  marginBottom: 6, flexWrap: 'wrap' },
  bannerPill:   { padding: '1px 8px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontWeight: 700 },
  bannerDot:    { opacity: 0.5 },
  bannerBody:   { fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)',
                  marginBottom: 4, lineHeight: 1.35 },
  bannerSub:    { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' },
};
