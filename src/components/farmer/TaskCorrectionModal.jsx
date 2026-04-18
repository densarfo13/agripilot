/**
 * TaskCorrectionModal — "Something is wrong" flow (spec §3).
 *
 * Shows four short reasons. Each reason maps deterministically to a
 * next task status via taskCorrection.statusForReason:
 *
 *   I didn't do this yet       → ACTIVE  (re-open task)
 *   I tapped by mistake        → ACTIVE  (re-open task)
 *   This does not apply to me  → FLAGGED_FOR_REVIEW
 *   I need help                → HELP_REQUESTED
 *
 * Kept deliberately short and farmer-friendly. No free-form editing.
 */
import { useTranslation } from '../../i18n/index.js';
import { CORRECTION_REASON } from '../../services/taskCorrection.js';

const REASONS = [
  { value: CORRECTION_REASON.DIDNT_DO,       labelKey: 'correction.reason.didntDo' },
  { value: CORRECTION_REASON.TAP_BY_MISTAKE, labelKey: 'correction.reason.tapByMistake' },
  { value: CORRECTION_REASON.NOT_APPLICABLE, labelKey: 'correction.reason.notApplicable' },
  { value: CORRECTION_REASON.NEED_HELP,      labelKey: 'correction.reason.needHelp' },
];

export default function TaskCorrectionModal({ onPick, onCancel }) {
  const { t } = useTranslation();

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" data-testid="task-correction-modal">
      <div style={S.card}>
        <h2 style={S.title}>{t('correction.title')}</h2>
        <p style={S.subtitle}>{t('correction.subtitle')}</p>

        <div style={S.reasonList}>
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => onPick?.(r.value)}
              style={S.reasonBtn}
              data-testid={`correction-reason-${r.value}`}
            >
              <span style={S.reasonLabel}>{t(r.labelKey)}</span>
              <span style={S.chev}>{'\u203A'}</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onCancel} style={S.cancelBtn} data-testid="correction-cancel">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(5, 11, 22, 0.72)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
    animation: 'farroway-fade-in 0.2s ease-out',
  },
  card: {
    width: '100%', maxWidth: '22rem',
    borderRadius: '22px',
    background: 'rgba(16, 26, 42, 0.98)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.5rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: { fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.25rem', lineHeight: 1.4 },
  reasonList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' },
  reasonBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem', fontWeight: 600,
    cursor: 'pointer', minHeight: '48px',
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  reasonLabel: { flex: 1, minWidth: 0 },
  chev: { color: '#6F8299', fontSize: '1.25rem' },
  cancelBtn: {
    marginTop: '0.25rem',
    padding: '0.625rem 1rem',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.08)',
    background: 'transparent', color: '#9FB3C8',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
};
