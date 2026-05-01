/**
 * MinimalFarmSetup — 2-field farm setup at `/start/farm`.
 *
 *   <Route path="/start/farm" element={<MinimalFarmSetup />} />
 *
 * Spec coverage (Onboarding optimisation §2, §3, §5)
 *   §2 reduce form: only crop + location
 *   §3 delay extra fields (farm size + crop stage are NOT asked
 *      here — they get prompted later via ProfileCompletionPrompt
 *      on the Home tab)
 *   §5 step-completed feedback after each tap
 *
 * On submit
 *   • Save through the canonical `farrowaySaveFarm` so the
 *     existing daily-task engine + listing pipeline see the
 *     farm immediately.
 *   • Stamp `farroway_onboarding_completed` so the entry screen
 *     never re-prompts.
 *   • Navigate to `/home` so the user lands on the daily plan
 *     with their fresh farm — that's the immediate value (§4).
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-suppresses behind `onboardingV2` flag (matches /start
 *     pattern).
 *   • Reuses the existing plant-card grid + canonical
 *     `farrowaySaveFarm` helper. No new storage shape introduced.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import {
  saveFarm as farrowaySaveFarm,
  setActiveFarmId as farrowaySetActiveFarmId,
} from '../store/farrowayLocal.js';
import { trackFirstAction } from '../analytics/funnelEvents.js';

const PLANT_OPTIONS = [
  { id: 'tomato',   icon: '\uD83C\uDF45', labelKey: 'backyard.plant.tomato',   fallback: 'Tomatoes' },
  { id: 'pepper',   icon: '\uD83C\uDF36', labelKey: 'backyard.plant.pepper',   fallback: 'Peppers' },
  { id: 'maize',    icon: '\uD83C\uDF3D', labelKey: 'onb.plant.maize',         fallback: 'Maize' },
  { id: 'cassava',  icon: '\uD83C\uDF3F', labelKey: 'onb.plant.cassava',       fallback: 'Cassava' },
  { id: 'rice',     icon: '\uD83C\uDF5A', labelKey: 'onb.plant.rice',          fallback: 'Rice' },
  { id: 'beans',    icon: '\uD83E\uDED8', labelKey: 'onb.plant.beans',         fallback: 'Beans' },
  { id: 'lettuce',  icon: '\uD83E\uDD6C', labelKey: 'backyard.plant.lettuce',  fallback: 'Lettuce' },
  { id: 'herbs',    icon: '\uD83C\uDF3F', labelKey: 'backyard.plant.herbs',    fallback: 'Herbs' },
  { id: 'other',    icon: '\u2795',       labelKey: 'backyard.plant.other',    fallback: 'Other' },
];

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '20px 16px 96px',
    maxWidth: 560,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 6,
    width: '100%',
    background: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: 999,
    transition: 'width 220ms ease-out',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },

  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
  },
  card: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: '14px 10px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  cardActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
  },
  cardIcon: { fontSize: 26 },

  input: {
    appearance: 'none',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(0,0,0,0.20)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  doublePane: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },

  feedback: {
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    padding: '8px 12px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },

  ctaRow: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '14px 18px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: 1,
  },
  primaryDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  ghost: {
    appearance: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// Robust journey §2: persist setup progress across page reloads
// so a user who started typing then refreshed (or lost network)
// resumes where they left off.
const DRAFT_KEY = 'farroway_onb_minimal_draft';

function _readDraft() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _writeDraft(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(value || {}));
  } catch { /* swallow */ }
}

function _clearDraft() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch { /* swallow */ }
}

export default function MinimalFarmSetup() {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('onboardingV2');

  // Restore draft on first mount (lazy initial state).
  const draft = useMemo(() => {
    if (!isFeatureEnabled('journeyResilience')) return null;
    return _readDraft();
  }, []);
  const [plantId, setPlantId]     = useState(draft?.plantId    || '');
  const [plantOther, setPlantOther] = useState(draft?.plantOther || '');
  const [country, setCountry]     = useState(draft?.country    || '');
  const [region, setRegion]       = useState(draft?.region     || '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Auto-save the draft on every change. Cheap localStorage write.
  useEffect(() => {
    if (!isFeatureEnabled('journeyResilience')) return;
    _writeDraft({ plantId, plantOther, country, region });
  }, [plantId, plantOther, country, region]);

  // If a draft was restored, surface a brief feedback line so the
  // user knows their previous input is still here.
  useEffect(() => {
    if (!draft) return;
    if (!draft.plantId && !draft.country) return;
    setFeedback(tStrict('journey.draft.restored',
      '\u2713 Picked up where you left off'));
    setTimeout(() => setFeedback((cur) =>
      cur && cur.includes('Picked up') ? '' : cur), 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantName = useMemo(() => {
    if (plantId === 'other') return plantOther.trim();
    const opt = PLANT_OPTIONS.find((p) => p.id === plantId);
    return opt ? opt.fallback : '';
  }, [plantId, plantOther]);

  const isValid = useMemo(() => {
    return Boolean(plantName) && Boolean(country.trim());
  }, [plantName, country]);

  const totalSteps = 2;
  const stepsDone = (plantId ? 1 : 0) + (country.trim() ? 1 : 0);
  const fillPct = Math.round((stepsDone / totalSteps) * 100);

  const handlePickPlant = useCallback((id) => {
    setPlantId(id);
    try { trackEvent('onb_minimal_plant_picked', { plantId: id }); }
    catch { /* swallow */ }
    setFeedback(tStrict('onb.feedback.cropPicked', '✓ Crop selected'));
    setTimeout(() => setFeedback(''), 2000);
  }, []);

  const handleCountryBlur = useCallback(() => {
    if (!country.trim()) return;
    try { trackEvent('onb_minimal_country_set', {}); }
    catch { /* swallow */ }
    setFeedback(tStrict('onb.feedback.locationSet', '✓ Location saved'));
    setTimeout(() => setFeedback(''), 2000);
  }, [country]);

  const handleSubmit = useCallback(async () => {
    if (submitting || !isValid) return;
    setSubmitting(true);
    try {
      const farm = {
        id: 'farm_' + Date.now().toString(36),
        plantId:    plantId === 'other' ? 'other' : plantId,
        plantName,
        crop:       plantId === 'other'
          ? plantName.toLowerCase()
          : plantId,
        country:    country.trim(),
        region:     region.trim() || '',
        // Spec §3: farm size + crop stage are deliberately NOT
        // collected here. They get prompted later on the Home
        // tab via ProfileCompletionPrompt.
        cropStage:  null,
        unit:       null,
        farmSize:   null,
        onboardingCompleted: true,
        createdAt:  new Date().toISOString(),
        setupPath:  'minimal_v1',
      };
      let stored = null;
      try {
        stored = farrowaySaveFarm(farm);
        if (stored?.id) {
          try { farrowaySetActiveFarmId(stored.id); } catch { /* swallow */ }
        }
      } catch { /* swallow */ }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('farroway_active_farm', JSON.stringify(stored || farm));
          localStorage.setItem('farroway_onboarding_completed', 'true');
        }
      } catch { /* swallow */ }
      try {
        trackEvent('onb_minimal_completed', {
          plantId: farm.plantId,
          country: farm.country,
        });
      } catch { /* swallow */ }
      // Funnel optimisation §10: stamp first-action so
      // time_to_value is computable on the analytics dashboard.
      try {
        trackFirstAction('farm_setup', {
          plantId: farm.plantId,
          country: farm.country,
        });
      } catch { /* swallow */ }
      // Draft is fulfilled — drop the stamp so a later visit
      // doesn't show "picked up where you left off" once the
      // farm is already saved.
      try { _clearDraft(); } catch { /* swallow */ }
      try { navigate('/home', { replace: true }); }
      catch {
        try { navigate('/dashboard', { replace: true }); }
        catch { /* swallow */ }
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, isValid, plantId, plantName, country, region, navigate]);

  if (!flagOn) {
    // Defer to the existing AdaptiveFarmSetup flow when V2 is
    // off so a stray nav doesn't 404. Returning users land on
    // /home anyway via the entry screen guard.
    try { navigate('/farm/new', { replace: true }); }
    catch { /* swallow */ }
    return null;
  }

  return (
    <main style={S.page} data-screen="onb-minimal">
      <div style={S.section}>
        <span style={S.progressLabel}>
          {tStrict('onb.progress', 'Step {done} of {total}')
            .replace('{done}', String(stepsDone))
            .replace('{total}', String(totalSteps))}
        </span>
        <div style={S.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fillPct}>
          <div style={{ ...S.progressFill, width: `${fillPct}%` }} />
        </div>
      </div>

      <div>
        <h1 style={S.title}>
          {tStrict('onb.minimal.title', 'Just two things to start')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('onb.minimal.subtitle',
            'Tell us your crop and where you grow. We\u2019ll show your first daily plan.')}
        </p>
      </div>

      {feedback ? (
        <div style={S.feedback} data-testid="onb-feedback">
          {feedback}
        </div>
      ) : null}

      <div style={S.section}>
        <span style={S.sectionLabel}>
          {tStrict('onb.minimal.cropLabel', 'What are you growing?')}
        </span>
        <div style={S.cardsGrid}>
          {PLANT_OPTIONS.map((opt) => {
            const active = plantId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePickPlant(opt.id)}
                style={{ ...S.card, ...(active ? S.cardActive : null) }}
                data-testid={`onb-plant-${opt.id}`}
              >
                <span style={S.cardIcon} aria-hidden="true">{opt.icon}</span>
                <span>{tStrict(opt.labelKey, opt.fallback)}</span>
              </button>
            );
          })}
        </div>
        {plantId === 'other' ? (
          <input
            type="text"
            value={plantOther}
            onChange={(e) => setPlantOther(e.target?.value || '')}
            placeholder={tStrict('backyard.plant.otherPlaceholder', 'e.g. strawberries')}
            style={{ ...S.input, marginTop: 8 }}
            autoFocus
            data-testid="onb-plant-other-input"
          />
        ) : null}
      </div>

      <div style={S.section}>
        <span style={S.sectionLabel}>
          {tStrict('onb.minimal.locationLabel', 'Where are you?')}
        </span>
        <div style={S.doublePane}>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target?.value || '')}
            onBlur={handleCountryBlur}
            placeholder={tStrict('gardenSetup.location.country', 'Country')}
            style={S.input}
            autoComplete="country-name"
            data-testid="onb-country"
          />
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target?.value || '')}
            placeholder={tStrict('gardenSetup.location.region', 'Region or state (optional)')}
            style={S.input}
            autoComplete="address-level1"
            data-testid="onb-region"
          />
        </div>
      </div>

      <div style={S.ctaRow}>
        <button
          type="button"
          onClick={() => { try { navigate('/start'); } catch { /* swallow */ } }}
          style={S.ghost}
          data-testid="onb-back"
        >
          {tStrict('common.back', 'Back')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{ ...S.primary, ...(!isValid || submitting ? S.primaryDisabled : null) }}
          data-testid="onb-minimal-submit"
        >
          {submitting
            ? tStrict('common.submitting', 'Submitting\u2026')
            : tStrict('onb.minimal.cta', 'See my daily plan')}
        </button>
      </div>
    </main>
  );
}
