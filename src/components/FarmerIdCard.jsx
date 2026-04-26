import { useState } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { useProfile } from '../context/ProfileContext.jsx';

export default function FarmerIdCard() {
  const { t } = useTranslation();
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
      <div style={S.label}>{t('farmerUuid')}</div>
      <div style={S.row}>
        <div style={S.uuid}>{profile?.farmerUuid || t('farmerId.notAssigned')}</div>
        <button type="button" onClick={handleCopy} style={S.copyBtn}>
          {copied ? t('farmerId.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  label: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6F8299',
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
    color: '#9FB3C8',
    fontFamily: 'monospace',
  },
  copyBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#9FB3C8',
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
  },
};
