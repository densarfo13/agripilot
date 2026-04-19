/**
 * DynamicGreeting — lightweight presentational component that
 * renders the greeting object from getDynamicGreeting above the
 * primary task card.
 *
 * Visual rules (per spec):
 *   • never larger than the primary task card
 *   • never competes with the task card for attention
 *   • keeps to the existing visual style (minimal padding, the
 *     same text treatment the app already uses elsewhere)
 *
 * Usage:
 *   <DynamicGreeting
 *     input={{
 *       todayState: 'active',
 *       hasCompletedOnboarding: true,
 *       hasActiveCropCycle: true,
 *       cropLabel: getCropDisplayName('tomato', language),
 *     }}
 *     t={t}
 *   />
 */

import { useMemo } from 'react';
import { getDynamicGreeting } from '../../utils/getDynamicGreeting.js';

export default function DynamicGreeting({
  input = {},
  t = null,
  className = '',
  titleTag: TitleTag = 'h2',
  subtitleTag: SubtitleTag = 'p',
  style: styleOverride = null,
  onStateResolved = null,
} = {}) {
  const greeting = useMemo(
    () => getDynamicGreeting(input, t),
    [input, t],
  );

  // Side-effect-style callback so parents can log analytics on
  // each resolved state without re-computing the greeting.
  if (typeof onStateResolved === 'function') {
    onStateResolved(greeting);
  }

  const style = styleOverride || {
    margin: '0 0 12px',
    padding: '8px 12px',
    borderRadius: 8,
    // Transparent background by default so it sits lightly above
    // the main card rather than as a second card.
    background: 'transparent',
    minHeight: 32,
  };

  return (
    <section
      className={`dynamic-greeting dynamic-greeting--${greeting.state} ${className}`.trim()}
      data-greeting-state={greeting.state}
      data-time-of-day={greeting.timeOfDay}
      style={style}
    >
      <TitleTag
        className="dynamic-greeting__title"
        style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}
      >
        {greeting.title}
      </TitleTag>
      {greeting.subtitle && (
        <SubtitleTag
          className="dynamic-greeting__subtitle"
          style={{ margin: '2px 0 0', fontSize: 14, color: '#555', lineHeight: 1.35 }}
        >
          {greeting.subtitle}
        </SubtitleTag>
      )}
    </section>
  );
}
