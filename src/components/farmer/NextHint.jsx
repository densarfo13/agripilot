/**
 * NextHint — tiny one-liner at the bottom of the Today screen that
 * tells the farmer what's coming *next* after today's task is done.
 *
 *   Next: Fertilize in 2 days
 *
 * Renders nothing if there's nothing to say, so the Today screen
 * never fills with placeholder noise.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function NextHint({ text }) {
  const { t } = useAppSettings();
  if (!text) return null;
  return (
    <p style={S.row} data-testid="today-next-hint">
      <span style={S.label}>{t('actionHome.nextHint.label') || 'Next:'}</span>
      <span style={S.text}>{text}</span>
    </p>
  );
}

const S = {
  row: {
    margin: '0.25rem 0 0',
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    lineHeight: 1.4,
  },
  label: { color: '#6F8299', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem' },
  text: { color: '#EAF2FF', fontWeight: 500 },
};
