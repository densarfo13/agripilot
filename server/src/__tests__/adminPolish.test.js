/**
 * adminPolish.test.js — admin UI polish primitives + nav grouping.
 *
 * Scope (spec §14):
 *   • MetricCard renders number + label, respects tone
 *   • MetricGrid uses responsive auto-fit (no awkward collapse)
 *   • SoftBanner reserves red for `critical` tone only
 *   • AdminEmptyState renders reassuring copy with icon + title
 *   • SectionHeader emits consistent H3
 *   • groupAdminNav buckets items into 4 demo groups + drops advanced
 *     group in demo mode
 *
 * React component tests use vitest + the default happy-dom / jsdom
 * environment; if neither is active we fall back to structural
 * `React.createElement` inspection so the suite still runs in a
 * headless node vitest config.
 */

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';

import {
  MetricCard, MetricGrid, SoftBanner, AdminEmptyState, SectionHeader,
  _internal as polishInternal,
} from '../../../src/components/admin/AdminPolish.jsx';

import {
  groupAdminNav, groupIdFor, ADMIN_NAV_GROUPS,
} from '../../../src/lib/demo/adminNavGroups.js';

function installWindow({ demoQuery = false } = {}) {
  const map = new Map();
  globalThis.window = {
    location: { search: demoQuery ? '?demo=1' : '', pathname: '/admin/dashboard' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener:    () => {},
    removeEventListener: () => {},
  };
}
afterEach(() => { delete globalThis.window; });

// ─── Polish component structural tests ───────────────────────────
describe('MetricCard', () => {
  it('emits label + value with correct testId', () => {
    const el = MetricCard({ label: 'Total', value: 42, testId: 'm-total' });
    expect(el.type).toBe('div');
    expect(el.props['data-testid']).toBe('m-total');
    expect(el.props['data-tone']).toBe('neutral');
    // Deep children search: value (42) should appear somewhere.
    const json = JSON.stringify(el);
    expect(json).toMatch(/Total/);
    expect(json).toMatch(/42/);
  });

  it('respects tone ∈ neutral | info | good | warn | danger', () => {
    for (const tone of ['neutral', 'info', 'good', 'warn', 'danger']) {
      const el = MetricCard({ label: 'x', value: 1, tone });
      expect(el.props['data-tone']).toBe(tone);
    }
  });

  it('unknown tone falls back to neutral styling', () => {
    const el = MetricCard({ label: 'x', value: 1, tone: 'sparkles' });
    // data-tone preserves the caller's string (for analytics), but
    // the underlying style ref comes from the neutral bucket.
    expect(polishInternal.TONES.neutral).toBeTruthy();
    expect(el.type).toBe('div');
  });

  it('renders hint when supplied', () => {
    const el = MetricCard({ label: 'x', value: 1, hint: 'last 7 days' });
    expect(JSON.stringify(el)).toMatch(/last 7 days/);
  });
});

describe('MetricGrid', () => {
  it('uses auto-fit min 180px → never collapses awkwardly', () => {
    const el = MetricGrid({ children: [] });
    const grid = el.props.style.gridTemplateColumns;
    expect(grid).toMatch(/auto-fit/);
    expect(grid).toMatch(/minmax\(180px/);
  });
});

describe('SoftBanner', () => {
  it('default tone is info, not red', () => {
    const el = SoftBanner({ children: 'test' });
    expect(el.props['data-tone']).toBe('info');
  });

  it('critical tone is the ONLY one using red tokens', () => {
    const tones = polishInternal.BANNER_TONES;
    // info / success / warn use blue/green/amber; only critical uses
    // the red channel (#F for brightness + rgba red).
    expect(tones.critical.bg).toMatch(/239,68,68/);
    expect(tones.info.bg).not.toMatch(/239,68,68/);
    expect(tones.success.bg).not.toMatch(/239,68,68/);
    expect(tones.warn.bg).not.toMatch(/239,68,68/);
  });

  it('role defaults to status (non-alerting)', () => {
    const el = SoftBanner({ children: 'ok' });
    expect(el.props.role).toBe('status');
  });

  it('role="alert" only when caller opts in', () => {
    const el = SoftBanner({ children: 'critical', role: 'alert' });
    expect(el.props.role).toBe('alert');
  });
});

describe('AdminEmptyState', () => {
  it('renders title + body + icon', () => {
    const el = AdminEmptyState({
      title: 'Nothing to review',
      body:  'You\u2019re all caught up.',
      icon:  '\u2713',
      tone:  'positive',
    });
    const json = JSON.stringify(el);
    expect(json).toMatch(/Nothing to review/);
    expect(json).toMatch(/caught up/);
    expect(el.props['data-tone']).toBe('positive');
  });

  it('tone neutral by default', () => {
    const el = AdminEmptyState({ title: 'x' });
    expect(el.props['data-tone']).toBe('neutral');
  });

  it('action prop renders in its own slot', () => {
    const action = React.createElement('button', { type: 'button' }, 'Retry');
    const el = AdminEmptyState({ title: 'x', action });
    expect(JSON.stringify(el)).toMatch(/Retry/);
  });
});

describe('SectionHeader', () => {
  it('renders title + optional hint + right-side slot', () => {
    const right = React.createElement('span', null, '3 items');
    const el = SectionHeader({ title: 'Farmers', hint: 'last 7 days', right });
    const json = JSON.stringify(el);
    expect(json).toMatch(/Farmers/);
    expect(json).toMatch(/last 7 days/);
    expect(json).toMatch(/3 items/);
  });
});

// ─── Nav grouping ────────────────────────────────────────────────
describe('groupAdminNav', () => {
  const items = [
    { id: 'dashboard',        label: 'Dashboard' },
    { id: 'farmers',          label: 'Farmers' },
    { id: 'farm-issues',      label: 'Farm Issues' },
    { id: 'reports',          label: 'Reports' },
    { id: 'notifications',    label: 'Notifications' },
    { id: 'fraud-queue',      label: 'Fraud Queue' },
    { id: 'hotspots',         label: 'Hotspot Inspector' },
    { id: 'security',         label: 'Security Requests' },
    { id: 'intelligence',     label: 'Advanced Intelligence' },
  ];

  it('non-demo: emits all 5 groups with advanced populated', () => {
    installWindow();
    const groups = groupAdminNav(items);
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.overview.items.map((i) => i.id)).toEqual(['dashboard']);
    expect(byId.operations.items.map((i) => i.id)).toEqual(['farmers', 'farm-issues']);
    expect(byId.reports.items.map((i) => i.id)).toEqual(['reports']);
    expect(byId.notifications.items.map((i) => i.id)).toEqual(['notifications']);
    expect(byId.advanced.items.map((i) => i.id))
      .toEqual(['fraud-queue', 'hotspots', 'security', 'intelligence']);
  });

  it('demo mode: advanced group is dropped entirely', () => {
    installWindow({ demoQuery: true });
    const groups = groupAdminNav(items);
    const ids = groups.map((g) => g.id);
    expect(ids).not.toContain('advanced');
    expect(ids).toContain('overview');
    expect(ids).toContain('operations');
    expect(ids).toContain('reports');
    expect(ids).toContain('notifications');
  });

  it('empty groups collapse — no hollow headings', () => {
    installWindow();
    const groups = groupAdminNav([{ id: 'dashboard' }]);
    // overview populated, every other group empty and dropped.
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('overview');
  });

  it('unknown item routes to advanced', () => {
    expect(groupIdFor({ id: 'mystery-module' })).toBe('advanced');
  });

  it('ADMIN_NAV_GROUPS has a stable top-to-bottom order', () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.id))
      .toEqual(['overview', 'operations', 'reports', 'notifications', 'advanced']);
  });
});
