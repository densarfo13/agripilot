import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useFarmRisk, useFeedbackSubmit } from '../hooks/useIntelligence.js';
import RiskLevelBadge from '../components/intelligence/RiskLevelBadge.jsx';
import SeverityBar from '../components/intelligence/SeverityBar.jsx';
import { COLORS } from '../constants/intelligence.js';

const LEVEL_COLORS = {
  low: COLORS.green,
  moderate: COLORS.amber,
  high: '#FB923C',
  urgent: COLORS.red,
};

const LEVEL_BG = {
  low: COLORS.greenLight,
  moderate: 'rgba(245,158,11,0.12)',
  high: 'rgba(251,146,60,0.12)',
  urgent: 'rgba(239,68,68,0.12)',
};

const LEVEL_MESSAGES = {
  low: 'pest.levelMsg.low',
  moderate: 'pest.levelMsg.moderate',
  high: 'pest.levelMsg.high',
  urgent: 'pest.levelMsg.urgent',
};

function deriveLevel(score) {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'urgent';
}

function buildAdvice(level, t) {
  const adviceMap = {
    low: [
      { text: t('pest.advice.low.1') || 'Continue regular monitoring', icon: 'monitor' },
      { text: t('pest.advice.low.2') || 'Maintain crop hygiene', icon: 'clean' },
    ],
    moderate: [
      { text: t('pest.advice.moderate.1') || 'Increase inspection frequency', icon: 'inspect' },
      { text: t('pest.advice.moderate.2') || 'Consider preventive treatment', icon: 'treat' },
      { text: t('pest.advice.moderate.3') || 'Check neighboring fields', icon: 'field' },
    ],
    high: [
      { text: t('pest.advice.high.1') || 'Apply recommended treatment promptly', icon: 'urgent' },
      { text: t('pest.advice.high.2') || 'Isolate affected areas if possible', icon: 'isolate' },
      { text: t('pest.advice.high.3') || 'Document damage for records', icon: 'doc' },
    ],
    urgent: [
      { text: t('pest.advice.urgent.1') || 'Treat immediately - crop at risk', icon: 'alert' },
      { text: t('pest.advice.urgent.2') || 'Seek expert assistance', icon: 'expert' },
      { text: t('pest.advice.urgent.3') || 'Consider emergency measures', icon: 'emergency' },
      { text: t('pest.advice.urgent.4') || 'Report to local agricultural office', icon: 'report' },
    ],
  };
  return adviceMap[level] || adviceMap.moderate;
}

export default function PestRiskResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;

  const stateReport = location.state?.report || null;
  const { risk, loading: riskLoading, error: riskError, refetch } = useFarmRisk(profileId);
  const { submit: submitFeedback, loading: fbLoading } = useFeedbackSubmit();

  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState('');

  // stateReport is from pest report submission: { reportId, riskScore, riskLevel, alert }
  // risk is from farm risk API: { risk: V2FarmPestRisk, recentReports, fieldStress }
  const farmRisk = risk?.risk || risk;
  const report = stateReport || farmRisk;
  const loading = !stateReport && riskLoading;
  const error = !stateReport && riskError
    ? (typeof riskError === 'string' ? riskError : riskError.message || t('pest.loadError'))
    : '';

  const score = report?.riskScore ?? report?.overallRiskScore ?? report?.score ?? 50;
  const level = report?.riskLevel || deriveLevel(score);
  const likelyIssue = report?.likelyIssue || report?.diagnosis || t('pest.likelyDamage');
  const alternativeIssue = report?.alternativeIssue || null;
  const confidence = report?.confidenceScore ?? report?.confidence ?? null;
  const isUncertain = report?.isUncertain ?? false;
  const severity = report?.severity ?? score;
  const actionGuidance = report?.actionGuidance || null;
  const actions = report?.actions || report?.recommendations || [];
  const inspections = report?.inspections || [];
  const followUpDays = report?.followUpDays ?? 7;
  const reportId = report?.reportId || report?.id;
  const levelColor = LEVEL_COLORS[level] || COLORS.amber;
  const levelBg = LEVEL_BG[level] || LEVEL_BG.moderate;
  const advice = buildAdvice(level, t);

  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  const handleFeedback = async (helpful) => {
    if (!reportId || feedbackSent) return;
    try {
      await submitFeedback(reportId, {
        userFeedback: helpful ? 'accurate' : 'inaccurate',
        helpfulScore: helpful ? 80 : 20,
      });
      setFeedbackSent(true);
      setFeedbackToast(t('pest.feedbackThanks') || 'Thank you for your feedback!');
    } catch {
      // Feedback is non-critical, fail silently
    }
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingCenter}>
            <div style={S.spinner} />
            <p style={{ color: COLORS.subtext }}>{t('pest.loadingResults')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{error}</div>
          <button style={S.retryBtn} onClick={() => refetch()}>
            {t('pest.retry') || 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Feedback toast */}
        {feedbackToast && (
          <div style={S.toast}>{feedbackToast}</div>
        )}

        {/* Back */}
        <button style={S.backLink} onClick={() => navigate(-1)}>
          {'\u2190'} {t('pest.backToScan')}
        </button>

        <h1 style={S.title}>{t('pest.resultTitle')}</h1>

        {/* Score circle hero */}
        <div style={S.heroCard}>
          <div style={{
            ...S.scoreCircle,
            borderColor: levelColor,
            background: levelBg,
          }}>
            <span style={{ ...S.scoreNumber, color: levelColor }}>{score}</span>
            <span style={S.scoreLabel}>/100</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <RiskLevelBadge level={level} score={score} size="lg" />
          </div>
          <div style={S.likelyIssue}>{likelyIssue}</div>
          {isUncertain && (
            <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#F59E0B' }}>
              Detection confidence is low. Results may be uncertain.
            </div>
          )}
          {alternativeIssue && (
            <div style={{ fontSize: '0.78rem', color: '#A1A1AA', marginTop: '0.4rem' }}>
              Could also be: <span style={{ color: '#CBD5E1' }}>{alternativeIssue.replace(/_/g, ' ')}</span>
            </div>
          )}
          {confidence != null && (
            <div style={S.confidence}>
              {t('pest.confidence')}: {Math.round(confidence)}%
            </div>
          )}
          <div style={{ ...S.levelMessage, color: levelColor }}>
            {t(LEVEL_MESSAGES[level]) || ''}
          </div>
        </div>

        {/* Severity bar */}
        <div style={S.card}>
          <SeverityBar score={score} label={t('pest.severity')} />
        </div>

        {/* Severity-driven advice cards */}
        <div style={{ ...S.card, borderLeft: `4px solid ${levelColor}` }}>
          <h3 style={S.sectionTitle}>{t('pest.whatToDoNow')}</h3>
          {advice.map((item, i) => (
            <div key={i} style={S.adviceItem}>
              <div style={{ ...S.adviceDot, background: levelColor }} />
              <span style={S.adviceText}>{item.text}</span>
            </div>
          ))}
          {actions.length > 0 && actions.map((a, i) => (
            <div key={`api-${i}`} style={S.adviceItem}>
              <div style={{ ...S.adviceDot, background: COLORS.green }} />
              <span style={S.adviceText}>
                {typeof a === 'string' ? a : a.text || a.description}
              </span>
            </div>
          ))}
        </div>

        {/* Structured action guidance from engine */}
        {actionGuidance && (
          <div style={{ ...S.card, borderLeft: `4px solid ${COLORS.green}` }}>
            <h3 style={S.sectionTitle}>Action Steps</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {actionGuidance.where_to_check && (
                <div style={S.actionRow}>
                  <span style={S.actionLabel}>Where:</span>
                  <span style={S.actionValue}>{actionGuidance.where_to_check}</span>
                </div>
              )}
              {actionGuidance.what_to_check && (
                <div style={S.actionRow}>
                  <span style={S.actionLabel}>What:</span>
                  <span style={S.actionValue}>{actionGuidance.what_to_check}</span>
                </div>
              )}
              {actionGuidance.when_to_act && (
                <div style={S.actionRow}>
                  <span style={{ ...S.actionLabel, color: levelColor }}>When:</span>
                  <span style={{ ...S.actionValue, color: levelColor, fontWeight: 600 }}>{actionGuidance.when_to_act}</span>
                </div>
              )}
              {actionGuidance.when_to_recheck && (
                <div style={S.actionRow}>
                  <span style={S.actionLabel}>Recheck:</span>
                  <span style={S.actionValue}>{actionGuidance.when_to_recheck}</span>
                </div>
              )}
              {actionGuidance.escalation_condition && (
                <div style={{ ...S.actionRow, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
                  <span style={{ ...S.actionLabel, color: COLORS.red }}>Escalate if:</span>
                  <span style={{ ...S.actionValue, color: '#FCA5A5' }}>{actionGuidance.escalation_condition}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* What to inspect */}
        {inspections.length > 0 && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>{t('pest.whatToInspect')}</h3>
            {inspections.map((item, i) => (
              <div key={i} style={S.adviceItem}>
                <div style={{ ...S.adviceDot, background: COLORS.blue }} />
                <span style={S.adviceText}>
                  {typeof item === 'string' ? item : item.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Follow up */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.followUp')}</h3>
          <p style={{ ...S.followUpText, color: COLORS.amber }}>
            {t('pest.followUpIn', { days: followUpDays })}
          </p>
        </div>

        {/* Feedback */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.wasHelpful')}</h3>
          {feedbackSent ? (
            <p style={S.feedbackThanks}>{t('pest.feedbackThanks')}</p>
          ) : (
            <div style={S.feedbackRow}>
              <button
                style={S.feedbackBtn}
                onClick={() => handleFeedback(true)}
                disabled={fbLoading}
              >
                {'\uD83D\uDC4D'} {t('pest.yes')}
              </button>
              <button
                style={S.feedbackBtn}
                onClick={() => handleFeedback(false)}
                disabled={fbLoading}
              >
                {'\uD83D\uDC4E'} {t('pest.no')}
              </button>
            </div>
          )}
        </div>

        {/* CTA buttons */}
        <div style={S.ctaRow}>
          <button
            style={S.ctaBtn}
            onClick={() => navigate('/treatment-feedback', { state: { reportId } })}
          >
            {t('pest.logTreatment')}
          </button>
          <button
            style={S.ctaSecondary}
            onClick={() => navigate('/pest-risk-check')}
          >
            {t('pest.checkAgain') || 'Check Again'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    position: 'relative',
  },
  toast: {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: COLORS.green,
    color: COLORS.text,
    padding: '0.75rem 1.5rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: COLORS.subtext,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '0.5rem',
    display: 'block',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 1rem',
  },
  heroCard: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid ' + COLORS.cardBorder,
    padding: '1.5rem',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  scoreCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '4px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },
  scoreNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: '0.85rem',
    color: COLORS.muted,
    marginTop: '2px',
  },
  likelyIssue: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#E2E8F0',
    marginTop: '0.75rem',
  },
  confidence: {
    fontSize: '0.85rem',
    color: COLORS.muted,
    marginTop: '0.35rem',
  },
  levelMessage: {
    fontSize: '0.85rem',
    fontWeight: 600,
    marginTop: '0.5rem',
  },
  card: {
    borderRadius: '12px',
    background: COLORS.card,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 0.75rem',
  },
  adviceItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '0.6rem',
  },
  adviceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '6px',
  },
  adviceText: {
    fontSize: '0.9rem',
    color: '#CBD5E1',
    lineHeight: 1.5,
  },
  followUpText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    margin: 0,
  },
  feedbackRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  feedbackBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#E2E8F0',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  feedbackThanks: {
    fontSize: '0.9rem',
    color: COLORS.green,
    margin: 0,
  },
  ctaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: COLORS.green,
    color: COLORS.text,
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
  },
  ctaSecondary: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: COLORS.green,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: 'rgba(252,165,165,0.1)',
    border: '1px solid #FCA5A5',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    marginTop: '2rem',
  },
  retryBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
  actionRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
  },
  actionLabel: {
    fontSize: '0.78rem',
    color: COLORS.subtext,
    fontWeight: 600,
    minWidth: '60px',
    flexShrink: 0,
  },
  actionValue: {
    fontSize: '0.82rem',
    color: COLORS.text,
    lineHeight: 1.4,
  },
};
