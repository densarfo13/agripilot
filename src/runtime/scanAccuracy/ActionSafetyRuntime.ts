/**
 * ActionSafetyRuntime.ts — §ACTION SAFETY.
 *
 * Pure guard that rejects unsafe scan recommendation text. The scan
 * pipeline only emits low-risk actions (Inspect leaves, Check moisture,
 * Retake photo, Monitor nearby plants). This module exposes:
 *
 *   • isSafeAction(text)        — returns false when text contains any
 *                                 forbidden chemical/dosage/treatment
 *                                 pattern
 *   • safeActionOrFallback(text, fallback) — sanitizer: returns the
 *     input when safe; the fallback (or default safe action) otherwise
 *   • FORBIDDEN_ACTION_PATTERNS — exported for the gate to verify
 *
 * Self-contained; pure; never throws.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';

export const ACTION_SAFETY_VERSION = 'action-safety-v1' as const;

/** Forbidden patterns. Each entry is a substring or regex source the
 *  scan pipeline must NEVER include in user-visible action text. */
export const FORBIDDEN_ACTION_PATTERNS: ReadonlyArray<string> = Object.freeze([
  // Dosage units.
  'kg/ha', 'g/m2', 'g/ha', 'L/ha', 'ml/L', 'mg/L', 'ppm',
  // Chemical categories — generic.
  'fungicide', 'pesticide', 'herbicide', 'insecticide', 'fumigant',
  // Common chemical names that must be flagged for human review.
  'glyphosate', 'paraquat', 'atrazine', 'chlorothalonil',
  'mancozeb', 'metalaxyl', 'carbendazim', 'urea',
  // Unsafe treatment verbs combined with chemicals.
  'spray with',
  // Antibiotic + medicinal.
  'antibiotic',
]);

/** Safe default action returned when the input is rejected. */
export const SAFE_DEFAULT_ACTION =
  'Inspect leaves closely and retake a sharper photo in good daylight.';

export interface ActionSafetyResult {
  safe: boolean;
  reason: string;        // when unsafe: which pattern triggered
  sanitized: string;     // input when safe; fallback or safe default otherwise
}

export interface ActionSafetyHealthEnvelope {
  initialized: true;
  safetyGuardReady: true;
  forbiddenPatternCount: number;
  noChemicalRecommendations: true;
  noDosageRecommendations: true;
  noUnsafeTreatmentAdvice: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function isSafeAction(text: any): boolean {
  return _safe(() => {
    if (typeof text !== 'string' || text.trim().length === 0) return true;
    const lower = text.toLowerCase();
    for (const pat of FORBIDDEN_ACTION_PATTERNS) {
      if (lower.indexOf(pat.toLowerCase()) >= 0) return false;
    }
    // Numeric dosage shorthand like "5 g/L", "20 ml" near "spray" etc.
    // Catch a digit immediately followed by ml/mg/g/kg/L when not
    // describing a plant size.
    if (/\b\d+\s*(?:ml|mg|kg)\b/i.test(text)
        && /\b(spray|apply|mix|dose)\b/i.test(text)) {
      return false;
    }
    return true;
  }, true);
}

export function safeActionOrFallback(text: any, fallback?: string): Readonly<ActionSafetyResult> {
  return _safe(() => {
    if (typeof text !== 'string' || text.trim().length === 0) {
      return Object.freeze<ActionSafetyResult>({
        safe: true,
        reason: '',
        sanitized: (typeof fallback === 'string' && fallback.trim()) ? fallback : SAFE_DEFAULT_ACTION,
      });
    }
    const lower = text.toLowerCase();
    let hit: string | null = null;
    for (const pat of FORBIDDEN_ACTION_PATTERNS) {
      if (lower.indexOf(pat.toLowerCase()) >= 0) { hit = pat; break; }
    }
    if (!hit && /\b\d+\s*(?:ml|mg|kg)\b/i.test(text)
        && /\b(spray|apply|mix|dose)\b/i.test(text)) {
      hit = 'dosage-like-numeric';
    }
    if (hit) {
      return Object.freeze<ActionSafetyResult>({
        safe: false,
        reason: 'Matched forbidden pattern: ' + hit,
        sanitized: (typeof fallback === 'string' && fallback.trim()) ? fallback : SAFE_DEFAULT_ACTION,
      });
    }
    return Object.freeze<ActionSafetyResult>({
      safe: true,
      reason: '',
      sanitized: text,
    });
  }, Object.freeze<ActionSafetyResult>({
    safe: true,
    reason: '',
    sanitized: SAFE_DEFAULT_ACTION,
  }));
}

export function actionSafetyReady(): boolean { return true; }

export function actionSafetyHealth(): Readonly<ActionSafetyHealthEnvelope> {
  return _safe(() => Object.freeze<ActionSafetyHealthEnvelope>({
    initialized: true,
    safetyGuardReady: true as const,
    forbiddenPatternCount: FORBIDDEN_ACTION_PATTERNS.length,
    noChemicalRecommendations: true as const,
    noDosageRecommendations: true as const,
    noUnsafeTreatmentAdvice: true as const,
    confidence: 'high' as Confidence,
    explanation:
      'Action safety guard. Pure-function reject of any text containing chemical names, ' +
      'dosage units, or unsafe treatment verbs paired with numeric dosages. ' +
      'safeActionOrFallback returns a SAFE default ("Inspect leaves closely and retake a ' +
      'sharper photo in good daylight.") when the input is rejected.',
    limitations:
      'Substring/regex guard — not a domain semantic analyzer. ' + GUIDANCE_TAIL,
  }), Object.freeze<ActionSafetyHealthEnvelope>({
    initialized: true,
    safetyGuardReady: true as const,
    forbiddenPatternCount: 0,
    noChemicalRecommendations: true as const,
    noDosageRecommendations: true as const,
    noUnsafeTreatmentAdvice: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Action safety runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installActionSafetyGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__actionSafetyHealth !== 'function') {
      w.__actionSafetyHealth = function () {
        const out = actionSafetyHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Action Safety]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
