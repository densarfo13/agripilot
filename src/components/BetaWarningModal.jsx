/**
 * BetaWarningModal — short, trust-safe confirmation shown when a farmer
 * selects a crop flagged status:'beta' (spec §2).
 *
 * Keeps the farmer in control:
 *   - clear title ("This crop is in testing")
 *   - two-line body
 *   - Continue button (primary)
 *   - Choose another crop (secondary → goes back)
 *
 * No tracking of acceptance beyond one analytics event — the engine
 * treats beta and supported crops the same once the user confirms.
 */
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { safeTrackEvent } from '../lib/analytics.js';
import CropImage from './CropImage.jsx';

/**
 * Props
 *   cropName  — display name (analytics + image alt text)
 *   cropCode  — canonical crop id (preferred); when set, renders
 *               the canonical CropImage artwork.
 *   cropIcon  — legacy emoji fallback for callers that haven't
 *               migrated to cropCode yet. Used only when cropCode
 *               is absent.
 */
export default function BetaWarningModal({ cropName, cropCode, cropIcon, onConfirm, onCancel }) {
  const { t } = useTranslation();

  function handleConfirm() {
    safeTrackEvent('beta.crop_confirmed', { crop: cropName });
    onConfirm?.();
  }

  function handleCancel() {
    safeTrackEvent('beta.crop_cancelled', { crop: cropName });
    onCancel?.();
  }

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" data-testid="beta-warning">
      <div style={S.card}>
        {/* Icon + beta chip — prefer canonical CropImage when the
            caller passes cropCode (visually consistent with the
            list view + detail card). Falls back to the legacy
            emoji prop for callers still on the old API. */}
        <div style={S.iconRow}>
          {cropCode
            ? <CropImage cropKey={cropCode} alt={cropName || ''} size={48} circular />
            : <span style={S.icon} aria-hidden="true">{cropIcon || '\uD83E\uDDEA'}</span>}
          <span style={S.betaChip}>{t('beta.label')}</span>
        </div>

        <h2 style={S.title}>{t('beta.warning.title')}</h2>
        <p style={S.body}>{t('beta.warning.body1')}</p>
        <p style={S.bodyMuted}>{t('beta.warning.body2')}</p>

        {/* CTAs */}
        <button
          type="button"
          onClick={handleConfirm}
          style={S.primaryBtn}
          data-testid="beta-confirm"
        >
          {t('beta.warning.continue')}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={S.secondaryBtn}
          data-testid="beta-cancel"
        >
          {t('beta.warning.chooseAnother')}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(5, 11, 22, 0.72)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
    animation: 'farroway-fade-in 0.2s ease-out',
  },
  card: {
    width: '100%', maxWidth: '22rem',
    borderRadius: '22px',
    background: 'rgba(16, 26, 42, 0.98)',
    border: '1px solid rgba(251,191,36,0.28)',
    padding: '1.75rem 1.5rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    textAlign: 'center',
  },
  iconRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '0.75rem', marginBottom: '0.25rem',
  },
  icon: { fontSize: '2.25rem', lineHeight: 1 },
  betaChip: {
    fontSize: '0.625rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.35)',
    color: '#FCD34D',
  },
  title: {
    fontSize: '1.25rem', fontWeight: 800,
    margin: '0.25rem 0 0.25rem',
    color: '#EAF2FF',
  },
  body: {
    fontSize: '0.9375rem', fontWeight: 600,
    color: '#EAF2FF', lineHeight: 1.4, margin: 0,
  },
  bodyMuted: {
    fontSize: '0.8125rem', color: '#9FB3C8',
    lineHeight: 1.4, margin: 0,
  },
  primaryBtn: {
    marginTop: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: '#22C55E', color: '#fff',
    border: 'none',
    fontSize: '0.9375rem', fontWeight: 800,
    cursor: 'pointer', minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  secondaryBtn: {
    padding: '0.625rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#9FB3C8',
    fontSize: '0.875rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
};
