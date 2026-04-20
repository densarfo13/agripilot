/**
 * StepUpModal — rendered globally when the API returns a 401 STEP_UP_REQUIRED.
 *
 * The user re-verifies their TOTP code at POST /api/auth/step-up.
 * On success the fresh JWT (with updated mfaVerifiedAt) is saved to authStore,
 * then the user retries the action that triggered the gate.
 */
import React, { useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import {
  flushStepUpRetryQueue, rejectStepUpRetryQueue,
} from '../core/auth/stepUpRetryQueue.js';

export default function StepUpModal() {
  const setStepUpRequired = useAuthStore((s) => s.setStepUpRequired);
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/step-up', { code });
      setAuth(data.user, data.accessToken);
      setStepUpRequired(false);
      setCode('');
      // Auto-replay every request that was 401-ed with STEP_UP_REQUIRED.
      // This is what turns "empty admin page" into "admin page with data".
      flushStepUpRetryQueue((cfg) => api(cfg)).catch(() => { /* per-item errors already delivered */ });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStepUpRequired(false);
    setCode('');
    setError('');
    // Cancel = every queued caller should know their request is dead.
    rejectStepUpRetryQueue(new Error('step_up_cancelled'));
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="step-up-title">
        <div style={styles.lockIcon}>🔐</div>
        <h2 id="step-up-title" style={styles.title}>Identity Verification Required</h2>
        <p style={styles.body}>
          This action requires a fresh MFA verification.
          Enter the current 6-digit code from your authenticator app.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9A-Fa-f]{6,10}"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            maxLength={10}
            style={styles.input}
            autoFocus
            required
          />
          <div style={styles.buttons}>
            <button type="button" onClick={handleCancel} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading || code.length < 6} style={styles.verifyBtn}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        </form>

        <p style={styles.hint}>
          Lost access? Enter a 10-character backup code instead.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    background: '#162033', borderRadius: '10px', padding: '2rem',
    width: '100%', maxWidth: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  lockIcon: { textAlign: 'center', fontSize: '2rem', marginBottom: '0.75rem' },
  title: { fontSize: '1.125rem', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: '0.5rem' },
  body: { fontSize: '0.875rem', color: '#A1A1AA', textAlign: 'center', marginBottom: '1.25rem', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  input: {
    padding: '0.75rem', border: '1px solid #243041', borderRadius: '6px',
    fontSize: '1.25rem', textAlign: 'center', letterSpacing: '0.25em', outline: 'none',
    width: '100%', boxSizing: 'border-box', background: '#1E293B', color: '#FFFFFF',
  },
  buttons: { display: 'flex', gap: '0.625rem' },
  cancelBtn: {
    flex: 1, padding: '0.7rem', border: '1px solid #243041', borderRadius: '6px',
    background: '#162033', color: '#A1A1AA', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem',
  },
  verifyBtn: {
    flex: 2, padding: '0.7rem', border: 'none', borderRadius: '6px',
    background: '#22C55E', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
  },
  error: {
    background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '0.625rem 0.75rem',
    borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center',
  },
  hint: { fontSize: '0.75rem', color: '#71717A', textAlign: 'center', marginTop: '0.875rem' },
};
