/**
 * FarmReadinessCard — shows farm readiness score and setup completeness.
 *
 * Props:
 *   score     — farmScore object with isReady, value, missing
 *   onSetup   — callback to open setup flow
 *   t         — translation function (optional, uses hook if not provided)
 */
import React from 'react';
import { useTranslation } from '../i18n/index.js';

export default function FarmReadinessCard({ score, onSetup }) {
  const { t } = useTranslation();

  if (!score) return null;

  const isReady = score.isReady;

  return (
    <div style={S.card} data-testid="farm-readiness-card">
      <div style={S.header}>
        <span style={S.title}>{t('readiness.progress') || 'Farm Readiness'}</span>
        {isReady ? (
          <span style={S.badge}>{t('readiness.good') || 'Good'}</span>
        ) : (
          <span style={{ ...S.badge, background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
            {t('readiness.incomplete') || 'Incomplete'}
          </span>
        )}
      </div>

      {isReady ? (
        <p style={S.desc}>{t('readiness.goodDesc') || 'Your farm profile is complete.'}</p>
      ) : (
        <div style={S.setupPrompt}>
          <p style={S.desc}>{t('readiness.incomplete') || 'Your farm setup is incomplete.'}</p>
          {score.missing && score.missing.length > 0 && (
            <ul style={S.missingList}>
              {score.missing.map((field) => (
                <li key={field} style={S.missingItem}>{field}</li>
              ))}
            </ul>
          )}
          <button style={S.btn} onClick={onSetup} data-testid="readiness-complete-setup">
            {t('dashboard.completeSetup') || 'Complete Setup'}
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#EAF2FF' },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.6rem',
    borderRadius: '8px',
    background: 'rgba(200,148,77,0.15)',
    color: '#C8944D',
  },
  desc: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
  setupPrompt: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  missingList: { margin: 0, paddingLeft: '1rem', color: '#9FB3C8', fontSize: '0.85rem' },
  missingItem: { marginBottom: '0.25rem' },
  btn: {
    padding: '0.75rem 1.5rem',
    fontWeight: 700,
    background: '#C8944D',
    color: '#000',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    alignSelf: 'flex-start',
  },
};
