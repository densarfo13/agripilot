/**
 * Farroway · Farm Assistant Engine (farm-assistant-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real on-device data and
 * real probes via the `_probe()` / `_ls()` helpers below, and never fabricates
 * actions, risks, or history.
 *
 * It is built to be low-literacy friendly and localized: short, simple
 * sentences, localized to the selected language where possible, and an honest
 * "Not enough data yet" fallback when real inputs are missing. It is gentle by
 * design — it never uses alarming words — and it never gives chemical or dosage
 * treatment guidance. Voice follows the selected language, and when a native
 * voice is unavailable the fallback is disclosed rather than hidden.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// Friendly greeting per common language code. GREETING ONLY — these are
// everyday greetings, NOT agronomy terms. Everything else falls back to clear
// English. We never invent agricultural or treatment words in other languages.
const GREETINGS: Record<string, string> = {
  en: 'Hello',
  fr: 'Bonjour',
  sw: 'Habari',
  tw: 'Akwaaba',
  ha: 'Sannu',
  hi: 'Namaste',
};

function _greetingFor(lang: string): string {
  return _safe(() => {
    const code = String(lang || 'en').toLowerCase().slice(0, 2);
    // tw (Twi) and ha (Hausa) are 2-letter already; map by full code first.
    const full = String(lang || 'en').toLowerCase();
    if (GREETINGS[full]) return GREETINGS[full];
    if (GREETINGS[code]) return GREETINGS[code];
    return GREETINGS.en;
  }, GREETINGS.en);
}

// Reads the selected language from the real language probe first, then from
// on-device storage, then defaults to English. Returns a short code string.
function _selectedLanguage(): string {
  return _safe(() => {
    const lh = _obj(_probe('__languageHealth'));
    if (lh) {
      const sel =
        lh.selectedLanguage ?? lh.currentLanguage ?? lh.activeLanguage ?? null;
      if (sel != null && String(sel).trim()) return String(sel).trim();
    }
    const fromLs =
      _ls('farroway_language') ??
      _ls('farroway_selected_language') ??
      _ls('language') ??
      null;
    if (fromLs != null) {
      const s =
        typeof fromLs === 'string'
          ? fromLs
          : _obj(fromLs)
          ? (fromLs as any).language ?? (fromLs as any).lang ?? null
          : null;
      if (s != null && String(s).trim()) return String(s).trim();
    }
    return 'en';
  }, 'en');
}

// Maps a coarse risk category word to a gentle, non-scary one-line summary.
// Never uses alarming words. Unknown / missing stays honest.
function _gentleRiskWord(raw: any): 'calm' | 'watch' | 'attention' | 'unknown' {
  return _safe(() => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return 'unknown';
    if (s === 'high' || s === 'severe' || s === 'critical') return 'attention';
    if (s === 'elevated' || s === 'moderate' || s === 'medium') return 'watch';
    if (s === 'low' || s === 'none' || s === 'ok' || s === 'normal') return 'calm';
    return 'unknown';
  }, 'unknown');
}

export interface FarmAssistantEnvelope {
  runtimeVersion: 'farm-assistant-v1';
  initialized: true;
  value: {
    greeting: string;
    topPriority: string;
    top3Actions: string[];
    riskSummary: string;
    followUpNeeded: boolean;
    voiceReady: boolean;
    language: string;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export const FARM_ASSISTANT_ENGINE_VERSION = 'farm-assistant-v1';

export function farmAssistantHealth(): FarmAssistantEnvelope {
  return _safe(
    () => {
      const language = _selectedLanguage();
      const greeting = _greetingFor(language);

      const limitations =
        'This helper only uses what is saved on this device so far. It does not ' +
        'include other devices or anything you have not yet scanned or logged. It ' +
        'gives general guidance and never names chemicals, doses, or treatments — ' +
        'always follow the recommended care steps. ' +
        GUIDANCE_TAIL;

      // --- real probes (any may be null) ---
      const daily = _obj(_probe('__dailyDecisionHealth'));
      const predictive = _obj(_probe('__predictiveHealth'));
      const weatherRisk = _obj(_probe('__weatherRiskHealth'));
      const trend = _obj(_probe('__trendHealth'));
      const voice = _obj(_probe('__voiceLanguageHealth'));

      // --- actions: pull grounded, already-capped actions from the daily
      //     decision probe. HARD-CAP at 3 regardless of what it returns. ---
      const rawActions = _arr(daily ? (daily as any).actions : null);
      const top3Actions: string[] = _safe(() => {
        return rawActions
          .map((a: any) => {
            if (a == null) return null;
            if (typeof a === 'string') return a.trim() ? a.trim() : null;
            const t = _obj(a) ? (a as any).text ?? (a as any).action ?? (a as any).title ?? null : null;
            return t != null && String(t).trim() ? String(t).trim() : null;
          })
          .filter((s): s is string => !!s)
          .slice(0, 3);
      }, [] as string[]);

      const hasActions = top3Actions.length > 0;
      const topPriority = hasActions ? top3Actions[0] : 'Not enough data yet';

      // --- risk summary: gentle, non-scary. Prefer the predictive probe, then
      //     the weather-risk probe. Honest "Not enough data yet" otherwise. ---
      const predictiveWords = _safe(() => {
        const v = _obj(predictive ? (predictive as any).value : null);
        if (!v) return [] as string[];
        return [v.diseaseRisk, v.pestRisk, v.weatherRisk, v.cropStressRisk]
          .map((r: any) => _gentleRiskWord(r))
          .filter((w) => w !== 'unknown');
      }, [] as string[]);

      const weatherWord = _safe(() => {
        if (!weatherRisk) return 'unknown' as const;
        const lvl =
          (weatherRisk as any).level ??
          (weatherRisk as any).riskLevel ??
          (weatherRisk as any).value ??
          (weatherRisk as any).overall ??
          null;
        return _gentleRiskWord(lvl);
      }, 'unknown' as 'calm' | 'watch' | 'attention' | 'unknown');

      const anyPredictive = predictiveWords.length > 0;
      const anyWeather = weatherWord !== 'unknown';

      // Highest gentle level seen, in order: attention > watch > calm.
      const allWords = anyPredictive
        ? predictiveWords.slice()
        : anyWeather
        ? [weatherWord]
        : [];
      const elevated = allWords.indexOf('attention') >= 0;
      const watching = elevated || allWords.indexOf('watch') >= 0;

      let riskSummary = 'Not enough data yet';
      if (allWords.length > 0) {
        if (elevated) {
          riskSummary = 'Some things may need attention soon. Please check your plants today.';
        } else if (watching) {
          riskSummary = 'A few things are worth watching. Keep an eye on your plants.';
        } else {
          riskSummary = 'Things look calm right now. Keep up your normal care.';
        }
      }

      // --- follow-up: true if a worsening trend OR an elevated/high risk. ---
      const trendWorsening = _safe(() => {
        const tv = trend ? (trend as any).value ?? (trend as any).trend : null;
        return String(tv ?? '').trim().toLowerCase() === 'worsening';
      }, false);
      const followUpNeeded = !!(trendWorsening || elevated);

      // --- voice: true only if a native voice exists for the selected
      //     language. When not, disclose the fallback honestly. ---
      const voiceReady = _safe(() => {
        if (!voice) return false;
        return (voice as any).voiceAvailableForLocale === true;
      }, false);
      const voiceNote = voiceReady
        ? 'Voice is ready in the selected language.'
        : 'A native voice for the selected language is not available yet, so spoken help would use clear English instead.';

      // --- honest data sources (only what we actually saw) ---
      const dataSources: string[] = [];
      if (hasActions) dataSources.push('__dailyDecisionHealth');
      if (anyPredictive) dataSources.push('__predictiveHealth');
      if (!anyPredictive && anyWeather) dataSources.push('__weatherRiskHealth');
      if (trend) dataSources.push('__trendHealth');
      if (voice) dataSources.push('__voiceLanguageHealth');
      if (_probe('__languageHealth')) dataSources.push('__languageHealth');

      // --- confidence scales with how many real inputs we have ---
      const signals =
        (hasActions ? 1 : 0) +
        (anyPredictive || anyWeather ? 1 : 0) +
        (trend ? 1 : 0);
      let confidence: Confidence = 'low';
      if (signals >= 3) confidence = 'high';
      else if (signals >= 2) confidence = 'medium';

      // --- explanation (honest, gentle, plain) ---
      const explanation = _safe(() => {
        const bits: string[] = [];
        if (hasActions) {
          bits.push(
            'These ' +
              top3Actions.length +
              ' action(s) come from the saved daily plan on this device.',
          );
        } else {
          bits.push('No grounded daily actions are saved yet.');
        }
        if (allWords.length > 0) {
          bits.push('The risk note is a gentle summary of saved risk signals.');
        } else {
          bits.push('No risk signals are saved yet.');
        }
        bits.push('Selected language: ' + language + '.');
        bits.push(voiceNote);
        return bits.join(' ');
      }, 'Selected language: ' + language + '. ' + voiceNote);

      const value = {
        greeting,
        topPriority,
        top3Actions,
        riskSummary,
        followUpNeeded,
        voiceReady,
        language,
      };

      return Object.freeze({
        runtimeVersion: 'farm-assistant-v1',
        initialized: true as const,
        value: Object.freeze(value),
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as FarmAssistantEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: 'farm-assistant-v1',
      initialized: true as const,
      value: Object.freeze({
        greeting: GREETINGS.en,
        topPriority: 'Not enough data yet',
        top3Actions: Object.freeze([]) as unknown as string[],
        riskSummary: 'Not enough data yet',
        followUpNeeded: false,
        voiceReady: false,
        language: 'en',
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Not enough data yet — scan a plant and save a daily plan to get gentle help here.',
      limitations:
        'This helper only uses what is saved on this device so far. It gives ' +
        'general guidance and never names chemicals, doses, or treatments — always ' +
        'follow the recommended care steps. ' +
        GUIDANCE_TAIL,
    }) as FarmAssistantEnvelope,
  );
}

export function installFarmAssistantHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__farmAssistantHealth !== 'function') {
      w.__farmAssistantHealth = function () {
        const out = farmAssistantHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Farm Assistant]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
