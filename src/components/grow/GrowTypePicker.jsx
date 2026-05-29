/**
 * GrowTypePicker.jsx — Phase 2 onboarding picker.
 *
 *   <GrowTypePicker selected={growType} onSelect={setGrowType} />
 *
 * What this is
 * ────────────
 *   Standalone "What are you growing?" picker. Renders the 7
 *   spec'd cards (crop, vegetable, fruit, flower, herb,
 *   houseplant, garden) using the Phase 1 GROW_TYPES registry.
 *
 *   The existing OnboardingFlow is unchanged. Callers integrate
 *   this picker explicitly — preserving the "no breaking
 *   changes" rule.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Caller-driven state — no direct profile writes.
 */

import React from 'react';
import {
  GROW_TYPES, GROW_TYPE_ICONS,
  GROW_TYPE_LABEL_KEY, GROW_TYPE_LABEL_DEFAULT,
} from '../../types/growTypes';
import { tSafe } from '../../i18n/tSafe.js';

const _isFn = (v) => typeof v === 'function';

const STYLES = {
  wrap: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    margin: '12px 0',
  },
  title: {
    fontSize: 18, fontWeight: 800, color: '#1F2933',
    margin: '0 0 14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  card: (selected) => ({
    appearance: 'none',
    border: selected ? '2px solid #16A34A'
                     : '1px solid rgba(31,41,51,0.10)',
    background: selected ? 'rgba(22,163,74,0.06)' : '#FFFFFF',
    borderRadius: 14,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    color: '#1F2933',
    fontFamily: 'inherit',
    boxShadow: selected ? '0 1px 4px rgba(22,163,74,0.18)'
                        : '0 1px 2px rgba(31,41,51,0.04)',
    transition: 'background 120ms ease, border-color 120ms ease',
  }),
  icon: {
    fontSize: 32, lineHeight: 1, marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: 700 },
};

export default function GrowTypePicker({ selected, onSelect, title }) {
  return (
    <section style={STYLES.wrap}
      data-testid="grow-type-picker"
      role="region"
      aria-label={tSafe('grow.picker.aria',
        'What are you growing?')}
    >
      <h2 style={STYLES.title} data-testid="grow-type-picker-title">
        {title ||
          tSafe('grow.picker.title', 'What are you growing?')}
      </h2>
      <div style={STYLES.grid}>
        {GROW_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            style={STYLES.card(selected === t)}
            onClick={_isFn(onSelect) ? () => onSelect(t) : undefined}
            disabled={!_isFn(onSelect)}
            data-testid={`grow-type-card-${t}`}
            aria-pressed={selected === t}
          >
            <div style={STYLES.icon} aria-hidden="true">
              {GROW_TYPE_ICONS[t]}
            </div>
            <div style={STYLES.label}>
              {tSafe(GROW_TYPE_LABEL_KEY[t], GROW_TYPE_LABEL_DEFAULT[t])}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
