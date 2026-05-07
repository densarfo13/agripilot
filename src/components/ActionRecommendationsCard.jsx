/**
 * ActionRecommendationsCard — shows personalized action recommendations
 * for the farmer based on their profile and recommendations data.
 *
 * Props:
 *   recommendations — array of recommendation objects
 *   profile         — farmer profile
 *   onAction        — callback when farmer acts on a recommendation
 */
import React from 'react';
import { useTranslation } from '../i18n/index.js';

export default function ActionRecommendationsCard({ recommendations = [], profile, onAction }) {
  const { t } = useTranslation();

  if (!recommendations || recommendations.length === 0) return null;

  const hasGps = !!(profile?.latitude && profile?.longitude);

  return (
    <div style={S.card} data-testid="action-recommendations-card">
      <div style={S.header}>
        <span style={S.title}>{t('recommend.title') || 'Recommendations'}</span>
      </div>

      {!hasGps && (
        <div style={S.gpsHint} data-testid="recommend-add-gps">
          {t('recommend.addGps') || 'Add GPS location to improve recommendations'}
        </div>
      )}

      <ul style={S.list}>
        {recommendations.map((rec, idx) => (
          <li key={rec.id || idx} style={S.item}>
            <div style={S.recContent}>
              <span style={S.recText}>{rec.title || rec.message || ''}</span>
              {rec.actionLabel && (
                <button
                  style={S.actBtn}
                  onClick={() => onAction?.(rec)}
                  data-testid={`rec-action-${idx}`}
                >
                  {rec.actionLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {recommendations.length === 0 && (
        <p style={S.allGood}>{t('recommend.allGood') || 'All good — no actions needed now.'}</p>
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
  header: { marginBottom: '0.75rem' },
  title: { fontSize: '1rem', fontWeight: 700, color: '#EAF2FF' },
  gpsHint: {
    fontSize: '0.8rem',
    color: '#9FB3C8',
    padding: '0.5rem 0.75rem',
    background: 'rgba(14,165,233,0.1)',
    borderRadius: '8px',
    marginBottom: '0.75rem',
  },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  item: { padding: '0.5rem 0' },
  recContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  recText: { fontSize: '0.9rem', color: '#EAF2FF', flex: 1 },
  actBtn: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: '#22C55E',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  allGood: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0 },
};
