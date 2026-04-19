/**
 * IssueReportForm — compact "something is wrong" form the farmer can
 * fire from the Today/Progress screen. Calls POST /api/v2/issues.
 *
 * Minimal state, offline-tolerant (treats network failure as a soft
 * error so the farmer sees a clear retry instead of a spinner).
 */
import { useState } from 'react';
import { useTranslation } from '../i18n/index.js';

const CATEGORIES = ['pest', 'disease', 'weather', 'water', 'soil', 'other'];
const SEVERITIES = ['low', 'medium', 'high'];

async function postIssue(body) {
  const res = await fetch('/api/v2/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let reason = `request_failed_${res.status}`;
    try { reason = (await res.json())?.error || reason; } catch { /* ignore */ }
    const err = new Error(reason);
    err.code = reason;
    throw err;
  }
  return res.json();
}

export default function IssueReportForm({ cropCycleId = null, onSubmitted }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('pest');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 3) {
      setError('description_too_short');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { category, severity, description: description.trim(), cropCycleId };
      const { issue } = await postIssue(payload);
      setSubmitted(true);
      onSubmitted?.(issue);
    } catch (err) {
      setError(err.code || 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={S.successBox} data-testid="issue-report-success">
        <span style={S.successIcon}>{'\u2705'}</span>
        <div style={S.successText}>{t('issue.submittedAck')}</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={S.form} data-testid="issue-report-form">
      <h3 style={S.title}>{t('issue.title')}</h3>

      <label style={S.field}>
        <span style={S.label}>{t('issue.category')}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={S.select}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`issue.category.${c}`)}</option>
          ))}
        </select>
      </label>

      <label style={S.field}>
        <span style={S.label}>{t('issue.severity')}</span>
        <div style={S.severityRow}>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              style={{
                ...S.severityBtn,
                background: severity === s ? severityColor(s) : 'rgba(255,255,255,0.04)',
                color: severity === s ? '#0B1D34' : '#EAF2FF',
                borderColor: severity === s ? severityColor(s) : 'rgba(255,255,255,0.08)',
              }}
            >
              {t(`usRec.risk.${s}`)}
            </button>
          ))}
        </div>
      </label>

      <label style={S.field}>
        <span style={S.label}>{t('issue.description')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={t('issue.descriptionPlaceholder')}
          style={S.textarea}
        />
      </label>

      {error && <div style={S.error}>{t(`issue.err.${error}`) || t('issue.err.generic')}</div>}

      <button type="submit" disabled={submitting} style={S.submit}>
        {submitting ? t('common.saving') : t('issue.submit')}
      </button>
    </form>
  );
}

function severityColor(s) {
  return s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#22C55E';
}

const S = {
  form: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  title: { fontSize: '1rem', fontWeight: 700, margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: {
    fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  select: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '0.9375rem', minHeight: '44px',
  },
  textarea: {
    padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '0.9375rem', resize: 'vertical',
  },
  severityRow: { display: 'flex', gap: '0.375rem' },
  severityBtn: {
    flex: 1, padding: '0.625rem', borderRadius: '10px',
    border: '1px solid', fontWeight: 700, cursor: 'pointer', minHeight: '44px',
    fontSize: '0.875rem',
  },
  submit: {
    padding: '0.875rem', borderRadius: '14px', border: 'none',
    background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
  },
  error: { color: '#FCA5A5', fontSize: '0.8125rem' },
  successBox: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.875rem', borderRadius: '12px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.25)',
  },
  successIcon: { fontSize: '1.25rem' },
  successText: { fontSize: '0.9375rem', color: '#EAF2FF', fontWeight: 600 },
};
