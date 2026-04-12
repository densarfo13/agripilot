import { useState } from 'react';
import { t } from '../lib/i18n.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';

export default function FarmerIdCard() {
  const { language } = useAppPrefs();
  const { profile } = useProfile();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!profile?.farmerUuid) return;
    try {
      await navigator.clipboard.writeText(profile.farmerUuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div style={S.card}>
      <div style={S.label}>{t(language, 'farmerUuid')}</div>
      <div style={S.row}>
        <div style={S.uuid}>{profile?.farmerUuid || 'Not assigned'}</div>
        <button type="button" onClick={handleCopy} style={S.copyBtn}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  label: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.5)',
  },
  row: {
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  uuid: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#86EFAC',
    fontFamily: 'monospace',
  },
  copyBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
  },
};
