/**
 * HelpfulToolsCard — compact glass card that surfaces ≤3
 * contextual tool suggestions inside an existing surface (Soil
 * Scan result / Today's task / Weather card / Harvest prompt).
 *
 *   <HelpfulToolsCard
 *     tools={tools}                // from recommendTools()
 *     mode="garden"
 *     defaultCollapsed             // optional
 *   />
 *
 * Spec contract (May 2026 contextual-tools §3 + §4 + §10)
 *   • Only render INSIDE another surface (callers decide).
 *   • Max 3 tools (engine already enforces).
 *   • Default collapsed when more than 2 items.
 *   • Supportive optional language only ("may make this easier").
 *   • No shopping layout, no product links, no prices.
 *   • "No moisture meter? Check with your finger." — when a
 *     tool ships a `diyAlternative*` pair, render it under the
 *     tool name as a softer secondary line.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. Soft Ochre tokens.
 *   • All visible text via tSafe with English fallbacks.
 *   • Self-suppresses when `tools` is empty / null.
 */

import React, { useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

function _toolIcon() {
  // Single neutral inline glyph reused across rows — no shopping
  // imagery. Stroke-only so the icon reads as functional, not
  // catalog-y.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#7A5A28" strokeWidth="1.6" fill="none"/>
      <path d="M9 12l2 2 4-5" stroke="#7A5A28" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

export default function HelpfulToolsCard({
  tools = null,
  mode = 'farm',
  defaultCollapsed = null,
  testId = 'helpful-tools-card',
}) {
  const list = Array.isArray(tools) ? tools.slice(0, 3) : [];
  // Self-suppress.
  // Nothing to show when the engine returned an empty bucket.
  // The caller never has to guard.
  const initialCollapsed = (typeof defaultCollapsed === 'boolean')
    ? defaultCollapsed
    : list.length > 2;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  if (list.length === 0) return null;

  const isGarden = mode === 'garden';
  const eyebrow = tSafe('tools.helpfulTools', 'Helpful tools');
  const optionalLabel = tSafe('tools.optional', 'optional');
  const introCopy = (() => {
    // Shared reason from the first item (engine emits one
    // reason per call, all items carry the same key).
    const first = list[0];
    if (first && first.reasonFb) {
      return tSafe(first.reasonKey, first.reasonFb);
    }
    return isGarden
      ? tSafe('tools.mayHelpGarden', 'These may make today’s plant care easier.')
      : tSafe('tools.mayHelpFarm',   'These may make today’s task easier.');
  })();

  const visible = collapsed ? list.slice(0, 2) : list;
  const hasOverflow = list.length > 2;

  return (
    <section
      style={S.card}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div style={S.header}>
        <span style={S.eyebrow}>{eyebrow}</span>
        {hasOverflow ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={S.toggle}
            className="ff-tap"
            data-testid="helpful-tools-toggle"
            aria-expanded={!collapsed}
          >
            {collapsed
              ? tSafe('tools.showAll', 'Show all')
              : tSafe('tools.showLess', 'Show less')}
          </button>
        ) : null}
      </div>

      <p style={S.intro}>{introCopy}</p>

      <ul style={S.list}>
        {visible.map((tool) => (
          <li key={tool.id} style={S.item} data-tool-id={tool.id}>
            <span style={S.itemIcon} aria-hidden="true">{_toolIcon()}</span>
            <span style={S.itemText}>
              <span style={S.itemName}>
                {tSafe(tool.nameKey, tool.nameFb)}
                {tool.optional ? (
                  <span style={S.optionalBadge}>{` · ${optionalLabel}`}</span>
                ) : null}
              </span>
              {tool.diyAlternativeFb ? (
                <span style={S.diy}>
                  {tSafe(tool.diyAlternativeKey, tool.diyAlternativeFb)}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.85rem 0.95rem',
    borderRadius: 14,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  eyebrow: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.ochreInk,
  },
  toggle: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: T.ochreInk,
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.4rem',
    borderRadius: 6,
  },
  intro: {
    margin: 0,
    fontSize: '0.82rem',
    fontWeight: 600,
    color: T.ink,
    lineHeight: 1.4,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: '0.2rem 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
  },
  itemIcon: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 8,
    background: '#FFFFFF',
    border: `1px solid ${T.ochreBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  itemName: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: T.ink,
    lineHeight: 1.35,
  },
  optionalBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: T.inkDim,
    letterSpacing: '0.005em',
    textTransform: 'lowercase',
  },
  diy: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: T.inkDim,
    lineHeight: 1.4,
  },
};
