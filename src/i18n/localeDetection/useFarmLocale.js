/**
 * useFarmLocale — React hook that runs detection on mount, lets
 * the caller apply a suggestion, and reports back the current
 * decision state.
 *
 *   const {
 *     detection,    // DetectionResult | null while loading
 *     suggestion,   // { lang, alternatives, country, region } | null
 *     status,       // 'idle' | 'detecting' | 'ready' | 'applied' | 'dismissed'
 *     accept,       // () => apply detection.suggestedLang
 *     choose,       // (lang) => apply lang
 *     keepEnglish,  // () => mark dismissed without changing lang
 *     redetect,     // ({ requestGps }) => re-run detection
 *   } = useFarmLocale({ farm });
 *
 * The hook honours an existing user/farm preference: if the
 * farmer has already chosen a language for this farm, status
 * jumps straight to 'applied' and the banner stays hidden.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFarmerLocale } from './detectFarmerLocale.js';
import { applyFarmLanguage } from './applyFarmLanguage.js';
import {
  resolveLanguagePreference,
} from './saveLanguagePreference.js';

const DISMISS_KEY_PREFIX = 'farroway:langSuggestionDismissed:';

function safeLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function wasDismissed(farmId) {
  if (!farmId) return false;
  const ls = safeLocalStorage();
  if (!ls) return false;
  try { return ls.getItem(DISMISS_KEY_PREFIX + farmId) === '1'; }
  catch { return false; }
}

function markDismissed(farmId) {
  if (!farmId) return;
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.setItem(DISMISS_KEY_PREFIX + farmId, '1'); } catch { /* ignore */ }
}

export function useFarmLocale({ farm = null, autoDetect = true } = {}) {
  const farmId = farm?.id || null;
  const mounted = useRef(true);

  // Surface initial state synchronously: if the farmer has a
  // saved preference, no banner — show 'applied' from the off.
  const initialPref = (() => {
    try { return resolveLanguagePreference(farmId); } catch { return null; }
  })();

  const [detection, setDetection] = useState(null);
  const [status, setStatus] = useState(
    initialPref ? 'applied' :
    wasDismissed(farmId) ? 'dismissed' :
    autoDetect ? 'detecting' : 'idle',
  );

  const runDetection = useCallback(async ({ requestGps = false } = {}) => {
    setStatus('detecting');
    try {
      const result = await detectFarmerLocale({ farm, requestGps });
      if (!mounted.current) return null;
      setDetection(result);
      setStatus('ready');
      return result;
    } catch {
      if (!mounted.current) return null;
      setStatus('ready');
      return null;
    }
  }, [farm]);

  useEffect(() => {
    mounted.current = true;
    if (autoDetect && status === 'detecting') {
      runDetection({ requestGps: false });
    }
    return () => { mounted.current = false; };
    // status deliberately not in deps — runDetection toggles it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetect, runDetection]);

  const accept = useCallback(() => {
    if (!detection) return;
    applyFarmLanguage({
      lang: detection.suggestedLang,
      farmId,
      country: detection.country,
      region: detection.region,
      localeSource: detection.localeSource,
    });
    setStatus('applied');
  }, [detection, farmId]);

  const choose = useCallback((lang) => {
    applyFarmLanguage({
      lang,
      farmId,
      country: detection?.country || null,
      region: detection?.region || null,
      // localeSource = manual when the user explicitly picked.
      localeSource: 'manual',
    });
    setStatus('applied');
  }, [detection, farmId]);

  const keepEnglish = useCallback(() => {
    applyFarmLanguage({
      lang: 'en',
      farmId,
      country: detection?.country || null,
      region: detection?.region || null,
      localeSource: 'manual',
    });
    markDismissed(farmId);
    setStatus('dismissed');
  }, [detection, farmId]);

  const suggestion = detection
    ? Object.freeze({
        lang: detection.suggestedLang,
        alternatives: detection.alternatives || [],
        country: detection.country,
        region: detection.region,
        source: detection.localeSource,
      })
    : null;

  return {
    detection,
    suggestion,
    status,
    accept,
    choose,
    keepEnglish,
    redetect: runDetection,
  };
}
