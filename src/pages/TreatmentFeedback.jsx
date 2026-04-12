import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { logTreatment, logTreatmentOutcome } from '../lib/intelligenceApi.js';

const TREATMENT_TYPES = ['chemical_spray', 'biological_control', 'manual_removal', 'organic_treatment', 'other'];
const OUTCOME_OPTIONS = ['improved', 'same', 'worse', 'resolved'];

export default function TreatmentFeedback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reportId = location.state?.reportId;

  const [step, setStep] = useState(1);
  const [treatmentType, setTreatmentType] = useState('');
  const [productUsed, setProductUsed] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [treatmentId, setTreatmentId] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleLogTreatment = async () => {
    if (!reportId || !treatmentType) return;
    setLoading(true);
    setError('');
    try {
      const res = await logTreatment(reportId, {
        treatmentType,
        productUsed: productUsed.trim() || null,
        notes: notes.trim() || null,
        appliedAt: new Date().toISOString(),
      });
      setTreatmentId(res.treatmentId || res.id);
      setStep(2);
    } catch (err) {
      setError(err.message || t('treatment.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogOutcome = async () => {
    if (!treatmentId || !outcome) return;
    setLoading(true);
    setError('');
    try {
      await logTreatmentOutcome(treatmentId, {
        outcomeStatus: outcome,
        notes: notes.trim() || null,
        observedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || t('treatment.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!reportId) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{t('treatment.noReport')}</div>
          <button style={S.backBtn} onClick={() => navigate(-1)}>
            {t('pest.back')}
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.successCard}>
            <div style={S.successIcon}>{'\u2705'}</div>
            <h2 style={S.successTitle}>{t('treatment.recorded')}</h2>
            <p style={S.successText}>{t('treatment.recordedDesc')}</p>
            <button style={S.ctaBtn} onClick={() => navigate('/dashboard')}>
              {t('treatment.backToDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button style={S.backLink} onClick={() => navigate(-1)}>
          {'\u2190'} {t('pest.back')}
        </button>
        <h1 style={S.title}>
          {step === 1 ? t('treatment.logTitle') : t('treatment.outcomeTitle')}
        </h1>
        <p style={S.subtitle}>
          {step === 1 ? t('treatment.logSubtitle') : t('treatment.outcomeSubtitle')}
        </p>

        {error && <div style={S.errorBox}>{error}</div>}

        {step === 1 && (
          <div style={S.card}>
            <label style={S.label}>{t('treatment.type')}</label>
            <div style={S.optionGrid}>
              {TREATMENT_TYPES.map(tt => (
                <button
                  key={tt}
                  type="button"
                  style={{
                    ...S.optionBtn,
                    background: treatmentType === tt ? '#22C55E' : 'rgba(255,255,255,0.06)',
                    color: treatmentType === tt ? '#fff' : '#94A3B8',
                    borderColor: treatmentType === tt ? '#22C55E' : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setTreatmentType(tt)}
                >
                  {t(`treatment.type.${tt}`)}
                </button>
              ))}
            </div>

            <label style={S.label}>{t('treatment.product')}</label>
            <input
              type="text"
              style={S.input}
              placeholder={t('treatment.productPlaceholder')}
              value={productUsed}
              onChange={e => setProductUsed(e.target.value)}
            />

            <label style={S.label}>{t('treatment.notes')}</label>
            <textarea
              style={S.textarea}
              placeholder={t('treatment.notesPlaceholder')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />

            <button
              style={{ ...S.ctaBtn, opacity: treatmentType && !loading ? 1 : 0.5 }}
              onClick={handleLogTreatment}
              disabled={!treatmentType || loading}
            >
              {loading ? t('treatment.saving') : t('treatment.save')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={S.card}>
            <label style={S.label}>{t('treatment.howDidItGo')}</label>
            <div style={S.optionGrid}>
              {OUTCOME_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  style={{
                    ...S.optionBtn,
                    background: outcome === opt ? '#22C55E' : 'rgba(255,255,255,0.06)',
                    color: outcome === opt ? '#fff' : '#94A3B8',
                    borderColor: outcome === opt ? '#22C55E' : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setOutcome(opt)}
                >
                  {t(`treatment.outcome.${opt}`)}
                </button>
              ))}
            </div>

            <label style={S.label}>{t('treatment.notes')}</label>
            <textarea
              style={S.textarea}
              placeholder={t('treatment.outcomeNotesPlaceholder')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />

            <button
              style={{ ...S.ctaBtn, opacity: outcome && !loading ? 1 : 0.5 }}
              onClick={handleLogOutcome}
              disabled={!outcome || loading}
            >
              {loading ? t('treatment.saving') : t('treatment.submitOutcome')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', padding: '1rem 1rem 2rem' },
  container: { maxWidth: '48rem', margin: '0 auto' },
  backLink: { background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.85rem', cursor: 'pointer', padding: '8px 0', marginBottom: '0.5rem', display: 'block' },
  title: { fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { fontSize: '0.9rem', color: '#94A3B8', margin: '0 0 1.25rem' },
  card: { borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8', marginBottom: '0.5rem', marginTop: '1rem' },
  optionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
  optionBtn: { padding: '12px 8px', border: '1.5px solid', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', transition: 'all 0.15s' },
  input: { width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#0F172A', color: '#fff', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#0F172A', color: '#fff', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' },
  ctaBtn: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#22C55E', color: '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px', marginTop: '1.25rem' },
  backBtn: { padding: '12px 24px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94A3B8', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' },
  successCard: { borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(34,197,94,0.2)', padding: '2.5rem 1.5rem', textAlign: 'center', marginTop: '2rem' },
  successIcon: { fontSize: '3rem', marginBottom: '0.75rem' },
  successTitle: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' },
  successText: { fontSize: '0.9rem', color: '#94A3B8', margin: '0 0 1.5rem' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '1rem' },
};
