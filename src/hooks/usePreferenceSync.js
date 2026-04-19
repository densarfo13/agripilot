/**
 * usePreferenceSync — keeps the client-side AppSettings (language +
 * region) in sync with the backend farm-profile record.
 *
 * Contract:
 *   - On mount: fetch profile; if the server's language/region
 *     disagree, prefer the manual client value (user just picked it)
 *     — unless the manual slot is empty in which case we hydrate
 *     from the server.
 *   - On change (via setLanguage / setRegion): PATCH the profile
 *     with the new values so next login reads the same thing.
 *   - All writes are fire-and-forget; a network failure never
 *     breaks the UI because the resolver's local storage is the
 *     authoritative live source.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAppSettings } from '../context/AppSettingsContext.jsx';

async function fetchProfile() {
  try {
    const r = await fetch('/api/v2/farm-profile', { credentials: 'include' });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function patchProfile(patch) {
  try {
    const r = await fetch('/api/v2/farm-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * React hook — call once at a high level (e.g. inside
 * FarmerTodayPage or any authenticated shell). Returns a
 * `syncNow()` function for manual pushes.
 */
export function usePreferenceSync() {
  const { language, region, setLanguage, setRegion } = useAppSettings();
  const didPullRef = useRef(false);
  const lastPushedRef = useRef({ language: null, stateCode: null, country: null });

  // ─── Pull on mount ───────────────────────────────────
  useEffect(() => {
    if (didPullRef.current) return;
    didPullRef.current = true;
    (async () => {
      const profile = await fetchProfile();
      if (!profile) return;

      // Hydrate language if the manual slot is empty. The resolver's
      // legacy keys still take priority on subsequent reads, so this
      // is a soft backfill for first-login on a new device.
      try {
        const manualLang = localStorage.getItem('farroway:lang:manual');
        if (!manualLang && profile.language && profile.language !== language) {
          setLanguage(profile.language);
        }
      } catch { /* ignore storage errors */ }

      // Hydrate region similarly — only when no manual slot is set.
      try {
        const manualRegion = localStorage.getItem('farroway:region:manual');
        if (!manualRegion && (profile.country || profile.stateCode)) {
          setRegion({
            country: profile.country || null,
            stateCode: profile.stateCode || profile.state || null,
          });
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Push on change ──────────────────────────────────
  useEffect(() => {
    const next = {
      language: language || null,
      country: region?.country || null,
      stateCode: region?.stateCode || null,
    };
    const prev = lastPushedRef.current;
    if (next.language === prev.language
      && next.country === prev.country
      && next.stateCode === prev.stateCode) {
      return; // nothing changed
    }
    lastPushedRef.current = next;
    // fire-and-forget — no await, no throws
    patchProfile({
      language: next.language,
      country: next.country,
      stateCode: next.stateCode,
    });
  }, [language, region]);

  const syncNow = useCallback(async () => {
    await patchProfile({
      language: language || null,
      country: region?.country || null,
      stateCode: region?.stateCode || null,
    });
  }, [language, region]);

  return { syncNow };
}
