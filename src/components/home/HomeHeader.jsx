/**
 * HomeHeader — unified greeting + streak chip at the top of the
 * farmer Home tab.
 *
 * Spec coverage (UI polish §3, §7)
 *   §3 Greeting + streak header
 *   §7 Improved spacing — compact but generous padding
 *
 * Behaviour
 *   • Time-of-day aware greeting (Good morning / afternoon /
 *     evening) using local hour.
 *   • Reads farmer's first name from FarmerHomePage's context
 *     (passed in as `name` prop). Falls back to a generic
 *     "Welcome back" line when no name is available.
 *   • StreakChip renders in the right slot when the streak ≥ 1.
 *   • Self-suppresses behind `uiPolish` flag.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import StreakChip from '../engagement/StreakChip.jsx';

const S = {
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px 16px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    marginBottom: 12,
    color: '#fff',
  },
  textCol: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  greeting: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: '#fff',
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.45,
  },
  rightCol: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: '0 0 auto',
  },
};

function _greetingKey(now = new Date()) {
  let hour = 0;
  try { hour = now.getHours(); } catch { hour = 12; }
  if (hour < 12) return { key: 'home.header.morning',   fallback: 'Good morning' };
  if (hour < 17) return { key: 'home.header.afternoon', fallback: 'Good afternoon' };
  return { key: 'home.header.evening', fallback: 'Good evening' };
}

/**
 * @param {object} props
 * @param {string} [props.name]       farmer's display name
 * @param {string} [props.subtitle]   optional contextual line
 * @param {object} [props.style]
 */
export default function HomeHeader({ name = '', subtitle = '', style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('uiPolish');

  const greeting = useMemo(() => _greetingKey(), []);

  if (!flagOn) return null;

  const trimmedName = String(name || '').trim();
  const firstName = trimmedName ? trimmedName.split(/\s+/)[0] : '';
  const headline = firstName
    ? `${tStrict(greeting.key, greeting.fallback)}, ${firstName}`
    : tStrict(greeting.key, greeting.fallback);

  const sub = subtitle && String(subtitle).trim()
    ? subtitle
    : tStrict('home.header.subtitle', 'Your daily plan is ready below.');

  return (
    <header
      style={{ ...S.card, ...(style || null) }}
      data-testid="home-header"
    >
      <div style={S.textCol}>
        <h1 style={S.greeting}>{headline}</h1>
        <p style={S.subtitle}>{sub}</p>
      </div>
      <div style={S.rightCol}>
        <StreakChip />
      </div>
    </header>
  );
}
