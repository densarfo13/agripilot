import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { getFarmRisk, submitDiagnosisFeedback } from '../lib/intelligenceApi.js';
import RiskLevelBadge from '../components/intelligence/RiskLevelBadge.jsx';
import SeverityBar from '../components/intelligence/SeverityBar.jsx';

function riskLevel(score) {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'urgent';
}

function riskIcon(level) {
  if (level === 'low') return '\u2705';
  if (level === 'moderate') return '\u26A0\uFE0F';
  if (level === 'high') return '\uD83D\uDD36';
  return '\uD83D\uDED1';
}

export default function PestRiskResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;

  const [report, setReport] = useState(location.state?.report || null);
  const [loading, setLoading] = useState(!report);
  const [error, setError] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!report && profileId) {
      setLoading(true);
      getFarmRisk(profileId)
        .then(data => { setReport(data); setError(''); })
        .catch(err => setError(err.message || t('pest.loadError')))
        .finally(() => setLoading(false));
    }
  }, [profileId, report, t]);

  const handleFeedback = async (helpful) => {
    if (!report?.reportId) return;
    try {
      await submitDiagnosisFeedback(report.reportId, { helpful });
      setFeedbackSent(true);
    } catch {
      // silent — feedback is non-critical
    }
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingCenter}>
            <div style={S.spinner} />
            <p style={{ color: '#94A3B8' }}>{t('pest.loadingResults')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{error}</div>
          <button style={S.retryBtn} onClick={() => window.location.reload()}>
            {t('pest.retry')}
          </button>
        </div>
      </div>
    );
  }

  const score = report?.riskScore ?? report?.score ?? 50;
  const level = report?.riskLevel || riskLevel(score);
  const likelyIssue = report?.likelyIssue || report?.diagnosis || t('pest.likelyDamage');
  const confidence = report?.confidence ?? null;
  const actions = report?.actions || report?.recommendations || [];
  const inspections = report?.inspections || [];
  const followUpDays = report?.followUpDays ?? 7;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Back */}
        <button style={S.backLink} onClick={() => navigate(-1)}>
          {'\u2190'} {t('pest.backToScan')}
        </button>

        <h1 style={S.title}>{t('pest.resultTitle')}</h1>

        {/* Risk level hero */}
        <div style={S.heroCard}>
          <div style={S.heroIcon}>{riskIcon(level)}</div>
          <RiskLevelBadge level={level} score={score} size="lg" />
          <div style={S.likelyIssue}>{likelyIssue}</div>
          {confidence != null && (
            <div style={S.confidence}>
              {t('pest.confidence')}: {confidence}%
            </div>
          )}
        </div>

        {/* Severity bar */}
        <div style={S.card}>
          <SeverityBar score={score} label={t('pest.severity')} />
        </div>

        {/* What to do now */}
        <div style={{ ...S.card, borderLeft: '4px solid #22C55E' }}>
          <h3 style={S.sectionTitle}>{t('pest.whatToDoNow')}</h3>
          {actions.length > 0 ? (
            <ul style={S.list}>
              {actions.map((a, i) => (
                <li key={i} style={S.listItem}>
                  <span style={S.bullet}>{'\u2022'}</span>
                  <span>{typeof a === 'string' ? a : a.text || a.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={S.placeholder}>{t('pest.noActionsYet')}</p>
          )}
        </div>

        {/* What to inspect */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.whatToInspect')}</h3>
          {inspections.length > 0 ? (
            <ul style={S.list}>
              {inspections.map((item, i) => (
                <li key={i} style={S.listItem}>
                  <span style={S.bullet}>{'\uD83D\uDD0D'}</span>
                  <span>{typeof item === 'string' ? item : item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={S.placeholder}>{t('pest.inspectGeneral')}</p>
          )}
        </div>

        {/* Follow up */}
        <div style={S.card}>
          <h3 style={S.sectionTitle}>{t('pest.followUp')}</h3>
          <p style={S.followUpText}>
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
              <button style={S.feedbackBtn} onClick={() => handleFeedback(true)}>
                {'\uD83D\uDC4D'} {t('pest.yes')}
              </button>
              <button style={S.feedbackBtn} onClick={() => handleFeedback(false)}>
                {'\uD83D\uDC4E'} {t('pest.no')}
              </button>
            </div>
          )}
        </div>

        {/* Log treatment CTA */}
        <button
          style={S.ctaBtn}
          onClick={() => navigate('/treatment-feedback', { state: { reportId: report?.reportId || report?.id } })}
        >
          {t('pest.logTreatment')}
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '0.5rem',
    display: 'block',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 1rem',
  },
  heroCard: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1.5rem',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  heroIcon: {
    fontSize: '3rem',
    marginBottom: '0.75rem',
  },
  likelyIssue: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#E2E8F0',
    marginTop: '0.75rem',
  },
  confidence: {
    fontSize: '0.85rem',
    color: '#64748B',
    marginTop: '0.35rem',
  },
  card: {
    borderRadius: '12px',
    background: '#1B2330',
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: '#CBD5E1',
    lineHeight: 1.6,
    marginBottom: '0.4rem',
  },
  bullet: {
    color: '#22C55E',
    flexShrink: 0,
  },
  placeholder: {
    fontSize: '0.85rem',
    color: '#64748B',
    margin: 0,
  },
  followUpText: {
    fontSize: '0.95rem',
    color: '#FBBF24',
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
    color: '#22C55E',
    margin: 0,
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    marginTop: '0.5rem',
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
    borderTopColor: '#22C55E',
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
    color: '#94A3B8',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
};
