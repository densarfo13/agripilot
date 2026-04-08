import React, { useState } from 'react';

const CROPS = [
  { value: 'maize', label: 'Maize', icon: '🌽' },
  { value: 'rice', label: 'Rice', icon: '🌾' },
  { value: 'cassava', label: 'Cassava', icon: '🥔' },
  { value: 'wheat', label: 'Wheat', icon: '🌿' },
];

const STAGES = [
  { value: 'planting', label: 'Planting' },
  { value: 'growing', label: 'Growing' },
  { value: 'flowering', label: 'Flowering' },
  { value: 'harvest', label: 'Harvest' },
];

const STEPS = ['welcome', 'farm', 'crop', 'processing'];

// Inject spinner keyframe once
if (typeof document !== 'undefined' && !document.getElementById('farroway-spin')) {
  const style = document.createElement('style');
  style.id = 'farroway-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

export default function OnboardingWizard({ userName, onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    farmName: '', farmSizeAcres: '', locationName: '',
    crop: '', stage: 'planting',
  });
  const [submitting, setSubmitting] = useState(false);

  const currentStep = STEPS[step];

  const canProceed = () => {
    if (currentStep === 'farm') return form.farmName.trim().length > 0;
    if (currentStep === 'crop') return form.crop.length > 0;
    return true;
  };

  const handleNext = async () => {
    if (currentStep === 'crop') {
      setStep(3); // processing
      setSubmitting(true);
      try {
        await onComplete({
          farmName: form.farmName.trim(),
          farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : null,
          locationName: form.locationName.trim() || null,
          crop: form.crop,
          stage: form.stage,
        });
      } catch {
        setStep(2); // go back to crop on error
        setSubmitting(false);
      }
      return;
    }
    setStep(s => s + 1);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Progress dots */}
        <div style={styles.progress}>
          {STEPS.slice(0, 3).map((_, i) => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: i <= step ? '#22C55E' : '#243041',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {currentStep === 'welcome' && (
          <div style={styles.stepContent}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
            <h2 style={styles.title}>Welcome to Farroway</h2>
            <p style={styles.subtitle}>
              Hi {userName || 'there'}! Let's set up your farm in just a few steps so we can give you personalised recommendations.
            </p>
            <button onClick={handleNext} style={styles.primaryBtn}>Get Started</button>
          </div>
        )}

        {currentStep === 'farm' && (
          <div style={styles.stepContent}>
            <h2 style={styles.title}>Your Farm</h2>
            <p style={styles.subtitle}>Tell us about your farm</p>
            <div style={styles.field}>
              <label style={styles.label}>Farm Name *</label>
              <input
                value={form.farmName}
                onChange={e => setForm(f => ({ ...f, farmName: e.target.value }))}
                placeholder="e.g. Sunrise Farm"
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Farm Size (acres)</label>
              <input
                value={form.farmSizeAcres}
                onChange={e => setForm(f => ({ ...f, farmSizeAcres: e.target.value }))}
                placeholder="e.g. 5"
                type="number"
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location</label>
              <input
                value={form.locationName}
                onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                placeholder="e.g. Nakuru, Kenya"
                style={styles.input}
              />
            </div>
            <div style={styles.btnRow}>
              <button onClick={() => setStep(0)} style={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} disabled={!canProceed()} style={{
                ...styles.primaryBtn, opacity: canProceed() ? 1 : 0.5,
              }}>Next</button>
            </div>
          </div>
        )}

        {currentStep === 'crop' && (
          <div style={styles.stepContent}>
            <h2 style={styles.title}>What are you growing?</h2>
            <p style={styles.subtitle}>Select your primary crop</p>
            <div style={styles.cropGrid}>
              {CROPS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, crop: c.value }))}
                  style={{
                    ...styles.cropCard,
                    borderColor: form.crop === c.value ? '#22C55E' : '#243041',
                    background: form.crop === c.value ? 'rgba(34,197,94,0.1)' : '#1E293B',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.label}</span>
                </button>
              ))}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Current Stage</label>
              <select
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                style={styles.input}
              >
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={styles.btnRow}>
              <button onClick={() => setStep(1)} style={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} disabled={!canProceed()} style={{
                ...styles.primaryBtn, opacity: canProceed() ? 1 : 0.5,
              }}>Create My Farm</button>
            </div>
          </div>
        )}

        {currentStep === 'processing' && (
          <div style={{ ...styles.stepContent, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
            <h2 style={styles.title}>Setting up your farm...</h2>
            <p style={styles.subtitle}>
              We're creating your farm profile and preparing your first recommendations.
            </p>
            <div style={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
  },
  modal: {
    background: '#162033', borderRadius: '12px', padding: '2rem',
    maxWidth: '420px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  progress: {
    display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '1.5rem',
  },
  stepContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  title: { margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  subtitle: { color: '#A1A1AA', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 1.5rem', lineHeight: 1.5 },
  field: { width: '100%', marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.3rem' },
  input: {
    width: '100%', padding: '0.6rem 0.75rem', background: '#1E293B', border: '1px solid #243041',
    borderRadius: '6px', color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  },
  cropGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%', marginBottom: '1rem',
  },
  cropCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
    padding: '1rem', borderRadius: '8px', border: '2px solid',
    cursor: 'pointer', color: '#FFFFFF', transition: 'all 0.2s',
  },
  btnRow: { display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' },
  primaryBtn: {
    flex: 1, padding: '0.7rem', background: '#22C55E', color: '#fff', border: 'none',
    borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '0.7rem 1.2rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #243041', borderTop: '3px solid #22C55E',
    borderRadius: '50%', animation: 'spin 1s linear infinite', marginTop: '1rem',
  },
};
