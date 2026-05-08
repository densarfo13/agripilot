/**
 * UsefulResultCard — FEATURE_SCAN_USEFULNESS result card.
 *
 * Renders a clean, farmer-friendly scan result with three sections:
 *   1. What we noticed   — cautious, non-prescriptive observation text
 *   2. What to check next — 3 actionable bullets per category
 *   3. Suggested task     — one follow-up task with "Add follow-up task" button
 *
 * Safe scan categories (no ML model required):
 *   healthy | yellowing | holes_or_pest_damage |
 *   spots_or_disease_concern | needs_review (unclear photo)
 *
 * Rules
 * ─────
 *   • All hooks called unconditionally (rules-of-hooks safe).
 *   • Never claims "confirmed disease" — uses "may", "could",
 *     "possibly" throughout.
 *   • "Add follow-up task" button persists via scanToTask pipeline.
 *   • Never throws — every section falls back to safe defaults.
 *   • No camera, no network, no blocking render.
 *
 * Props
 *   result         — ScanResult from the engine (category, possibleIssue, scanId)
 *   experience     — 'farm' | 'backyard' | 'generic'
 *   onRetake       — () → void  (navigate back to capture)
 *   onTaskAdded    — () → void  (optional; called after task persisted)
 */

import { useCallback, useState } from 'react';
import { addScanTasks } from '../../core/scanToTask.js';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';

// ─── Per-category guidance ────────────────────────────────────────
// Spec-exact wording. Honest, action-framed, no certainty claims.

const GUIDANCE = Object.freeze({
  healthy: Object.freeze({
    emoji:        '✅',
    label:        'Looks Healthy',
    confidence:   'low',
    noticed:      'Your crop appears healthy. No obvious issues detected.',
    checks: [
      'Continue daily crop monitoring.',
      'Check that water and nutrients are sufficient.',
      'Look for any early stress signs over the next few days.',
    ],
    recommendation: 'Continue your current care routine and check the plant again tomorrow.',
    treatments: [
      'Continue regular monitoring',
      'Maintain consistent watering and feeding',
      'Watch for early stress signs over the next few days',
    ],
    task:         'Continue daily crop check',
  }),

  yellowing: Object.freeze({
    emoji:        '🌿',
    label:        'Possible Yellowing',
    confidence:   'medium',
    noticed:      'We noticed yellowing that may be caused by water stress, nutrient issues, or pests.',
    checks: [
      'Check soil moisture — water if the top inch feels dry.',
      'Inspect lower leaves closely for yellowing pattern.',
      'Look under leaves for pests or sticky residue.',
    ],
    recommendation: 'Adjust watering if soil is dry or waterlogged. Avoid wetting leaves at night.',
    treatments: [
      'Check soil moisture and adjust watering frequency',
      'Review nutrient balance — consider a balanced feed if soil is dry',
      'Avoid overwatering and improve drainage if needed',
    ],
    task:         'Check soil moisture and lower leaves',
  }),

  holes_or_pest_damage: Object.freeze({
    emoji:        '🐛',
    label:        'Possible Pest Damage',
    confidence:   'medium',
    noticed:      'We noticed holes or irregular leaf edges that may indicate pest activity.',
    checks: [
      'Inspect under leaves for insects, eggs, or sticky residue.',
      'Check stems and the soil near the base of the plant.',
      'Look for trails, droppings, or chewed roots.',
    ],
    recommendation: 'Hand-remove visible insects where safe. Consider local agronomy advice if damage spreads.',
    treatments: [
      'Inspect under leaves and along stems',
      'Consider neem oil or insecticidal soap (follow label instructions)',
      'Remove heavily damaged leaves to reduce pest spread',
    ],
    task:         'Inspect under leaves for pests',
  }),

  spots_or_disease_concern: Object.freeze({
    emoji:        '🍂',
    label:        'Possible Leaf Disease Concern',
    confidence:   'medium',
    noticed:      'Small brown or yellow spots on leaves may indicate a fungal or bacterial concern.',
    checks: [
      'Look under leaves and check if spots are spreading.',
      'Avoid watering from above — water at the base instead.',
      'Monitor nearby plants over 2–3 days for any spread.',
    ],
    recommendation: 'Remove heavily affected leaves and avoid wetting leaves when watering.',
    treatments: [
      'Improve airflow — space plants and trim dense foliage',
      'Avoid overhead watering; water at the base instead',
      'Consider approved local fungicide guidance (follow label instructions)',
      'Monitor spread over the next few days',
    ],
    task:         'Monitor affected leaves and avoid overhead watering',
  }),

  // Plantix-style upgrade — two new safe categories.
  wilting: Object.freeze({
    emoji:        '💧',
    label:        'Possible Wilting',
    confidence:   'medium',
    noticed:      'Wilting may be caused by under-watering, root issues, or heat stress.',
    checks: [
      'Feel soil 5 cm below the surface to check moisture.',
      'Inspect roots and stem base for rot or pests.',
      'Note the time of day — heat-wilt usually recovers by evening.',
    ],
    recommendation: 'Water gently if soil is dry. Improve drainage if soil feels waterlogged.',
    treatments: [
      'Check root zone moisture before watering',
      'Improve drainage if soil is saturated',
      'Provide partial shade during the hottest part of the day',
    ],
    task:         'Check soil moisture and the root area',
  }),

  nutrient_stress: Object.freeze({
    emoji:        '🌱',
    label:        'Possible Nutrient Stress',
    confidence:   'medium',
    noticed:      'Pale, off-colour, or stunted growth may suggest nutrient stress.',
    checks: [
      'Check whether older or newer leaves show the colour change first.',
      'Note recent fertiliser or feeding history.',
      'Inspect for waterlogged or compacted soil that limits uptake.',
    ],
    recommendation: 'Add a balanced feed if soil is dry. Avoid over-fertilising.',
    treatments: [
      'Review soil nutrition — consider a balanced feed (follow label instructions)',
      'Observe new leaf growth over the next few days',
      'Avoid over-fertilising — more is rarely better',
    ],
    task:         'Check leaf colour and growth pattern',
  }),

  needs_review: Object.freeze({
    emoji:        '📷',
    label:        'Needs Review',
    confidence:   'low',
    noticed:      'The photo didn\'t give us enough detail to identify a specific issue.',
    checks: [
      'Take the photo outdoors in good natural light.',
      'Get close to the affected leaf or area.',
      'Remove shadows and avoid blurry shots.',
    ],
    recommendation: 'Take another clear photo or inspect manually.',
    treatments: [
      'Take a clearer photo in good natural light',
      'Inspect the plant manually for any visible issues',
    ],
    task:         'Inspect plant manually',
  }),
});

// Fallback for any unknown category.
const _FALLBACK = GUIDANCE.needs_review;

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  // Category chip row
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.80)',
  },
  // Confidence pill — sits beside the category chip. Tone shifts
  // by level so users feel the difference at a glance without
  // alarming language.
  confChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '3px 9px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.13)',
    color: 'rgba(255,255,255,0.72)',
  },
  confDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.55)',
  },
  // Recommended-action section — green-tinted to signal "what to do"
  // distinct from the white observation text and the green-bordered
  // task block. Stays calm: no alarming red.
  recBlock: {
    padding: '10px 13px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.04)',
    border: '1px solid rgba(34,197,94,0.16)',
  },
  recText: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  // Suggested treatment approaches block — calm card with simple
  // bullets. No alarming colours; same surface language as the
  // rest of the card so it never reads like a warning.
  treatBlock: {
    padding: '10px 13px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  treatList: {
    margin: '4px 0 0',
    paddingLeft: 18,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    lineHeight: 1.45,
  },
  // "Get local agronomy advice" escalation button — sits right
  // above the disclaimer so the user always has a path off-app
  // to a human expert.
  escalBtn: {
    appearance: 'none',
    border: '1px solid rgba(245,158,11,0.32)',
    background: 'rgba(245,158,11,0.10)',
    color: '#FCD34D',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  escalToast: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#FCD34D',
    margin: 0,
  },
  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 4,
  },
  // "What we noticed" text
  noticedText: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 1.55,
  },
  // "What to check next" list
  checkList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    lineHeight: 1.45,
  },
  // Suggested task block
  taskBlock: {
    padding: '10px 13px',
    borderRadius: 10,
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.22)',
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  taskText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 1.4,
    flex: '1 1 auto',
    minWidth: 0,
  },
  addBtn: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    borderRadius: 8,
    padding: '7px 13px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  taskToast: {
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flex: '0 0 auto',
  },
  // Bottom buttons row
  buttonsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  disclaimer: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
  },
};

// ─── Component ───────────────────────────────────────────────────

// localStorage key used by the escalation queue. We persist the
// request so it survives reloads and a future NGO/agronomist
// integration can pick up the queue without changing this UI.
const AGRONOMY_REQUEST_KEY = 'farroway_agronomy_requests_v1';

function _saveAgronomyRequest(payload) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(AGRONOMY_REQUEST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    // 50-entry cap, oldest dropped — matches scanHistoryStore convention.
    arr.push({
      ...payload,
      createdAt: new Date().toISOString(),
    });
    const trimmed = arr.length > 50 ? arr.slice(arr.length - 50) : arr;
    localStorage.setItem(AGRONOMY_REQUEST_KEY, JSON.stringify(trimmed));
    return true;
  } catch { /* quota / private mode — non-fatal */ }
  return false;
}

export default function UsefulResultCard({
  result,
  experience = 'generic',
  onRetake,
  onTaskAdded,
}) {
  // All hooks declared unconditionally — rules-of-hooks safe.
  // Subscribe to language change so the card re-renders when the
  // user picks a different locale.
  useStrictTranslation();
  const [taskAdded, setTaskAdded] = useState(false);
  const [escalationSent, setEscalationSent] = useState(false);

  const handleAddTask = useCallback(() => {
    if (taskAdded) return;
    const category = (result && result.category) ? result.category : 'needs_review';
    const guidance  = GUIDANCE[category] || _FALLBACK;
    const scanId    = (result && result.scanId) ? result.scanId : null;
    // Prefer the Plantix-style result.taskTitle when present (the
    // future ML backend will populate it); else use the per-category
    // default from GUIDANCE. Either way the title is short, calm,
    // and actionable.
    const title = (result && typeof result.taskTitle === 'string' && result.taskTitle.trim())
      ? result.taskTitle.trim()
      : guidance.task;
    try {
      addScanTasks(
        [{ title, urgency: 'medium', actionType: 'inspect' }],
        { scanId, experience }
      );
    } catch { /* never crash the card */ }
    // Garden Mode: notify the timeline bridge so a 'scan_saved'
    // milestone is appended. Non-garden surfaces dispatch this too;
    // the bridge gates on grow mode and drops farm-mode events.
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('farroway:scan_added_to_tasks', {
          detail: { category, scanId, taskTitle: title },
        }));
      }
    } catch { /* swallow */ }
    setTaskAdded(true);
    if (typeof onTaskAdded === 'function') {
      try { onTaskAdded(); } catch { /* ignore */ }
    }
  }, [taskAdded, result, experience, onTaskAdded]);

  // Safe category lookup.
  const category = (result && result.category) ? String(result.category) : 'needs_review';
  const guidance  = GUIDANCE[category] || _FALLBACK;

  // Escalation handler — saves the request locally and flips the
  // button to a calm acknowledgement. Future NGO/agronomist
  // integration only needs to read AGRONOMY_REQUEST_KEY; this UI
  // does not change.
  const handleEscalate = useCallback(() => {
    if (escalationSent) return;
    _saveAgronomyRequest({
      scanId:     (result && result.scanId)   || null,
      category:   (result && result.category) || category,
      confidence: (result && result.confidence) || guidance.confidence,
      experience,
    });
    setEscalationSent(true);
  }, [escalationSent, result, category, guidance.confidence, experience]);

  return (
    <article
      style={S.card}
      data-testid="useful-result-card"
      data-category={category}
      data-experience={experience}
    >
      {/* Category chip + confidence pill (Plantix-style header) */}
      <div style={S.chipRow}>
        <span
          style={S.chip}
          data-testid="useful-result-category"
        >
          {guidance.emoji} {guidance.label}
        </span>
        {/* Confidence is read from result.confidence when present (the
            future ML backend will set it), else falls back to the
            per-category default in GUIDANCE. Always rendered so the
            user sees how strong the signal is. */}
        <span
          style={S.confChip}
          data-testid="useful-result-confidence"
          data-confidence={(result && result.confidence) || guidance.confidence}
        >
          <span style={S.confDot} aria-hidden="true" />
          {tSafe('scan.confidence.label', 'Confidence')}: {(() => {
            const lvl = String((result && result.confidence) || guidance.confidence || 'low').toLowerCase();
            const k   = `scan.confidence.${lvl}`;
            const fb  = lvl.replace(/^./, (c) => c.toUpperCase());
            return tSafe(k, fb);
          })()}
        </span>
      </div>

      {/* What we noticed */}
      <div>
        <div style={S.sectionLabel}>
          {tSafe('scan.section.noticed', 'What we noticed')}
        </div>
        <p style={S.noticedText} data-testid="useful-result-noticed">
          {(result && result.noticed) || guidance.noticed}
        </p>
      </div>

      {/* What to check next */}
      <div>
        <div style={S.sectionLabel}>
          {tSafe('scan.section.checkNext', 'What to check next')}
        </div>
        {/* If the result carries a single checkNext string (Plantix-
            style backend shape) render it as a paragraph; else fall
            back to the per-category checks list. */}
        {result && result.checkNext ? (
          <p style={S.noticedText} data-testid="useful-result-checks">
            {result.checkNext}
          </p>
        ) : (
          <ul style={S.checkList} data-testid="useful-result-checks">
            {guidance.checks.map((check, i) => (
              <li key={i}>{check}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Recommended action — separate from the suggested task so
          the user reads "what to do" before being asked to add a
          reminder for tomorrow. */}
      <div style={S.recBlock} data-testid="useful-result-recommendation-block">
        <div style={S.sectionLabel}>
          {tSafe('scan.section.recommendation', 'Recommended action')}
        </div>
        <p style={S.recText} data-testid="useful-result-recommendation">
          {(result && result.recommendation) || guidance.recommendation}
        </p>
      </div>

      {/* Suggested treatment approaches — calm bullet list. Wording
          stays confidence-safe ("consider", "may help", "follow
          label instructions"). No exact dosages, no restricted
          chemicals, no "this will cure" guarantees. */}
      {Array.isArray(guidance.treatments) && guidance.treatments.length > 0 && (
        <div style={S.treatBlock} data-testid="useful-result-treatments">
          <div style={S.sectionLabel}>
            {tSafe('scan.section.treatments', 'Suggested treatment approaches')}
          </div>
          <ul style={S.treatList} data-testid="useful-result-treatments-list">
            {guidance.treatments.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested task */}
      <div style={S.taskBlock} data-testid="useful-result-task-block">
        <div style={S.sectionLabel}>
          {tSafe('scan.section.task', 'Suggested task')}
        </div>
        <div style={S.taskRow}>
          <span style={S.taskText} data-testid="useful-result-task-text">
            {(result && typeof result.taskTitle === 'string' && result.taskTitle.trim())
              ? result.taskTitle.trim()
              : guidance.task}
          </span>
          {taskAdded ? (
            <span style={S.taskToast} data-testid="useful-result-task-toast">
              {tSafe('scan.toast.taskAdded', '✅ Task added')}
            </span>
          ) : (
            <button
              type="button"
              style={S.addBtn}
              data-testid="useful-result-add-task-btn"
              onClick={handleAddTask}
            >
              {/* Mode-aware button language (spec §6) — warmer in
                  garden mode, operational in farm mode. Falls back
                  to the generic key when no experience is supplied. */}
              {experience === 'backyard' || experience === 'garden'
                ? tSafe('scan.button.addCareTask', 'Add care task')
                : (experience === 'farm' || experience === 'farmer'
                    ? tSafe('scan.button.addFieldTask', 'Add field task')
                    : tSafe('scan.button.addTask',     'Add follow-up task'))}
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={S.buttonsRow}>
        {typeof onRetake === 'function' ? (
          <button
            type="button"
            onClick={onRetake}
            style={S.btn}
            data-testid="useful-result-retake"
          >
            {experience === 'backyard' || experience === 'garden'
              ? tSafe('scan.button.retakePlant', '📷 Retake plant photo')
              : (experience === 'farm' || experience === 'farmer'
                  ? tSafe('scan.button.retakeCrop', '📷 Retake crop photo')
                  : tSafe('scan.button.retake',     '📷 Retake photo'))}
          </button>
        ) : null}
      </div>

      {/* Local agronomy escalation — always visible. Saves a request
          locally so a future NGO/agronomist integration can pick it
          up. Switches to a calm acknowledgement after one tap; never
          reloads the page or navigates away. */}
      {escalationSent ? (
        <p
          style={S.escalToast}
          data-testid="useful-result-agronomy-sent"
        >
          {tSafe(
            'scan.toast.agronomySent',
            '✅ Request saved. We\'ll route this to a local agronomy contact when one is available.',
          )}
        </p>
      ) : (
        <button
          type="button"
          onClick={handleEscalate}
          style={S.escalBtn}
          data-testid="useful-result-agronomy-cta"
        >
          {tSafe('scan.button.agronomy', '🌾 Get local agronomy advice')}
        </button>
      )}

      {/* Spec-exact safety disclaimer — always rendered, even on
          'healthy' results, so the user understands the result is
          guidance and never a guaranteed diagnosis. Localized via
          tSafe with the spec-exact English fallback. */}
      <p
        style={S.disclaimer}
        data-testid="useful-result-disclaimer"
      >
        {tSafe(
          'scan.disclaimer.safe',
          'Results are guidance only. Local agronomy advice may help confirm treatment options.',
        )}
      </p>
    </article>
  );
}
