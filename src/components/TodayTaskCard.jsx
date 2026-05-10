/**
 * TodayTaskCard — displays the single highest-priority task for today.
 * Shows ONE task (the primary task) — not a list.
 *
 * Also handles fallback states:
 *   - setupIncomplete: show "Finish your farm setup"
 *   - noStage: show "Set your crop stage"
 *   - allDone: show "All tasks done! Add an update"
 */

import React from 'react';
import { useTranslation } from '../i18n/useStrictTranslation.js';
import { getTaskIcon, getTaskIconBg } from '../lib/taskPresentation.js';

export default function TodayTaskCard({
  primaryTask,
  onAction,
  setupComplete,
  cropStage,
  onGoToSetup,
  onSetStage,
  onAddUpdate,
}) {
  const { t } = useTranslation();

  // Fallback: setup not complete
  if (!setupComplete) {
    return (
      <div data-testid="today-task-card" style={S.card}>
        <p style={S.label}>{t('dashboard.todaysTask')}</p>
        <h3 style={S.title}>{t('dashboard.finishSetup')}</h3>
        <p style={S.desc}>{t('dashboard.finishSetupDesc')}</p>
        <button
          data-testid="finish-setup-btn"
          onClick={() => onGoToSetup && onGoToSetup()}
          style={S.cta}
        >
          {t('dashboard.finishSetup')}
        </button>
      </div>
    );
  }

  // Fallback: no crop stage set
  if (!cropStage) {
    return (
      <div data-testid="today-task-card" style={S.card}>
        <p style={S.label}>{t('dashboard.todaysTask')}</p>
        <h3 style={S.title}>{t('dashboard.setCropStage')}</h3>
        <button
          data-testid="set-stage-btn"
          onClick={() => onSetStage && onSetStage()}
          style={S.cta}
        >
          {t('dashboard.setCropStage')}
        </button>
      </div>
    );
  }

  // Fallback: all tasks done
  if (!primaryTask) {
    return (
      <div data-testid="today-task-card" style={S.card}>
        <p style={S.label}>{t('dashboard.todaysTask')}</p>
        <h3 style={S.title}>{t('dashboard.allDoneAddUpdate')}</h3>
        <button
          data-testid="add-update-fallback-btn"
          onClick={() => onAddUpdate && onAddUpdate()}
          style={S.cta}
        >
          {t('dashboard.addUpdate')}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="today-task-card"
      style={S.card}
    >
      <p style={S.label}>{t('dashboard.todaysTask')}</p>

      {/* Primary task — single focus, no list rendering */}
      {/* Task icon — derived from task type for visual clarity */}
      <div style={{ ...S.iconCircle, background: getTaskIconBg(primaryTask) }}>
        <span style={S.iconEmoji}>{getTaskIcon(primaryTask)}</span>
      </div>

      <h3 style={S.title}>
        {primaryTask.title}
      </h3>

      {primaryTask.description && (
        <p style={S.desc}>
          {primaryTask.description}
        </p>
      )}

      <button
        data-testid="do-this-now-btn"
        onClick={() => onAction && onAction(primaryTask)}
        style={S.cta}
      >
        {t('dashboard.doThisNow')}
      </button>
    </div>
  );
}

const S = {
  iconCircle: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.5rem',
  },
  iconEmoji: {
    fontSize: '1.5rem',
    lineHeight: 1,
  },
  card: {
    background: '#1B2330',
    borderRadius: 16,
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.75rem',
    margin: '0 0 0.5rem',
  },
  title: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '1rem',
    margin: '0 0 0.5rem',
  },
  desc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    margin: '0 0 1rem',
  },
  cta: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '52px',
    borderRadius: 10,
    background: '#B9853F',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95rem',
    border: 'none',
    cursor: 'pointer',
  },
};
