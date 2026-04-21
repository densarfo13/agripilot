/**
 * needsAttentionPanel.test.js — top-of-dashboard actionable panel.
 */

import { describe, it, expect } from 'vitest';

import NeedsAttentionPanel, {
  _internal,
} from '../../../src/components/admin/NeedsAttentionPanel.jsx';

// ─── Tone pill logic ─────────────────────────────────────────────
describe('tonePill', () => {
  it('0 → ok (green)', () => {
    expect(_internal.tonePill(0).fg).toBe(_internal.TONES.ok.fg);
  });
  it('1-4 → info (blue)', () => {
    expect(_internal.tonePill(2).fg).toBe(_internal.TONES.info.fg);
  });
  it('5-9 → warn (amber)', () => {
    expect(_internal.tonePill(6).fg).toBe(_internal.TONES.warn.fg);
  });
  it('10+ → danger (red)', () => {
    expect(_internal.tonePill(12).fg).toBe(_internal.TONES.danger.fg);
  });
  it('NaN / negative → ok', () => {
    expect(_internal.tonePill(NaN).fg).toBe(_internal.TONES.ok.fg);
    expect(_internal.tonePill(-3).fg).toBe(_internal.TONES.ok.fg);
  });
});

// ─── Structural render ───────────────────────────────────────────
// Walks the returned element tree to find the indicator row's
// children without actually rendering via ReactDOM. Each indicator
// is a component-typed child with `props: { label, count, onClick }`.
function findIndicators(panelEl) {
  const section = panelEl;
  const children = Array.isArray(section.props.children) ? section.props.children : [];
  for (const child of children) {
    if (child && child.props && child.props['data-testid'] === 'needs-attention-row') {
      return Array.isArray(child.props.children) ? child.props.children : [];
    }
  }
  return [];
}

function findAllClear(panelEl) {
  const children = Array.isArray(panelEl.props.children) ? panelEl.props.children : [];
  for (const child of children) {
    if (child && child.props && child.props['data-testid'] === 'needs-attention-all-clear') {
      return child;
    }
  }
  return null;
}

describe('NeedsAttentionPanel', () => {
  it('renders the three-indicator row when any count > 0', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 4, incompleteProfiles: 2, missedTasks: 7,
    });
    expect(el.props['data-testid']).toBe('needs-attention-panel');
    expect(el.props['data-pending']).toBe(13);
    const inds = findIndicators(el);
    expect(inds).toHaveLength(3);
    const labels = inds.map((i) => i.props.label);
    expect(labels).toContain('Inactive farmers');
    expect(labels).toContain('Profiles incomplete');
    expect(labels).toContain('Missed tasks');
    const counts = inds.map((i) => i.props.count);
    expect(counts).toEqual([4, 2, 7]);
  });

  it('surfaces the total pending count in the header chip', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 3, incompleteProfiles: 0, missedTasks: 2,
    });
    expect(el.props['data-pending']).toBe(5);
    // Total chip is the 3rd child of the <header> — look for it.
    const json = JSON.stringify(el);
    expect(json).toMatch(/"data-testid":"needs-attention-total"/);
  });

  it('includes the optional highRisk tile when prop is provided', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 1, incompleteProfiles: 0, missedTasks: 0,
      highRisk: 2,
    });
    const inds = findIndicators(el);
    expect(inds).toHaveLength(4);
    expect(inds[3].props.label).toBe('High risk');
    expect(inds[3].props.count).toBe(2);
  });

  it('omits the highRisk tile when the prop is undefined', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 1, incompleteProfiles: 0, missedTasks: 0,
    });
    const inds = findIndicators(el);
    expect(inds).toHaveLength(3);
  });

  it('shows the all-clear card when every count is 0', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 0, incompleteProfiles: 0, missedTasks: 0,
    });
    expect(el.props['data-pending']).toBe(0);
    const clear = findAllClear(el);
    expect(clear).toBeTruthy();
    expect(findIndicators(el)).toHaveLength(0);
  });

  it('onClick handlers propagate to indicators with count > 0', () => {
    let clickedInactive = 0;
    const el = NeedsAttentionPanel({
      inactiveFarmers: 5, incompleteProfiles: 0, missedTasks: 0,
      onOpenInactive:   () => { clickedInactive += 1; },
      onOpenIncomplete: () => { clickedInactive += 1000; },
    });
    const inds = findIndicators(el);
    const inactive = inds.find((i) => i.props.label === 'Inactive farmers');
    const incomplete = inds.find((i) => i.props.label === 'Profiles incomplete');
    // Handler propagated as-is; the <button> clickable gate happens
    // in the Indicator render using (count > 0 && typeof onClick === 'function').
    expect(typeof inactive.props.onClick).toBe('function');
    inactive.props.onClick();
    expect(clickedInactive).toBe(1);
    expect(typeof incomplete.props.onClick).toBe('function');
    expect(incomplete.props.count).toBe(0);
  });

  it('NaN / null counts coerce to 0 and never crash', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: null, incompleteProfiles: NaN, missedTasks: undefined,
    });
    expect(el.props['data-pending']).toBe(0);
    expect(findAllClear(el)).toBeTruthy();
  });

  it('titleLabel + allClearLabel are i18n-friendly overrides', () => {
    const el = NeedsAttentionPanel({
      inactiveFarmers: 0, incompleteProfiles: 0, missedTasks: 0,
      titleLabel:    'À surveiller',
      allClearLabel: 'Tout est clair pour le moment.',
    });
    expect(el.props['aria-label']).toBe('À surveiller');
    const clear = findAllClear(el);
    expect(clear).toBeTruthy();
    // All-clear text is the 2nd child of the div (after the icon span).
    const clearChildren = clear.props.children;
    const clearText = Array.isArray(clearChildren)
      ? clearChildren.find((c) => typeof c === 'string')
      : clearChildren;
    expect(String(clearText)).toMatch(/Tout est clair/);
  });
});
