/**
 * OptionalChecksSection — proactive, *clearly optional* checks that
 * the farmer can tap to do when there's nothing required. Only
 * renders in the DONE state of the Today screen.
 *
 * Deliberately styled low-contrast so it doesn't look like an
 * unfinished required task. No urgency chips. No red dots.
 *
 * Items come from getTodayScreenState.OPTIONAL_CHECKS — the helper
 * owns the list so adding a new check doesn't require a UI change.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function OptionalChecksSection({ items = [], onPick }) {
  const { t } = useAppSettings();
  if (!items.length) return null;

  return (
    <section style={S.section} data-testid="optional-checks-section">
      <div style={S.header}>
        <h3 style={S.title}>{t('today.optional.title') || 'Optional checks'}</h3>
        <span style={S.badge}>{t('today.optional.badge') || 'optional'}</span>
      </div>

      <ul style={S.list}>
        {items.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              onClick={() => onPick?.(item)}
              style={S.item}
              data-testid={`optional-check-${item.code}`}
            >
              <span style={S.icon}>{item.iconEmoji}</span>
              <span style={S.body}>
                <span style={S.itemTitle}>{t(item.titleKey)}</span>
                <span style={S.itemWhy}>{t(item.whyKey)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const S = {
  section: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  header: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  title: {
    fontSize: '0.8125rem', fontWeight: 700, margin: 0, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  badge: {
    fontSize: '0.625rem', fontWeight: 700, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    padding: '0.125rem 0.375rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  item: {
    display: 'flex', width: '100%', gap: '0.625rem', alignItems: 'center',
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.05)',
    color: '#EAF2FF', textAlign: 'left', cursor: 'pointer',
    minHeight: '44px',
  },
  icon: { fontSize: '1.125rem', lineHeight: 1 },
  body: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  itemTitle: { fontSize: '0.875rem', fontWeight: 600, color: '#EAF2FF' },
  itemWhy:   { fontSize: '0.75rem', color: '#9FB3C8', lineHeight: 1.3 },
};
