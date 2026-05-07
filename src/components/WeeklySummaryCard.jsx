/**
 * WeeklySummaryCard — displays the weekly farm summary panel.
 * Includes headline, priorities, risks, and detailed notes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../context/ProfileContext.js';
import { useTranslation } from '../i18n/useStrictTranslation.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getWeeklySummary } from '../lib/api.js';

// Priority color mapping
const PRIORITY_COLORS = {
  high:   '#EF4444',
  medium: '#F59E0B',
  low:    '#86EFAC',
};

// Risk color mapping
const RISK_COLORS = {
  high:   '#EF4444',
  medium: '#FBBF24',
  low:    '#4ADE80',
};

// Risk icon mapping
const RISK_ICONS = {
  pest:     '🐛',
  disease:  '🦠',
  weather:  '⛈️',
  drought:  '☀️',
  flood:    '🌊',
  default:  '⚠️',
};

/**
 * PriorityDot — small colored indicator for task priority.
 */
function PriorityDot({ priority }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: PRIORITY_COLORS[priority] || PRIORITY_COLORS.low,
        marginRight: 6,
      }}
    />
  );
}

export default function WeeklySummaryCard() {
  const { profile } = useProfile();
  const { t } = useTranslation();
  const { isOnline } = useNetwork();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Track farm switches to reload the summary.
  const prevFarmIdRef = useRef(null);

  // Derive farmId safely — null when profile is absent so the effect
  // guard `if (!farmId …)` simply skips the fetch (rules-of-hooks
  // requires useEffect to be called unconditionally, before any guard).
  const farmId = profile ? (profile.currentFarmId || profile.farmId) : null;

  useEffect(() => {
    if (!farmId || farmId === prevFarmIdRef.current) return;
    prevFarmIdRef.current = farmId;
    setLoading(true);
    setErrorText(null);
    setSummary(null);
    getWeeklySummary(farmId)
      .then((data) => setSummary(data))
      .catch((err) => setErrorText(err?.message || 'error'))
      .finally(() => setLoading(false));
  }, [farmId]);

  if (!profile) return null;
  if (!summary) return null;

  return (
    <div
      data-testid="weekly-summary-card"
      style={{
        background: '#1B2330',
        borderRadius: 16,
        padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {loading && (
        <p style={{ color: 'rgba(255,255,255,0.55)' }}>{t('weekly.loading')}</p>
      )}

      {errorText && (
        <p style={{ color: '#EF4444' }}>{errorText}</p>
      )}

      {!summary && !loading && !errorText && null}

      {summary && (
        <>
          {/* Headline */}
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            {summary.headline}
          </h3>

          {/* Priorities */}
          {summary.priorities && summary.priorities.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {summary.priorities.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <PriorityDot priority={p.level} />
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>{p.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risks */}
          {summary.risks && summary.risks.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {summary.risks.map((r, i) => (
                <div key={i} style={{ color: RISK_COLORS[r.level] || '#fff', fontSize: '0.875rem' }}>
                  {RISK_ICONS[r.type] || RISK_ICONS.default} {r.text}
                </div>
              ))}
            </div>
          )}

          {/* Toggle for detailed notes */}
          <button
            data-testid="weekly-details-toggle"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#60A5FA',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0,
            }}
          >
            {expanded ? '▲ Less' : '▼ More'}
          </button>

          {/* Detailed notes */}
          {expanded && (
            <div
              data-testid="weekly-details"
              style={{ background: '#111827', borderRadius: 10, padding: '0.75rem', marginTop: '0.75rem' }}
            >
              {summary.nextSteps && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '0.75rem', margin: '0 0 0.25rem' }}>Next steps</p>
                  {summary.nextSteps.map((s, i) => (
                    <p key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>{s}</p>
                  ))}
                </div>
              )}
              {summary.inputNotes && summary.inputNotes.length > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
                  {summary.inputNotes[0]}
                </p>
              )}
              {summary.harvestNotes && summary.harvestNotes.length > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
                  {summary.harvestNotes[0]}
                </p>
              )}
              {summary.economicsNote && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>
                  {summary.economicsNote}
                </p>
              )}
              {summary.missingData && summary.missingData.length > 0 && (
                <p style={{ color: '#FBBF24', fontSize: '0.875rem', margin: 0 }}>
                  {summary.missingData[0]}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
