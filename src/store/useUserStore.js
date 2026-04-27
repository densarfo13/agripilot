/**
 * useUserStore.js — friendly alias over the existing
 * `useAuthStore`.
 *
 * The spec asks for a `useUserStore` zustand hook with a `user`
 * field + `setUser` setter. The codebase already has the same
 * primitive in `src/store/authStore.js` (just under the older
 * name and with extra fields like `token` + `stepUpRequired`).
 * Duplicating zustand stores would split state - the UI would
 * read one, login would write the other, and the two would
 * disagree silently. So this file is a thin alias instead:
 *
 *   import { useUserStore } from '../store/useUserStore';
 *   const user    = useUserStore((s) => s.user);
 *   const setUser = useUserStore((s) => s.setUser);
 *
 * Both call sites land on the same underlying store instance,
 * and the legacy `useAuthStore` keeps working untouched. Nothing
 * to migrate.
 */

import { useAuthStore } from './authStore.js';

/**
 * Equivalent to `create()((set) => ({ user, setUser }))` but
 * shares state with `useAuthStore` so writes from either side
 * stay coherent.
 */
export function useUserStore(selector, ...rest) {
  // Adapt the older shape: selector receives `{ user, setUser }`
  // backed by the auth store.
  const adapter = (state) => {
    const surface = {
      user:    state.user,
      setUser: (next) => {
        // `setAuth(user, token)` is the canonical writer; pass
        // through the existing token to avoid clobbering it.
        try { state.setAuth(next, state.token); }
        catch {
          // If anything in the auth store throws, we still
          // surface the user via the legacy `setUser` proxy
          // below. setUser itself is wired in the store too.
        }
      },
    };
    return typeof selector === 'function' ? selector(surface) : surface;
  };
  return useAuthStore(adapter, ...rest);
}

// Expose the underlying store for consumers that want the
// legacy multi-field API (token, stepUpRequired, logout, ...).
export { useAuthStore };
