/**
 * GuidedFarmingCard — shows ONE guided step at a time for new farmers.
 *
 * Design principles:
 *   • Single-step focus (not a list) — farmers only see what to do NOW
 *   • Each step has a direct action CTA (not generic "mark as done")
 *   • Gates on isGuidedMode + active season — experienced farmers see nothing
 *   • Tracks step completion for analytics
 */

import React from 'react';
import {
  isGuidedMode,
  getCurrentStep,
  getGuidedProgress,
  markStepComplete,
} from '../utils/guidedFarmingSteps.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

export default function GuidedFarmingCard({ profile, season, onRecordUpdate }) {
  // Hooks must be called before any early returns (rules-of-hooks).
  const { t } = useTranslation();

  if (!isGuidedMode(profile)) return null;
  if (!season) return null;

  const seasonId = season?.id || season;
  const current  = getCurrentStep(seasonId);
  const progress = getGuidedProgress(seasonId);

  function handleStepAction() {
    if (!current) return;
    markStepComplete(seasonId, current.id);
    if (onRecordUpdate) {
      onRecordUpdate({ updateType: current.updateType, stepId: current.id });
    }
    // Analytics — track guided_step.completed with stepId and updateType
    try {
      if (typeof window !== 'undefined' && window.analytics) {
        window.analytics.track('guided_step.completed', {
          stepId: current.id,
          updateType: current.updateType,
        });
      }
    } catch { /* never block the UI */ }
  }

  const cardStyle = {
    borderRadius: 16,
    background: '#1B2330',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  // All steps complete
  if (!current) {
    return (
      <div data-testid="guided-farming-card" style={cardStyle}>
        <p style={{ color: '#86EFAC', fontWeight: 600 }}>
          {t('guided.allDone')}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="guided-farming-card" style={cardStyle}>
      {/* Progress: "Step X of Y" */}
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        {t('guided.stepOf', { step: current.stepNumber, total: progress.total })}
      </p>

      {/* Current step — single focus */}
      <div
        data-testid={`guided-step-${current.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}
      >
        <span style={{ fontSize: '2rem' }}>{current.icon}</span>
        <div>
          <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>
            {t(`guided.step.${current.id}`)}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            {t(`guided.step.${current.id}.desc`)}
          </p>
        </div>
      </div>

      {/* Reminder text for returning farmers */}
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
        {t('guided.reminder')}
      </p>

      {/* Per-step action CTA — not generic "mark as done" */}
      <button
        data-testid={`guided-btn-${current.id}`}
        onClick={handleStepAction}
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: 10,
          background: '#16A34A',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.95rem',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {t(`guided.step.${current.id}.cta`)}
      </button>
    </div>
  );
}
