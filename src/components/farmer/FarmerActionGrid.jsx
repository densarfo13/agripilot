/**
 * FarmerActionGrid — icon-first navigation tile set for low-literacy
 * farmer surfaces. Displays the 10 primary farmer actions as
 * IconActionCard tiles, each with built-in voice playback. Includes
 * the Simple/Standard mode toggle.
 *
 * Target mount points: top of FarmerTodayPage / FarmerOverviewTab.
 *
 * Each card title comes from the `farmerActions.*` translation keys
 * (en/fr/sw/ha/tw/hi populated in src/i18n/translations.js). When a
 * key is missing, IconActionCard shows the caller's fallback only —
 * no English leak inside non-English UI (see strictT.js).
 *
 * Crop names are NEVER rendered raw here; this grid is action-based,
 * not crop-based. Per-farm crop labels live in the cards' downstream
 * pages (MyFarmPage, ProgressPage), which already pass `lang` to
 * getCropLabelSafe (fix landed in commit 9526a91).
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import IconActionCard from '../IconActionCard.jsx';
import LowLiteracyToggle from '../LowLiteracyToggle.jsx';

const ACTIONS = [
  { icon: '🏠', key: 'farmerActions.home',          path: '/farmer/today' },
  { icon: '🌱', key: 'farmerActions.myFarm',        path: '/my-farm' },
  { icon: '✅', key: 'farmerActions.tasks',         path: '/tasks' },
  { icon: '📊', key: 'farmerActions.progress',      path: '/progress' },
  { icon: '🌦', key: 'farmerActions.weather',       path: '/weather' },
  { icon: '📸', key: 'farmerActions.scanCrop',      path: '/scan' },
  { icon: '🌾', key: 'farmerActions.recordHarvest', path: '/farmer/harvest' },
  { icon: '🛒', key: 'farmerActions.readyToSell',   path: '/farmer/listings' },
  { icon: '🔔', key: 'farmerActions.reminders',     path: '/farmer/reminders' },
  { icon: '🆘', key: 'farmerActions.help',          path: '/help' },
];

export default function FarmerActionGrid({ onNavigate }) {
  // Subscribe to language change.
  useTranslation();
  const navigate = (() => {
    try { return useNavigate(); }
    catch { return null; }
  })();

  const go = (path) => {
    if (typeof onNavigate === 'function') {
      try { onNavigate(path); return; } catch { /* fall through */ }
    }
    if (navigate) {
      try { navigate(path); } catch { /* ignore */ }
    }
  };

  return (
    <section
      className="farmer-action-grid"
      aria-label={tStrict('farmerActions.home', 'Farmer actions')}
    >
      <div
        className="farmer-action-grid__header"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        <LowLiteracyToggle />
      </div>
      <div
        className="farmer-action-grid__cards"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {ACTIONS.map((a) => (
          <IconActionCard
            key={a.key}
            icon={a.icon}
            titleKey={a.key}
            onClick={() => go(a.path)}
          />
        ))}
      </div>
    </section>
  );
}
