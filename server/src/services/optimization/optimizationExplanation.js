/**
 * optimizationExplanation.js — turns an Adjustment + its source
 * bucket into a human-readable audit record. Every adjustment
 * the loop emits gets one so tooling can answer "why did this
 * fire?" without decoding raw counts.
 *
 * Example output:
 *   {
 *     contextKey: 'tomato|us|md|backyard|4',
 *     scope:      'regional',
 *     explanation:
 *       'Tomato boosted +0.08 from 18 acceptances vs 4 rejections,
 *        confidence up 6.2 from 7 good / 1 bad harvests',
 *     sourceSignalCount: 30,
 *     deltas: { recommendation: +0.08, confidence: +6.2, ... },
 *     reasons: ['recommendation_up_ratio:0.64', ...],
 *     createdAt: 1713484800000,
 *   }
 *
 * The explanation text is deterministic — same input → same
 * string — so snapshot-light tests can lock it in without
 * over-specifying.
 */

import { parseContextKey } from './contextKey.js';
import { parseScopeFromKey, regionalKeyFromPersonal } from './personalVsRegional.js';

function capitalize(s) {
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
}

function describeCrop(parsed) {
  if (parsed.crop) return capitalize(parsed.crop);
  return 'Context';
}

function describeRegion(parsed) {
  const parts = [];
  if (parsed.state)   parts.push(parsed.state.toUpperCase());
  if (parsed.country) parts.push(parsed.country.toUpperCase());
  if (!parts.length)  return '';
  return parts.join(', ');
}

function describeMode(parsed) {
  return parsed.mode || '';
}

/**
 * buildOptimizationExplanation — pure function: Adjustment +
 * bucket + context → audit record. Safe for null/empty inputs.
 */
export function buildOptimizationExplanation(adjustment = {}, bucket = {}, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const counts = (bucket && bucket.counts) || adjustment.counts || {};
  const scope = adjustment.scope || parseScopeFromKey(adjustment.contextKey);
  const canonicalKey = scope === 'personal'
    ? regionalKeyFromPersonal(adjustment.contextKey)
    : adjustment.contextKey || '';
  const parsed = parseContextKey(canonicalKey);

  const cropLabel = describeCrop(parsed);
  const regionLabel = describeRegion(parsed);
  const modeLabel = describeMode(parsed);

  const fragments = [];

  // ── Recommendation fragment ─────────────────────
  const recDelta = Number(adjustment.recommendationDelta || 0);
  if (recDelta !== 0) {
    const accepted = counts.rec_accepted || 0;
    const rejected = counts.rec_rejected || 0;
    const direction = recDelta > 0 ? 'boosted' : 'reduced';
    fragments.push(
      `${cropLabel} ${direction} ${signed(recDelta, 2)} from `
      + `${accepted} ${accepted === 1 ? 'acceptance' : 'acceptances'} `
      + `vs ${rejected} ${rejected === 1 ? 'rejection' : 'rejections'}`,
    );
  }

  // ── Confidence fragment ─────────────────────────
  const confDelta = Number(adjustment.confidenceDelta || 0);
  if (confDelta !== 0) {
    const good = counts.harvest_good || 0;
    const bad  = counts.harvest_bad || 0;
    const direction = confDelta > 0 ? 'up' : 'down';
    fragments.push(
      `confidence ${direction} ${Math.abs(confDelta).toFixed(1)} from `
      + `${good} good / ${bad} bad ${(good + bad) === 1 ? 'harvest' : 'harvests'}`,
    );
  }

  // ── Urgency fragment ────────────────────────────
  const urgDelta = Number(adjustment.urgencyDelta || 0);
  if (urgDelta !== 0) {
    const done = counts.task_completed || 0;
    const skipped = counts.task_skipped || 0;
    const repeat = counts.task_repeat_skipped || 0;
    fragments.push(
      `urgency ${urgDelta > 0 ? 'up' : 'down'} ${signed(urgDelta, 2)} `
      + `(${done} completed / ${skipped} skipped / ${repeat} repeat-skipped)`,
    );
  }

  // ── Listing fragment ────────────────────────────
  const listDelta = Number(adjustment.listingQualityDelta || 0);
  if (listDelta !== 0) {
    const expired  = counts.listing_expired_unsold || 0;
    const sold     = counts.listing_sold || 0;
    const interest = counts.listing_interest || 0;
    fragments.push(
      `listing quality floor +${listDelta.toFixed(2)} `
      + `(${expired} expired, ${sold} sold, ${interest} interest)`,
    );
  }

  // ── Final composition ───────────────────────────
  let explanation = fragments.length
    ? fragments.join('; ')
    : 'No meaningful adjustment — below threshold or no signal';

  // Suffix with region/mode/month context if any of them are
  // present so the text is self-describing.
  const suffixBits = [];
  if (regionLabel) suffixBits.push(`in ${regionLabel}`);
  if (modeLabel)   suffixBits.push(`${modeLabel} mode`);
  if (parsed.month) suffixBits.push(`month ${parsed.month}`);
  if (suffixBits.length) explanation += ` (${suffixBits.join(', ')})`;

  const sourceSignalCount = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);

  return Object.freeze({
    contextKey: adjustment.contextKey || '',
    scope,
    explanation,
    sourceSignalCount,
    deltas: {
      recommendation:  recDelta,
      confidence:      confDelta,
      urgency:         urgDelta,
      listingQuality:  listDelta,
    },
    reasons:  Array.isArray(adjustment.reasons) ? [...adjustment.reasons] : [],
    counts:   { ...counts },
    createdAt: now,
  });
}

function signed(n, digits) {
  const v = Number(n);
  const s = Math.abs(v).toFixed(digits);
  return v >= 0 ? `+${s}` : `-${s}`;
}

export const _internal = { describeCrop, describeRegion, signed };
