/**
 * SimplePostHarvest.jsx — Simple Mode post-harvest renderer.
 *
 * Hard-split partner of StandardPostHarvest. When a crop is harvest-ready
 * the user sees a single calm 4-line plan: Harvest soon → Do this → Next
 * → Then, with three big buttons (Mark Harvested / Create Sell Listing /
 * Remind Me). No long storage essay, no analytics.
 *
 * Self-contained; uses SimpleActionCard for the primary action so the
 * §6 / §9 copy-length and action-first contracts are honored uniformly.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import SimpleActionCard from './SimpleActionCard.jsx';

function _appendArtifact(kind, idempotencyKey) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const KEY = 'farroway_simple_artifacts';
    const raw = window.localStorage.getItem(KEY);
    const list = (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })();
    list.push({ kind, idempotencyKey, ts: Date.now() });
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(KEY, JSON.stringify(bounded));
  } catch { /* swallow */ }
}

function SimplePostHarvestInner({ plantName, cropKey }) {
  const navigate = useNavigate();
  const id = `post-harvest:${cropKey || plantName || 'crop'}`;

  // The primary action: pick ripe fruits today. Reason + when + buttons
  // mirror the §7 layout exactly.
  const primary = {
    id,
    surface: 'post_harvest',
    icon: '🍅',
    priority: 'yellow',
    actionKey: 'simple.post.action.pickRipe',
    actionDefault: tSafe('simple.post.action.pickRipe', 'Pick ripe fruits today.'),
    reasonKey: 'simple.post.reason.fresh',
    reasonDefault: tSafe('simple.post.reason.fresh', 'Pick when ripe to stay fresh.'),
    whenKey: 'simple.when.today',
    whenLabel: 'today',
    whenDefault: tSafe('simple.when.today', 'Today'),
    voiceKey: 'simple.post.voice.full',
    voiceDefault: 'Harvest soon. Pick ripe fruits. Sort bad ones. Store in a cool place.',
    buttons: [
      { id: 'mark_harvested', labelKey: 'simple.post.button.markHarvested', labelDefault: 'Mark Harvested', primary: true },
    ],
    source: 'post_harvest',
  };

  const onDone = () => {
    _appendArtifact('SimpleActionCompleted', `${id}:done:${Date.now()}`);
  };
  const onRemind = () => {
    _appendArtifact('SimpleReminderRequested', `${id}:remind:${Date.now()}`);
  };
  const onScan = () => { try { navigate('/scan'); } catch { /* swallow */ } };
  const onListing = () => {
    _appendArtifact('SimpleActionCompleted', `${id}:listing:${Date.now()}`);
    try { navigate('/buyer'); } catch { /* swallow */ }
  };

  return (
    <section style={S.section} data-testid="simple-post-harvest" data-renderer="simple">
      <header style={S.head}>
        <h2 style={S.title}>{tSafe('simple.post.title', 'Harvest soon')}</h2>
        {plantName ? <p style={S.sub}>{plantName}</p> : null}
      </header>

      <SimpleActionCard
        action={primary}
        onDone={onDone}
        onRemindLater={onRemind}
        onScan={onScan}
        testId="simple-post-harvest-primary"
      />

      {/* The §7 three-step plan in plain words, no essay. */}
      <ul style={S.steps}>
        <li style={S.step}><strong>{tSafe('simple.post.step.do', 'Do this')}: </strong>
          {tSafe('simple.post.step.do.body', 'Pick ripe fruits.')}</li>
        <li style={S.step}><strong>{tSafe('simple.post.step.next', 'Next')}: </strong>
          {tSafe('simple.post.step.next.body', 'Sort bad ones.')}</li>
        <li style={S.step}><strong>{tSafe('simple.post.step.then', 'Then')}: </strong>
          {tSafe('simple.post.step.then.body', 'Store in a cool place.')}</li>
      </ul>

      <div style={S.actionsRow}>
        <button type="button" style={S.btnGhost} onClick={onListing} data-testid="simple-post-create-listing">
          {tSafe('simple.post.button.createListing', 'Create Sell Listing')}
        </button>
        <button type="button" style={S.btnGhost} onClick={onRemind} data-testid="simple-post-remind">
          {tSafe('simple.post.button.remindMe', 'Remind Me')}
        </button>
      </div>
    </section>
  );
}

export default class SimplePostHarvest extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return <div data-testid="simple-post-harvest-fallback" />;
    try { return <SimplePostHarvestInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  section: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem',
    background: '#FAF7F0', borderRadius: 18, border: '1px solid rgba(110,139,97,0.20)' },
  head: { marginBottom: 4 },
  title: { margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#2C3A26', letterSpacing: '-0.01em' },
  sub: { margin: '0.25rem 0 0', fontSize: '0.92rem', color: 'rgba(60,72,55,0.72)' },
  steps: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  step: { fontSize: '0.95rem', color: '#2C3A26', lineHeight: 1.4 },
  actionsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  btnGhost: { flex: '1 1 auto', minHeight: 46, padding: '0.75rem 1rem', border: '1px solid #6E8B61',
    background: 'rgba(110,139,97,0.10)', color: '#33503A', borderRadius: 999,
    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
};
