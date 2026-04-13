import { useState } from 'react';
import { createSupportRequest } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useTranslation } from '../i18n/index.js';

export default function SupportCard() {
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
      await createSupportRequest({ subject: subject.trim(), message: message.trim() });
      setResult({ ok: true, text: t('support.sent') });
      setSubject('');
      setMessage('');
      safeTrackEvent('support.requested');
    } catch (err) {
      setResult({ ok: false, text: err.message || t('support.failed') });
    } finally {
      setSending(false);
    }
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
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  form: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#fff',
    outline: 'none',
    width: '100%',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  },
  btn: {
    background: '#22C55E',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  successBox: {
    background: 'rgba(134,239,172,0.1)',
    border: '1px solid rgba(134,239,172,0.3)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#86EFAC',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
  errorBox: {
    background: 'rgba(252,165,165,0.1)',
    border: '1px solid rgba(252,165,165,0.3)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
};
