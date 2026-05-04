/**
 * RoleThemeApplicator — reads the current user role and
 * applies the matching `role-*` class to <body> so every
 * accent element (CTAs, links, badges, progress bars) tints
 * with one class swap.
 *
 *   <RoleThemeApplicator />   // mounted ONCE in App.jsx
 *
 * Pure observer — renders nothing. Side-effect-only via
 * useEffect.
 *
 * Resolution chain
 *   1. useAuthOrNull() — non-throwing variant, returns null
 *      outside AuthProvider scope.
 *   2. role string from user.role (or 'farmer' fallback).
 *   3. roleTheme.getRoleClass(role) → 'role-farmer' /
 *      'role-ngo' / 'role-buyer'.
 *   4. Toggle the class on document.body. Strips any prior
 *      role-* class first so HMR can't double-stack them.
 *
 * Strict-rule audit
 *   • Never throws. useAuthOrNull won't throw outside its
 *     provider; getRoleClass is pure + total.
 *   • Coexists with AppShellTheme — that one toggles
 *     theme-* classes, this one toggles role-* classes.
 *     Different prefixes, no conflict.
 */

import { useEffect } from 'react';
import { useAuthOrNull } from '../../context/AuthContext.jsx';
import { getRoleClass } from '../../lib/roleTheme.js';

const ALL_ROLE_CLASSES = Object.freeze([
  'role-farmer', 'role-ngo', 'role-buyer',
]);

export default function RoleThemeApplicator() {
  const auth = useAuthOrNull();
  const role = (auth && auth.user && auth.user.role) || null;

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined;
    let cls = 'role-farmer';
    try { cls = getRoleClass(role); } catch { cls = 'role-farmer'; }
    try {
      for (const c of ALL_ROLE_CLASSES) {
        document.body.classList.remove(c);
      }
      document.body.classList.add(cls);
    } catch { /* never throw from a side-effect */ }
    return () => { /* persist across navigations */ };
  }, [role]);

  return null;
}

export const _internal = Object.freeze({ ALL_ROLE_CLASSES });
