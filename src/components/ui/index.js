/**
 * Farroway UI component primitives — barrel export so call
 * sites can import multiple primitives in one line:
 *
 *   import { Button, ActionCard, EmptyState } from '../components/ui';
 *
 * Each primitive is a single-purpose component bound to the
 * Farroway design tokens (src/ui/styleGuide.js). They stack
 * cleanly: an ActionCard takes a Button as its action slot;
 * an EmptyState takes a Button as its CTA; etc.
 *
 * Build Farroway Component System §1 + §2 + §4 — six primitives
 * (Button, ActionCard, StatusCard, ProgressIndicator,
 * EmptyState; ScanButton intentionally NOT exported because the
 * existing PhotoLauncher + first-action-gate scan trigger
 * already cover the "tap to scan" surface — duplicating would
 * fork the floating-button scan entry).
 */

export { default as Button }            from './Button.jsx';
export { default as ActionCard }        from './ActionCard.jsx';
export { default as StatusCard }        from './StatusCard.jsx';
export { default as ProgressIndicator } from './ProgressIndicator.jsx';
