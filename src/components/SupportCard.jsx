import { useState } from 'react';
import { createSupportRequest } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useTranslation } from '../i18n/index.js';

/**
 * SupportCard — farmer contact form. Optionally auto-attaches a
 * context payload (farmer ID, location, selected crop, stage, last
 * issue) so the admin receiving the request doesn't have to chase
 * the farmer for basic facts.
 *
 *   <SupportCard context={{ farmerUuid, location, crop, stage, lastIssue }} />
 */
export default function SupportCard({ context }) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSending(true);
    setResult(null);

    try {
      await createSupportRequest({
        subject: subject.trim(),
        message: message.trim(),
        // Context is a sibling field so admin tooling can render it
        // separately from the farmer-written message. Server must
        // accept arbitrary JSON here and persist it on the ticket.
        context: buildContextPayload(context),
      });
      setResult({ ok: true, text: t('support.sent') });
      setSubject('');
      setMessage('');
      safeTrackEvent('support.requested', {
        hasContext: !!context,
        hasCrop: !!context?.crop,
        hasLocation: !!context?.location,
      });
    } catch (err) {
      setResult({ ok: false, text: err.message || t('support.failed') });
    } finally {
      setSending(false);
    }
  }

  function buildContextPayload(ctx) {
    if (!ctx || typeof ctx !== 'object') return null;
    // Shape mirrors what a reviewer dashboard wants to display.
    return {
      farmerUuid: ctx.farmerUuid || null,
      location: ctx.location ? {
        country: ctx.location.country || null,
        stateCode: ctx.location.stateCode || null,
        city: ctx.location.city || null,
      } : null,
      crop: ctx.crop ? {
        cropKey: ctx.crop.cropKey || ctx.crop.crop || null,
        cropName: ctx.crop.cropName || null,
      } : null,
      stage: ctx.stage || null,
      lastIssue: ctx.lastIssue ? {
        category: ctx.lastIssue.category || null,
        severity: ctx.lastIssue.severity || null,
        status: ctx.lastIssue.status || null,
        id: ctx.lastIssue.id || null,
      } : null,
      capturedAt: new Date().toISOString(),
    };
  }

  return (
    <div style={S.card}>
      <h3 style={S.title}>{t('support.title')}</h3>
      <p style={S.desc}>{t('support.desc')}</p>

      {result && (
        <div style={result.ok ? S.successBox : S.errorBox}>{result.text}</div>
      )}

      <form onSubmit={handleSubmit} style={S.form}>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('support.subject')}
          style={S.input}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('support.describe')}
          rows={3}
          style={{ ...S.input, resize: 'vertical' }}
        />
        <button
          type="submit"
          disabled={sending || !subject.trim() || !message.trim()}
          style={{ ...S.btn, ...(sending ? S.btnDisabled : {}) }}
        >
          {sending ? t('support.sending') : t('support.sendRequest')}
        </button>
      </form>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    padding: '1.25rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#EAF2FF',
    margin: 0,
  },
  desc: {
    fontSize: '0.875rem',
    color: '#9FB3C8',
    marginTop: '0.5rem',
  },
  form: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#EAF2FF',
    outline: 'none',
    width: '100%',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  btn: {
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    fontWeight: 700,
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  successBox: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.12)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.14)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
};
