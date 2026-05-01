/**
 * FastBackyardOnboarding — 3-step optimized backyard setup.
 *
 * Spec (Optimize onboarding for completion + speed)
 * ───────────────────────────────────────────────
 *   1. Progress bar — "Step N of 3" + bar fill.
 *   2. Step 1 of 3 = value intro screen
 *        title  : "Know what to do every day"
 *        bullets: simple actions / avoid mistakes / less effort
 *        cta    : "Start my plan"
 *   3. Step 2 of 3 = plant card quick-pick. Tap once → advances.
 *      Auto-fills cropStage / unit / farmType / experience.
 *   4. Step 3 of 3 = Plan Ready screen
 *        - 2–3 tasks, first task highlighted
 *        - Micro success: "Great job! You're on track 🌱"
 *        - CTA → save + navigate('/home')
 *   5. Total time budget for a backyard user: under 10 seconds.
 *      We achieve this by:
 *        • removing every non-essential field on the path,
 *        • making plant pick auto-advance (no Save button),
 *        • inferring country / unit / size / location from
 *          existing profile when present.
 *
 * Position
 *   Coexists with GardenSetupForm.jsx (single-page form for
 *   power-users who want every field). When `fastBackyardOnboarding`
 *   flag is on, AdaptiveFarmSetup picks this 3-step flow for
 *   backyard users; flag-off path is the existing GardenSetupForm
 *   verbatim.
 *
 * Strict-rule audit
 *   • All visible text via tStrict (no English bleed in non-en UIs).
 *   • Inline styles, no Tailwind.
 *   • Relative imports, ESM only.
 *   • No backend calls — saves go through onSaved callback exactly
 *     like GardenSetupForm so AdaptiveFarmSetup's persistence path
 *     stays the single source of truth.
 *   • No edits to existing screens; this is a parallel surface.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

// Plant cards — same set as GardenSetupForm so the picked id stays
// canonical across surfaces.
const PLANT_OPTIONS = [
  { id: 'tomato',   icon: '\uD83C\uDF45', labelKey: 'backyard.plant.tomato',   fallback: 'Tomatoes' },
  { id: 'pepper',   icon: '\uD83C\uDF36', labelKey: 'backyard.plant.pepper',   fallback: 'Peppers' },
  { id: 'herbs',    icon: '\uD83C\uDF3F', labelKey: 'backyard.plant.herbs',    fallback: 'Herbs' },
  { id: 'lettuce',  icon: '\uD83E\uDD6C', labelKey: 'backyard.plant.lettuce',  fallback: 'Lettuce' },
  { id: 'cucumber', icon: '\uD83E\uDD52', labelKey: 'backyard.plant.cucumber', fallback: 'Cucumber' },
  { id: 'corn',     icon: '\uD83C\uDF3D', labelKey: 'backyard.plant.corn',     fallback: 'Corn' },
];

// Generic micro-task templates per plant. Always 3 tasks; first is
// the highlighted "do this now" action. Keep copy short — Plan Ready
// is the last screen before /home and the user should be able to
// scan it in one second.
const TASKS_BY_PLANT = {
  tomato:   ['water',         'checkSun',     'plantSeedlings'],
  pepper:   ['prepareSoil',   'water',        'plantSeedlings'],
  herbs:    ['water',         'checkSun',     'checkLeaves'],
  lettuce:  ['coolSpot',      'water',        'plantSeedlings'],
  cucumber: ['trellis',       'water',        'plantSeedlings'],
  corn:     ['prepareSoil',   'plantSeedlings', 'water'],
};

const TASK_FALLBACKS = {
  water:          'Water once today',
  checkSun:       'Find a sunny spot',
  prepareSoil:    'Prepare soil or container',
  plantSeedlings: 'Plant your seedlings',
  checkLeaves:    'Check leaves for pests',
  trellis:        'Set up a small trellis',
  coolSpot:       'Choose a cool, partly shaded spot',
};

const TOTAL_STEPS = 3;

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 640,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  progressWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
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
  title: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },
  bulletsWrap: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 },
  bulletRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.22)',
  },
  bulletIcon: { fontSize: 18, lineHeight: '24px' },
  bulletText: { fontSize: 15, lineHeight: 1.4, color: '#E5F4EC' },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 10,
  },
  card: {
    appearance: 'none',
    padding: '18px 12px',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 120ms ease-out, border-color 120ms ease-out',
  },
  cardIcon: { fontSize: 32 },
  helper: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginTop: 4 },
  successBanner: {
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.40)',
    color: '#BBF7D0',
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  taskList: { display: 'flex', flexDirection: 'column', gap: 10 },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#E5F4EC',
    fontSize: 14,
    fontWeight: 600,
  },
  taskRowFirst: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(34,197,94,0.10))',
    border: '1px solid #22C55E',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
  },
  taskBadge: {
    flex: '0 0 auto',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  taskBadgeFirst: { background: '#22C55E', color: '#0B1D34' },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '14px 18px',
    borderRadius: 14,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  primaryDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  secondary: {
    appearance: 'none',
    padding: '12px 18px',
    borderRadius: 12,
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function _deriveUnit(country) {
  return String(country || '').toLowerCase() === 'united states' ? 'sq ft' : 'sq m';
}

function _tasksForPlant(plantId) {
  const ids = TASKS_BY_PLANT[plantId] || ['water', 'checkSun', 'prepareSoil'];
  return ids.map((id) => ({
    id,
    label: tStrict(`fastOnboarding.task.${id}`, TASK_FALLBACKS[id] || id),
  }));
}

/**
 * @param {object}   props
 * @param {object}   [props.initialProfile]   read from localStorage profile
 * @param {(saved: object) => void} props.onSaved  called with the new garden
 * @param {() => void} [props.onCancel]
 */
export default function FastBackyardOnboarding({ initialProfile = {}, onSaved, onCancel }) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const [step, setStep] = useState(1);              // 1 | 2 | 3
  const [plantId, setPlantId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const country = useMemo(
    () => initialProfile?.country || 'United States',
    [initialProfile],
  );
  const unit = useMemo(() => _deriveUnit(country), [country]);

  const tasks = useMemo(() => _tasksForPlant(plantId), [plantId]);

  const fillPct = useMemo(
    () => Math.round((step / TOTAL_STEPS) * 100),
    [step],
  );

  const goStep1Cta = useCallback(() => {
    try { trackEvent('fast_onboarding_intro_cta', { step: 1 }); } catch { /* never propagate */ }
    setStep(2);
  }, []);

  // Tap on a plant card immediately advances — no save button —
  // this is the single biggest time saver for the backyard user.
  const onPickPlant = useCallback((id) => {
    setPlantId(id);
    try { trackEvent('fast_onboarding_plant_picked', { plantId: id }); } catch { /* never propagate */ }
    setStep(3);
  }, []);

  const onFinish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const opt = PLANT_OPTIONS.find((p) => p.id === plantId);
      const plantName = opt ? opt.fallback : '';
      const garden = {
        id:                   'garden_' + Date.now().toString(36),
        // Auto-filled fields — backyard user never sees these.
        experience:           'backyard',
        farmType:             'backyard',
        cropStage:            'land_prep',
        unit,
        // Plant + canonical crop pointer.
        plantId,
        plantName,
        crop:                 plantId,
        // Sensible defaults — user can edit later from the garden screen.
        gardenName:           '',
        country,
        region:               initialProfile?.region || '',
        gardenSizeCategory:   'unsure',
        growingLocation:      'soil',
        onboardingCompleted:  true,
        createdAt:            new Date().toISOString(),
        // Surface flag so analytics can attribute completion path.
        setupPath:            'fast_backyard_v1',
      };
      try { trackEvent('fast_onboarding_completed', { plantId, source: 'farm_new' }); }
      catch { /* never propagate */ }
      if (typeof onSaved === 'function') {
        await onSaved(garden);
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, plantId, country, unit, initialProfile, onSaved]);

  // ── Renderers ───────────────────────────────────────────
  const ProgressBar = (
    <div style={STYLES.progressWrap} data-testid="fast-onboarding-progress">
      <span style={STYLES.progressLabel}>
        {tStrict('fastOnboarding.step', 'Step {current} of {total}')
          .replace('{current}', String(step))
          .replace('{total}',   String(TOTAL_STEPS))}
      </span>
      <div style={STYLES.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fillPct}>
        <div style={{ ...STYLES.progressFill, width: `${fillPct}%` }} />
      </div>
    </div>
  );

  if (step === 1) {
    return (
      <main style={STYLES.page} data-screen="fast-onboarding-intro">
        {ProgressBar}
        <div>
          <h1 style={STYLES.title}>
            {tStrict('fastOnboarding.intro.title', 'Know what to do every day')}
          </h1>
          <p style={STYLES.subtitle}>
            {tStrict(
              'fastOnboarding.intro.subtitle',
              'A simple, daily plan for your home garden \u2014 ready in seconds.'
            )}
          </p>
        </div>
        <div style={STYLES.bulletsWrap}>
          <div style={STYLES.bulletRow}>
            <span style={STYLES.bulletIcon} aria-hidden="true">{'\u2705'}</span>
            <span style={STYLES.bulletText}>
              {tStrict('fastOnboarding.intro.bullet1', 'Get simple daily actions')}
            </span>
          </div>
          <div style={STYLES.bulletRow}>
            <span style={STYLES.bulletIcon} aria-hidden="true">{'\uD83D\uDEE1\uFE0F'}</span>
            <span style={STYLES.bulletText}>
              {tStrict('fastOnboarding.intro.bullet2', 'Avoid common mistakes')}
            </span>
          </div>
          <div style={STYLES.bulletRow}>
            <span style={STYLES.bulletIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
            <span style={STYLES.bulletText}>
              {tStrict('fastOnboarding.intro.bullet3', 'Grow better with less effort')}
            </span>
          </div>
        </div>
        <div style={STYLES.navRow}>
          <button type="button" onClick={onCancel} style={STYLES.secondary} data-testid="fast-onboarding-cancel">
            {tStrict('common.back', 'Back')}
          </button>
          <button
            type="button"
            onClick={goStep1Cta}
            style={STYLES.primary}
            data-testid="fast-onboarding-start"
          >
            {tStrict('fastOnboarding.intro.cta', 'Start my plan')}
          </button>
        </div>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main style={STYLES.page} data-screen="fast-onboarding-pick">
        {ProgressBar}
        <div>
          <h1 style={STYLES.title}>
            {tStrict('fastOnboarding.pick.title', 'What are you growing?')}
          </h1>
          <p style={STYLES.subtitle}>
            {tStrict('fastOnboarding.pick.helper', 'Tap one to continue \u2014 you can add more later.')}
          </p>
        </div>
        <div style={STYLES.cardsGrid}>
          {PLANT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPickPlant(opt.id)}
              style={STYLES.card}
              data-testid={`fast-plant-${opt.id}`}
            >
              <span style={STYLES.cardIcon} aria-hidden="true">{opt.icon}</span>
              <span>{tStrict(opt.labelKey, opt.fallback)}</span>
            </button>
          ))}
        </div>
        <div style={STYLES.navRow}>
          <button type="button" onClick={() => setStep(1)} style={STYLES.secondary} data-testid="fast-onboarding-back-1">
            {tStrict('common.back', 'Back')}
          </button>
          <span />
        </div>
      </main>
    );
  }

  // step === 3 → Plan Ready
  return (
    <main style={STYLES.page} data-screen="fast-onboarding-plan">
      {ProgressBar}
      <div style={STYLES.successBanner} data-testid="fast-onboarding-success">
        {tStrict('fastOnboarding.success', 'Great job! You\u2019re on track \uD83C\uDF31')}
      </div>
      <div>
        <h1 style={STYLES.title}>
          {tStrict('fastOnboarding.plan.title', 'Plan ready')}
        </h1>
        <p style={STYLES.subtitle}>
          {tStrict('fastOnboarding.plan.subtitle', 'Here\u2019s what to do first.')}
        </p>
      </div>
      <div style={STYLES.taskList}>
        {tasks.map((task, idx) => {
          const first = idx === 0;
          return (
            <div
              key={task.id}
              style={{ ...STYLES.taskRow, ...(first ? STYLES.taskRowFirst : null) }}
              data-testid={`fast-task-${task.id}`}
              data-first={first ? 'true' : 'false'}
            >
              <span style={{ ...STYLES.taskBadge, ...(first ? STYLES.taskBadgeFirst : null) }}>
                {idx + 1}
              </span>
              <span>{task.label}</span>
            </div>
          );
        })}
      </div>
      <div style={STYLES.navRow}>
        <button type="button" onClick={() => setStep(2)} style={STYLES.secondary} data-testid="fast-onboarding-back-2">
          {tStrict('common.back', 'Back')}
        </button>
        <button
          type="button"
          onClick={onFinish}
          style={{ ...STYLES.primary, ...(submitting ? STYLES.primaryDisabled : null), maxWidth: 240 }}
          disabled={submitting}
          data-testid="fast-onboarding-finish"
        >
          {submitting
            ? tStrict('common.submitting', 'Submitting\u2026')
            : tStrict('fastOnboarding.plan.cta', 'Open my plan')}
        </button>
      </div>
    </main>
  );
}
