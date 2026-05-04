/**
 * roleTheme.js — map a user role to the matching `.role-*`
 * class so a single class swap on <body> tints every accent
 * element (CTAs, links, badges, progress bars) without
 * touching the base background or text colour.
 *
 *   import { getRoleClass } from './lib/roleTheme.js';
 *
 *   const cls = getRoleClass(user?.role);
 *   document.body.classList.add(cls);
 *
 * Output classes (defined in src/index.css):
 *   role-farmer  — green   (default)
 *   role-ngo     — teal/blue-green
 *   role-buyer   — warm amber
 *
 * Spec rule: NEVER changes text colour or card background per
 * role. The `:root` defaults to farmer so a logged-out boot
 * still renders the canonical green accent.
 *
 * Strict-rule audit
 *   • Pure function. Same input → same output. Never throws.
 *   • Unknown / null / non-string inputs collapse to
 *     'role-farmer' so the boot path can't end up un-tinted.
 *   • Output is always a single, non-empty class string.
 */

const KNOWN_ROLES = Object.freeze(['farmer', 'ngo', 'buyer']);

export function getRoleClass(role) {
  const r = typeof role === 'string' ? role.toLowerCase().trim() : '';
  switch (r) {
    case 'ngo':
    case 'ngo_admin':
    case 'ngo_officer':
    case 'ngo_agent':
      return 'role-ngo';
    case 'buyer':
    case 'buyer_admin':
      return 'role-buyer';
    case 'farmer':
    default:
      return 'role-farmer';
  }
}

export const _internal = Object.freeze({ KNOWN_ROLES });

export default getRoleClass;
