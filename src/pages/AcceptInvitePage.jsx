/**
 * AcceptInvitePage — public page farmers use to activate their account via an invite link.
 *
 * Flow:
 * 1. Admin invites farmer → invite link generated: /accept-invite?token=xxx
 * 2. Admin copies link and shares manually (email, WhatsApp, SMS, etc.)
 * 3. Farmer visits link → this page validates the token and pre-fills form
 * 4. Farmer sets email + password → POST /api/invites/:token/accept
 * 5. Account created, farmer can log in immediately
 *
 * Security:
 * - Token is read-only in UI — farmer cannot modify it
 * - Token is consumed on acceptance (single-use)
 * - Expired tokens show a clear error with instructions
 * - Pre-filled fields (name, phone) are read-only — sourced from staff-created record
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { useTranslation, LANGUAGES as I18N_LANGUAGES } from '../i18n/index.js';
import PasswordInput from '../components/PasswordInput.jsx';

const LANGUAGES = I18N_LANGUAGES;

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | valid | expired | invalid | done
  const [inviteData, setInviteData] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);

  const { t } = useTranslation();

  // Validate the token on page load
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setTokenError('No invite token found in this link.');
      return;
    }

    trackPilotEvent('invite_opened', { token: token?.slice(0, 8) });
    api.get(`/invites/${token}/validate`)
      .then(r => {
        setInviteData(r.data);
        setStatus('valid');
      })
      .catch(err => {
        // Distinguish network errors from server responses
        if (!err.response) {
          setStatus('network_error');
          setTokenError('Could not connect to the server. Please check your internet connection and try again.');
          return;
        }
        const data = err.response?.data;
        if (data?.expired) {
          setStatus('expired');
          setTokenError(data.error || 'Invite link has expired.');
        } else if (err.response?.status === 400) {
          // Already accepted
          setStatus('already_accepted');
          setTokenError(data?.error || 'This invite has already been used.');
        } else if (err.response?.status === 404 && data?.cancelled) {
          setStatus('invalid');
          setTokenError('This invite has been cancelled by your administrator. Please contact them to request a new invite.');
        } else {
          setStatus('invalid');
          setTokenError(data?.error || 'This invite link is invalid or has already been used.');
        }
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return; // prevent double-submit during async window
    setFormError('');

    if (password !== confirmPassword) {
      return setFormError(t('invite.passwordMismatch'));
    }
    if (password.length < 8) {
      return setFormError(t('invite.passwordTooShort'));
    }

    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      // Timeout-protected invite accept
      const acceptPromise = api.post(`/invites/${token}/accept`, { email, password });
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('__timeout__')), 15000)
      );
      await Promise.race([acceptPromise, timeoutPromise]);
      setStatus('done');
    } catch (err) {
      if (err?.message === '__timeout__') {
        setFormError(t('invite.takingTooLong'));
      } else {
        const data = err.response?.data;
        if (data?.expired) {
          setStatus('expired');
          setTokenError(data.error);
        } else {
          setFormError(data?.error || t('invite.failedActivate'));
        }
      }
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>Farroway</div>
          <p style={{ textAlign: 'center', color: '#A1A1AA' }}>{t('invite.validating')}</p>
        </div>
      </div>
    );
  }

  // ─── Network Error ───────────────────────────────────────
  if (status === 'network_error') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>Farroway</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📡</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>{t('invite.connectionProblem')}</h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', lineHeight: 1.5 }}>{tokenError}</p>
          </div>
          <button onClick={() => { setStatus('loading'); setTokenError(''); window.location.reload(); }} style={styles.button}>{t('common.retry')}</button>
        </div>
      </div>
    );
  }

  // ─── Invalid / Expired ───────────────────────────────────
  if (status === 'invalid' || status === 'expired') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>Farroway</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{status === 'expired' ? '⏰' : '🔗'}</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
              {status === 'expired' ? t('invite.expired') : t('invite.invalid')}
            </h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {status === 'expired'
                ? t('invite.expiredContact')
                : tokenError}
            </p>
          </div>
          {status === 'expired' && (
            <div style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid #854d0e', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#FACC15', marginBottom: '1rem' }}>
              <strong>{t('invite.whatToDo')}</strong> Contact your field officer or organization admin and ask them to resend the invite. A new link will be generated for you. If you do not know who your field officer is, reach out to your organization's support team.
            </div>
          )}
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#A1A1AA', marginBottom: 0 }}>
            {t('invite.alreadyAccount')} <Link to="/login" style={{ color: '#22C55E' }}>{t('invite.signIn')}</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Already accepted ────────────────────────────────────
  if (status === 'already_accepted') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>Farroway</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>{t('invite.alreadyActivated')}</h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', lineHeight: 1.5 }}>{tokenError}</p>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>{t('invite.goToLogin')}</button>
        </div>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>Farroway</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, margin: '0 auto 1rem' }}>✓</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: '#22C55E' }}>{t('invite.accountActivated')}</h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {t('invite.welcomeTo')} <strong>{inviteData?.fullName}</strong>. Your account is ready. You can now sign in with your email and password.
            </p>
            <div style={{ background: 'var(--info-light, #0c2d48)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '0.6rem 0.85rem', fontSize: '0.85rem', color: 'var(--info, #0EA5E9)', marginTop: '0.75rem', lineHeight: 1.5 }}>
              <strong>What happens next:</strong> After signing in you'll set up your farm profile — add your farm name, crop, and location. It takes about 2 minutes.
            </div>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>{t('invite.signInNow')}</button>
        </div>
      </div>
    );
  }

  // ─── Valid — show activation form ────────────────────────
  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '460px' }}>
        <div style={styles.logo}>Farroway</div>
        <h1 style={styles.title}>{t('invite.activateAccount')}</h1>

        {inviteData && (
          <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#A1A1AA' }}>
            <strong>{t('invite.welcome')} {inviteData.fullName}!</strong><br />
            {t('invite.profileSetUp')}
            {inviteData.expiresAt && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#22C55E' }}>
                This link expires on {new Date(inviteData.expiresAt).toLocaleDateString()}.
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {formError && <div style={styles.error}>{formError}</div>}

          {/* Pre-filled, read-only fields from the farmer record */}
          <div style={styles.sectionLabel}>{t('invite.yourProfile')}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.fullName')}</label>
              <input style={{ ...styles.input, background: '#0F172A', color: '#71717A' }} value={inviteData?.fullName || ''} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.phone')}</label>
              <input style={{ ...styles.input, background: '#0F172A', color: '#71717A' }} value={inviteData?.phone || ''} readOnly />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.region')}</label>
              <input style={{ ...styles.input, background: '#0F172A', color: '#71717A' }} value={inviteData?.region || ''} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.language')}</label>
              <input style={{ ...styles.input, background: '#0F172A', color: '#71717A' }} value={LANGUAGES.find(l => l.code === inviteData?.preferredLanguage)?.label || inviteData?.preferredLanguage || ''} readOnly />
            </div>
          </div>

          <div style={styles.sectionLabel}>{t('invite.createCredentials')}</div>
          <div>
            <label style={styles.fieldLabel}>{t('invite.email')} *</label>
            <input
              style={styles.input}
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.password')} *</label>
              <PasswordInput
                style={styles.input}
                required
                placeholder={t('invite.min8chars')}
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                testIdPrefix="invite-password"
                toggleAriaLabels={{
                  show: t('auth.showPassword') || 'Show password',
                  hide: t('auth.hidePassword') || 'Hide password',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>{t('invite.confirmPassword')} *</label>
              <PasswordInput
                style={styles.input}
                required
                placeholder={t('invite.repeatPassword')}
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                testIdPrefix="invite-confirm"
                toggleAriaLabels={{
                  show: t('auth.showPassword') || 'Show password',
                  hide: t('auth.hidePassword') || 'Hide password',
                }}
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? t('invite.activating') : t('invite.activate')}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#A1A1AA', margin: '0.5rem 0 0' }}>
            {t('invite.alreadyAccount')} <Link to="/login" style={{ color: '#22C55E' }}>{t('invite.signIn')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0F172A', padding: '1rem',
  },
  card: {
    background: '#162033', borderRadius: 8, padding: '2rem', width: '100%', maxWidth: 400,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  logo: {
    fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', textAlign: 'center',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF', textAlign: 'center',
    marginBottom: '1rem', marginTop: '0.25rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  input: {
    display: 'block', width: '100%', padding: '0.6rem 0.75rem',
    border: '1px solid #243041', borderRadius: 6, fontSize: '0.875rem',
    outline: 'none', boxSizing: 'border-box', background: '#1E293B', color: '#FFFFFF',
  },
  fieldLabel: {
    display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.2rem',
  },
  sectionLabel: {
    fontSize: '0.75rem', fontWeight: 700, color: '#A1A1AA', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginTop: '0.25rem',
  },
  button: {
    padding: '0.75rem', background: '#22C55E', color: '#fff', border: 'none',
    borderRadius: 6, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
    marginTop: '0.25rem',
  },
  error: {
    background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '0.65rem 0.75rem',
    borderRadius: 6, fontSize: '0.875rem',
  },
};
