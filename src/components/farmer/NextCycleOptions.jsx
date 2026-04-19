/**
 * NextCycleOptions — up to three tap-to-act CTAs that land the
 * farmer on their next crop cycle instead of a dead-end "success"
 * screen.
 *
 * Server payload shape (from nextCycleEngine.getNextCycleRecommendations):
 *   {
 *     headlineKey,
 *     adjustments: { confidenceMultiplier, riskBaseline, outcomeClass },
 *     options: [
 *       { type: 'repeat_improved' | 'switch_crop' | 'delay_same_crop'
 *               | 'auto_pick',
 *         cropKey, reasonKey, fitLevel?, confidence?,
 *         plantingStatus?, plantingWindowExplanation? },
 *       …
 *     ]
 *   }
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';

const TYPE_ACCENT = {
  repeat_improved:  '#22C55E',
  switch_crop:      '#0EA5E9',
  delay_same_crop:  '#F59E0B',
  auto_pick:        '#EAF2FF',
};

export default function NextCycleOptions({ data, onPick }) {
  const { t, language } = useAppSettings();
  if (!data?.options?.length) return null;

  return (
    <section style={S.section} data-testid="next-cycle-options">
      <h3 style={S.title}>
        {t(data.headlineKey) || t('nextCycle.title') || 'What\'s next?'}
      </h3>

      <div style={S.list}>
        {data.options.map((opt) => {
          const accent = TYPE_ACCENT[opt.type] || '#EAF2FF';
          const cropLabel = opt.cropKey
            ? getCropDisplayName(opt.cropKey, language, { bilingual: 'auto' })
            : null;
          return (
            <button
              key={`${opt.type}:${opt.cropKey || 'auto'}`}
              type="button"
              onClick={() => onPick?.(opt)}
              style={{ ...S.card, borderColor: hexAlpha(accent, 0.3) }}
              data-testid={`next-cycle-option-${opt.type}`}
            >
              <span style={{ ...S.tag, color: accent, borderColor: accent }}>
                {t(`nextCycle.type.${opt.type}`) || opt.type}
              </span>
              {cropLabel && (
                <div style={S.cropRow}>
                  <strong>{cropLabel}</strong>
                  {opt.fitLevel && (
                    <span style={S.meta}>{t(`fit.${opt.fitLevel}`)}</span>
                  )}
                  {opt.confidence && (
                    <span style={S.meta}>{t(`confidence.${opt.confidence}`)}</span>
                  )}
                </div>
              )}
              <p style={S.reason}>{t(opt.reasonKey)}</p>
              {opt.plantingWindowExplanation && (
                <p style={S.window}>{opt.plantingWindowExplanation}</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function hexAlpha(hex, a) {
  // Minimal #RRGGBB → rgba(...) so the card border shows the accent
  // at a muted intensity without shipping a colour library.
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const S = {
  section: {
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
  },
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.25rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  card: {
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
    padding: '0.875rem 1rem', borderRadius: '14px',
    border: '1px solid',
    background: 'rgba(255,255,255,0.03)',
    color: '#EAF2FF', textAlign: 'left', cursor: 'pointer',
    minHeight: '56px',
  },
  tag: {
    alignSelf: 'flex-start',
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    border: '1px solid', fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  cropRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' },
  meta: { fontSize: '0.75rem', color: '#9FB3C8' },
  reason: { margin: 0, fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  window: { margin: 0, fontSize: '0.75rem', color: '#6F8299', lineHeight: 1.3 },
};
