/**
 * FarmerTask — single-task action card with voice guidance (Twi).
 *
 * Fixes applied:
 *   - Voice auto-play with cleanup on unmount
 *   - Voice replay cancels previous speech before starting
 *   - Inline error feedback instead of blocking alert()
 *   - Green CTA (not red — red means danger)
 *   - "What's next" guidance after completion (no dead end)
 *   - Haptic feedback on success
 *   - Accessible voice button with aria-label
 */
import { useEffect, useRef, useState } from 'react';

function speak(text) {
  window.speechSynthesis.cancel(); // cancel any ongoing speech
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'en-US'; // Twi voices may fallback to default
  window.speechSynthesis.speak(msg);
}

export default function FarmerTask({ onComplete, onNext }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  // Auto-voice on mount with cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      speak('Yɛ wo afuo ho. Yi nwura ne nneɛma a ɛwɔ ho no.');
    }, 400);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleDone = async () => {
    if (saving || done) return;
    setSaving(true);
    setError(null);

    if (navigator.vibrate) try { navigator.vibrate(50); } catch {}

    try {
      await onComplete();
      if (!mountedRef.current) return;

      setDone(true);
      speak('Wɔayɛ no yie');
      if (navigator.vibrate) try { navigator.vibrate([30, 50]); } catch {}
    } catch (e) {
      if (!mountedRef.current) return;
      setError('Ɛanyɛ yie. San yɛ bio.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <div style={S.container}>
      {/* Icon */}
      <div style={S.icon}>{'\uD83C\uDFAF'}</div>

      {/* Title */}
      <h2 style={S.title}>Yɛ wo afuo ho</h2>

      {/* Subtitle */}
      <p style={S.subtitle}>Yi nwura ne nneɛma a ɛwɔ ho no</p>

      {/* Voice replay */}
      <button
        onClick={() => speak('Yɛ wo afuo ho. Yi nwura ne nneɛma a ɛwɔ ho no.')}
        style={S.voiceBtn}
        aria-label="Tie bio (Hear again)"
      >
        {'\uD83D\uDD0A'} Tie bio
      </button>

      {/* Error feedback (inline, not alert) */}
      {error && (
        <div style={S.errorBanner}>
          {'\u26A0\uFE0F'} {error}
        </div>
      )}

      {/* Main CTA */}
      {!done && (
        <button
          onClick={handleDone}
          disabled={saving}
          style={{ ...S.cta, ...(saving ? S.ctaDisabled : {}) }}
        >
          {saving ? 'Rekora...' : '\u2714 Yɛ sɛesei'}
        </button>
      )}

      {/* Success + next action */}
      {done && (
        <div style={S.successSection}>
          <div style={S.successBanner}>
            {'\u2705'} Wɔakora so
          </div>
          {onNext && (
            <button onClick={onNext} style={S.nextBtn}>
              {'\u2192'} Kɔ adwuma a edi so
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  container: {
    padding: '1.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  icon: {
    fontSize: '4rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 0.5rem 0',
  },
  voiceBtn: {
    background: 'none',
    border: 'none',
    color: '#86EFAC',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.5rem 1rem',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  errorBanner: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  cta: {
    width: '100%',
    padding: '1rem',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    marginTop: '0.5rem',
    boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
    WebkitTapHighlightColor: 'transparent',
  },
  ctaDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  successSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  successBanner: {
    padding: '1rem',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#86EFAC',
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  nextBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: '1px solid rgba(34,197,94,0.3)',
    background: 'transparent',
    color: '#86EFAC',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
};
