/**
 * FarmInputTimingCard — shows farm input timing recommendations
 * (fertilizer, irrigation, pest control) based on crop stage and season.
 */

import React, { useState, useEffect, useRef } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { getFarmInputs } from '../runtime/auth.js';
import { useProfile } from '../context/ProfileContext.jsx';

// Category icons for different input types
const CATEGORY_ICONS = {
  fertilizer:  '🌿',
  irrigation:  '💧',
  pestControl: '🛡️',
  harvesting:  '🌾',
  soil:        '🌱',
  default:     '📋',
};

export default function FarmInputTimingCard() {
  const { profile } = useProfile();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track farm switches so we reload when the farmer switches farms.
  const prevFarmIdRef = useRef(null);

  const currentFarmId = profile?.currentFarmId || profile?.farmId;

  useEffect(() => {
    if (!currentFarmId || currentFarmId === prevFarmIdRef.current) return;
    prevFarmIdRef.current = currentFarmId;
    setLoading(true);
    setError(null);
    setRecs([]);
    getFarmInputs(currentFarmId)
      .then((data) => setRecs(Array.isArray(data) ? data : []))
      .catch((err) => setError(err?.message || 'error'))
      .finally(() => setLoading(false));
  }, [currentFarmId]);

  if (!profile) return null;

  return (
    <div
      data-testid="farm-input-timing-card"
      style={{
        background: '#1B2330',
        borderRadius: 16,
        padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
        {tSafe('inputTiming.title', {}, 'Input Timing')}
      </h3>

      {loading && (
        <p style={{ color: 'rgba(255,255,255,0.55)' }}>{tSafe('common.loading', {}, 'Loading...')}</p>
      )}

      {!loading && recs.length === 0 && !error && (
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
          {tSafe('inputTiming.noRecs', {}, 'No recommendations right now.')}
        </p>
      )}

      {recs.map((rec, i) => {
        const icon = CATEGORY_ICONS[rec.category] || CATEGORY_ICONS.default;
        const isDelayed = rec.isDelayed || false;

        return (
          <div
            key={i}
            data-testid={`input-rec-${i}`}
            style={{
              background: '#0F1923',
              borderRadius: 10,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span>{icon}</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{rec.title}</span>
              {isDelayed && (
                <span
                  data-testid="delay-tag"
                  style={{
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {tSafe('inputTiming.delayed', {}, 'Delayed')}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#FBBF24', fontSize: '0.75rem' }}>{rec.priority}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>·</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>{rec.dueLabel}</span>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
              {rec.reason}
            </p>
            <p style={{ color: '#60A5FA', fontSize: '0.875rem', margin: 0 }}>{rec.action}</p>

            {rec.confidenceNote && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {rec.confidenceNote}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
