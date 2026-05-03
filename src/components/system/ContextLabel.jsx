/**
 * ContextLabel — visual label for the active growing context.
 *
 *   <ContextLabel context="garden" name="Tomato" />
 *     \u2192 renders "\uD83C\uDF31 Tomato Garden"
 *
 *   <ContextLabel /> (no props)
 *     \u2192 reads useExperience() and renders the active entity's
 *       label, e.g. "\uD83D\uDE9C Maize Farm".
 *
 * Spec contract (Polish Farm vs Garden Experience §1)
 *   • Garden \u2192 \uD83C\uDF31 {Plant Name} Garden
 *   • Farm   \u2192 \uD83D\uDE9C {Crop Name} Farm
 *
 * Used by:
 *   • HomeContextSwitcher trigger (replaces the plain entity name)
 *   • ManageGardens / ManageFarms page titles
 *   • Any future "Working on:" header that wants the canonical
 *     visual treatment
 *
 * Strict-rule audit
 *   • Inline styles only (no className needed; the wrapper is a
 *     plain span the parent can re-style via children).
 *   • Pure render. Never throws.
 *   • Reads context from useExperience when no `context` prop is
 *     passed; falls back to 'farm' on hook failure.
 *   • Returns the icon as decorative (aria-hidden) so screen
 *     readers announce only the label text \u2014 the icon adds
 *     visual texture, not information.
 */

import { tSafe } from '../../i18n/tSafe.js';
import {
  getContextLabel, getContextIcon,
} from '../../i18n/contextWords.js';
import useExperience from '../../hooks/useExperience.js';

function _entityName(row) {
  if (!row || typeof row !== 'object') return '';
  // Prefer the plant/crop label; fall back to the entity name;
  // bottom out on the lowercased crop code with underscores
  // collapsed so 'butter_beans' renders as 'Butter Beans'.
  return row.cropLabel
      || row.crop
      || row.plantName
      || (Array.isArray(row.plants) && row.plants[0])
      || row.name
      || row.farmName
      || '';
}

export default function ContextLabel({
  context = null,
  name    = null,
  size    = 'md',                 // 'sm' | 'md' | 'lg'
  showIcon = true,
  testid  = 'context-label',
}) {
  // Resolve context + name from the explicit props OR
  // useExperience snapshot.
  let ctx  = context;
  let safeName = name;
  if (!ctx || !safeName) {
    try {
      const exp = useExperience();
      if (!ctx && exp && (exp.activeContextType === 'garden'
                       || exp.activeContextType === 'farm')) {
        ctx = exp.activeContextType;
      }
      if (!safeName && exp && exp.activeEntity) {
        safeName = _entityName(exp.activeEntity);
      }
    } catch { /* outside hook scope \u2014 fall back to defaults */ }
  }
  if (!ctx) ctx = 'farm';

  const label = getContextLabel({ type: ctx, name: safeName || '' });
  const icon  = getContextIcon(ctx, 'primary');
  // Strip the leading "icon space" off the label string so we can
  // render the icon as an aria-hidden span and let the text-only
  // portion through to assistive tech.
  const textOnly = label.startsWith(icon + ' ')
    ? label.slice(icon.length + 1)
    : label;

  // Size variants \u2014 numbers tuned to the existing chrome scale.
  const fontSize  = size === 'lg' ? '1.15rem' : size === 'sm' ? '0.85rem' : '0.95rem';
  const iconSize  = size === 'lg' ? '1.25rem' : size === 'sm' ? '0.95rem' : '1.05rem';
  const iconGap   = size === 'lg' ? 8 : 6;

  // Aria label uses tSafe so screen readers receive the localised
  // "Working on:" prefix when the i18n entry exists; falls back to
  // English otherwise.
  const ariaPrefix = tSafe('contextLabel.workingOnAria', 'Active context:');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: iconGap,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.2,
      }}
      data-testid={testid}
      data-context={ctx}
      aria-label={`${ariaPrefix} ${textOnly}`}
    >
      {showIcon ? (
        <span aria-hidden="true" style={{ fontSize: iconSize, lineHeight: 1 }}>
          {icon}
        </span>
      ) : null}
      <span>{textOnly}</span>
    </span>
  );
}
