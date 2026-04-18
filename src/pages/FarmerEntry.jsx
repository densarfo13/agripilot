/**
 * FarmerEntry — the single farmer-facing Welcome gate.
 *
 * Low-friction, high-trust app entry. Behavior:
 *
 *   1. While auth is restoring         → brand spinner (no flash)
 *   2. Authenticated + has a farm      → /dashboard (Case A/B)
 *   3. Authenticated + no farm         → /crop-fit (Case C)
 *   4. Not authenticated               → show Welcome with
 *                                        [ Start a new crop ] (primary)
 *                                        [ Continue my farm ] (secondary)
 *
 * Both buttons hand off to /farmer-welcome with an `intent` flag so
 * FarmerWelcome can route the farmer straight to the right next step
 * after phone/OTP / Google / offline auth.
 */
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';

export default function FarmerEntry() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, authLoading, user } = useAuth();
  const { profile, activeFarms, initialized, loading } = useProfile();

  // ── Track Welcome view (only on initial anonymous show)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      safeTrackEvent('entry.welcome_shown', {});
    }
  }, [authLoading, isAuthenticated]);

  // ── While auth/profile is resolving: show brand spinner
  if (authLoading || (isAuthenticated && !initialized && loading)) {
    return (
      <div style={S.page}>
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <span style={S.brandLoader}>Farroway</span>
        </div>
      </div>
    );
  }

  // ── Authenticated — auto-route
  if (isAuthenticated) {
    // Staff users go to their admin dashboard instead of farmer home
    if (user?.role && user.role !== 'farmer') {
      return <Navigate to="/dashboard" replace />;
    }

    const hasFarm = (activeFarms && activeFarms.length > 0) || !!profile?.id;
    if (hasFarm) {
      // Case A/B: session + farm → Home
      return <Navigate to="/dashboard" replace />;
    }
    // Case C: authenticated but no farm yet → Start a new crop
    return <Navigate to="/crop-fit" replace />;
  }

  // ── Anonymous — show the spec's Welcome screen
  function handleStartNewCrop() {
    safeTrackEvent('entry.start_new', {});
    navigate('/farmer-welcome', { state: { intent: 'new' } });
  }

  function handleContinueMyFarm() {
    safeTrackEvent('entry.continue_farm', {});
    navigate('/farmer-welcome', { state: { intent: 'continue' } });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Brand */}
        <div style={S.brandRow}>
          <span style={S.brandIcon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
          <span style={S.brandName}>Farroway</span>
        </div>

        {/* Value line */}
        <h1 style={S.valueLine}>{t('entry.valueLine')}</h1>

        {/* Primary actions */}
        <div style={S.actions}>
          <button
            type="button"
            onClick={handleStartNewCrop}
            style={S.primaryBtn}
            data-testid="entry-start-new"
          >
            <span style={S.btnIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
            <span>{t('entry.startNewCrop')}</span>
          </button>

          <button
            type="button"
            onClick={handleContinueMyFarm}
            style={S.secondaryBtn}
            data-testid="entry-continue-farm"
          >
            <span style={S.btnIcon} aria-hidden="true">{'\uD83C\uDFE1'}</span>
            <span>{t('entry.continueFarm')}</span>
          </button>
        </div>

        {/* Short reassurance */}
        <p style={S.reassurance}>{t('entry.reassurance')}</p>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brandLoader: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '2.25rem 1.75rem',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    animation: 'farroway-fade-in 0.3s ease-out',
    textAlign: 'center',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '1.75rem',
  },
  brandIcon: { fontSize: '2rem' },
  brandName: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#22C55E',
    letterSpacing: '0.01em',
  },
  valueLine: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    lineHeight: 1.3,
    margin: '0 0 1.75rem',
    maxWidth: '18rem',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '1rem',
    borderRadius: '16px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '1.0625rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
  btnIcon: { fontSize: '1.125rem', lineHeight: 1 },
  reassurance: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 500,
    margin: '1.25rem 0 0',
  },
};
