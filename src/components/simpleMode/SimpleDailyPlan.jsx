/**
 * SimpleDailyPlan.jsx — Simple Mode Daily Plan renderer.
 *
 * Hard-split partner of StandardDailyPlan. Renders only:
 *   • max 3 SimpleActionCards (priority-ordered)
 *   • each card carries big icon + short text + one reason + one button
 *
 * No charts, no analytics, no expanded plan detail. Re-uses the
 * existing SimpleModeHomeSection projection so a single source of
 * truth drives both the Simple Home and the Simple Daily Plan.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import SimpleModeHomeSection from './SimpleModeHomeSection.jsx';

function SimpleDailyPlanInner() {
  return (
    <div style={S.page} data-testid="simple-daily-plan" data-renderer="simple">
      <div style={S.shell}>
        <header style={S.head}>
          <h1 style={S.title}>{tSafe('simple.dailyPlan.title', 'Today')}</h1>
          <p style={S.sub}>{tSafe('simple.dailyPlan.sub', 'Three things. Big buttons.')}</p>
        </header>
        <SimpleModeHomeSection />
      </div>
    </div>
  );
}

export default class SimpleDailyPlan extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return <div data-testid="simple-daily-plan-fallback" />;
    try { return <SimpleDailyPlanInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px' },
  shell: { maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
  head: { marginBottom: 6 },
  title: { margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.01em' },
  sub: { margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'rgba(60,72,55,0.72)' },
};
