/**
 * AddFarmEmpty — empty state for /my-farm when no farm profile
 * exists yet. Replaces the previous bare `return null` with a
 * single-screen card that explains the value and routes the farmer
 * to /farm/new.
 *
 * Keeps the dark navy + green-action visual contract used across
 * the rest of the hub. Lucide-style icon, no emoji.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { useNavigate } from 'react-router-dom';
import { Sprout, Plus } from '../icons/lucide.jsx';
// Polish spec §6 \u2014 farm empty state surfaces "Add your farm to
// begin tracking" via the centralised contextWords helper so the
// copy stays in sync with the spec without a per-component sweep
// when wording changes.
import { getContextEmptyState } from '../../i18n/contextWords.js';

export default function AddFarmEmpty() {
  useTranslation();
  const navigate = useNavigate();

  return (
    <section style={S.wrap} data-testid="my-farm-empty-state">
      <div style={S.iconRing} aria-hidden="true">
        <Sprout size={48} />
      </div>
      <h1 style={S.title}>
        {tStrict('farm.empty.title', getContextEmptyState('farm'))}
      </h1>
      <p style={S.body}>
        {tStrict('farm.empty.body',
          'Add your crop, location, and farm size to get daily guidance.')}
      </p>
      <button
        type="button"
        style={S.cta}
        data-testid="add-farm-cta"
        onClick={() => { try { navigate('/farm/new'); } catch { /* ignore */ } }}
      >
        <span style={S.ctaIcon} aria-hidden="true"><Plus size={18} /></span>
        <span>{tStrict('farm.empty.cta', 'Add Farm')}</span>
      </button>
      {/* Risk-4 fix: the "Explore sample farm" secondary CTA was
          removed. The original routed to /dashboard, but in
          non-demo-mode that just lands on the same empty state
          and doesn't actually showcase a sample — misleading.
          When a real sample-farm flow ships, restore as a
          secondary button here; the i18n key
          `farm.empty.cta.exploreSample` is already populated
          for all 6 launch languages. */}
    </section>
  );
}

const S = {
  wrap: {
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 24px',
    background: '#0B1D34',
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#fff',
  },
  body: {
    margin: '8px 0 20px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1rem',
    maxWidth: 360,
    lineHeight: 1.4,
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    borderRadius: 14,
    padding: '14px 22px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 52,
  },
  ctaIcon: { display: 'inline-flex' },
};
