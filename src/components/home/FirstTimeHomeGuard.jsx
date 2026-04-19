/**
 * FirstTimeHomeGuard — wraps the Home screen for brand-new
 * users so we never surface advanced tasks (fertilize /
 * irrigate / scout / harvest) before the farmer has even
 * started land prep.
 *
 * Three branches:
 *
 *   1. NO farm yet → render the "Start your farm" CTA card.
 *      Never renders the full Home.
 *   2. Farm just created, no completions → render the seed
 *      task only (priority 1, visibility 'primary'). Everything
 *      queued by generateInitialTasks as 'deferred' is hidden.
 *   3. Farm with at least one completion → pass through to the
 *      regular Home renderer.
 *
 * Renderer is caller-supplied via `renderHome` so this component
 * stays presentation-light and doesn't pull in HomeShellV2
 * directly (keeps the dependency graph linear).
 */

import {
  hasFarmYet, isFirstTimeHome, getFirstTimeHomeMode,
} from '../../utils/fastOnboarding/firstTimeHomeGuard.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

export default function FirstTimeHomeGuard({
  state = null,            // fast-onboarding state OR { farm }
  name = '',
  t = null,
  onStartFarm = null,
  renderHome = null,       // (filteredTasks, mode) ⇒ ReactNode
  className = '',
}) {
  const mode = getFirstTimeHomeMode(state);

  // Branch 1: no farm → CTA to start
  if (mode.shouldShowStartFlow) {
    const welcomeTpl = resolve(t, 'fast_onboarding.home.welcome_name', 'Welcome, {name}');
    const letsStart  = resolve(t, 'fast_onboarding.home.lets_start',   'Let\u2019s start your farm');
    const cta        = resolve(t, 'fast_onboarding.home.start_your_farm', 'Start your farm');
    const helper     = resolve(t, 'fast_onboarding.home.no_farm_helper',
      'Pick a crop and we\u2019ll guide you from day one');

    return (
      <main
        className={`first-time-home first-time-home--no-farm ${className}`.trim()}
        data-branch="no_farm"
        style={wrap}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={h1}>{interpolate(welcomeTpl, { name: name || 'there' })}</h1>
          <p style={sub}>{letsStart}</p>
        </header>

        <article style={cardStyle}>
          <div style={cardLabel}>🌱 {resolve(t, 'fast_onboarding.home.today_task', 'TODAY\u2019S TASK')}</div>
          <h2 style={cardTitle}>{cta}</h2>
          <p style={cardWhy}>{helper}</p>
          <button
            type="button"
            onClick={onStartFarm}
            style={ctaBtn}
          >
            {cta}
          </button>
        </article>
      </main>
    );
  }

  // Branch 2: first-time Home — filter to the seeded primary task
  if (mode.isFirstTime) {
    // renderHome is expected to handle the case of a single task.
    // If the caller didn't pass one, fall back to a minimal
    // inline render so we never leave the screen blank.
    if (typeof renderHome === 'function') {
      return renderHome(mode.visibleTasks, mode);
    }
    const task = mode.visibleTasks[0];
    const markDone = resolve(t, 'fast_onboarding.home.mark_done', 'Mark as done');
    return (
      <main
        className={`first-time-home first-time-home--first-task ${className}`.trim()}
        data-branch="first_task"
        data-hidden-count={mode.hiddenTaskCount}
        style={wrap}
      >
        <article style={cardStyle}>
          <div style={cardLabel}>🎯 {resolve(t, 'fast_onboarding.home.today_task', 'TODAY\u2019S TASK')}</div>
          <h2 style={cardTitle}>{task?.title || task?.titleFallback || '—'}</h2>
          <p style={cardWhy}>
            <strong style={{ marginRight: 4 }}>Why:</strong>
            {task?.why || task?.whyFallback || ''}
          </p>
          <button type="button" style={ctaBtn}>{markDone}</button>
        </article>
      </main>
    );
  }

  // Branch 3: normal Home
  if (typeof renderHome === 'function') {
    return renderHome(state?.farm?.tasks || [], mode);
  }
  return null;
}

// Re-export the helpers so consumers have one import point.
export { hasFarmYet, isFirstTimeHome, getFirstTimeHomeMode };

const wrap = {
  maxWidth: 520, margin: '0 auto', minHeight: '100vh',
  padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 18,
};
const h1  = { margin: 0, fontSize: 22, fontWeight: 700, color: '#1b1b1b', lineHeight: 1.25 };
const sub = { margin: 0, color: '#546e7a', fontSize: 14, lineHeight: 1.4 };
const cardStyle = {
  padding: '18px 16px 16px', borderRadius: 14,
  border: '1px solid #c8e6c9', background: '#fff',
  display: 'flex', flexDirection: 'column', gap: 10,
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};
const cardLabel = {
  fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
  textTransform: 'uppercase', color: '#2e7d32',
};
const cardTitle = {
  margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: '#1b1b1b',
};
const cardWhy = {
  margin: 0, fontSize: 14, color: '#546e7a', lineHeight: 1.4,
};
const ctaBtn = {
  marginTop: 6, padding: '12px 16px', borderRadius: 10,
  border: 0, background: '#1b5e20', color: '#fff',
  fontSize: 16, fontWeight: 700, cursor: 'pointer',
};
