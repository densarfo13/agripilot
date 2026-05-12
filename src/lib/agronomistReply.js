/**
 * agronomistReply.js — compose the decision envelope into ONE calm
 * conversational paragraph the farmer can read top-down.
 *
 *   const reply = composeAgronomistReply(result.decision, { lang: 'en' });
 *   // → "Your maize looks stressed from recent heavy rain. Reduce
 *   //    watering for 2 days and check lower leaves for fungal spread.
 *   //    This pattern is common in the area this season."
 *
 * Why this exists
 * ────────────────
 *   The scan card already renders all the pieces — what's wrong,
 *   what to do, weather caution, region context. But each lives in
 *   its own block. A farmer scanning quickly on a phone needs the
 *   one-paragraph summary an agronomist would say out loud: "Here's
 *   what I see, here's what to do, here's the context."
 *
 *   This composer doesn't invent new facts — every clause comes
 *   from a field the policy module ALREADY filled in. It just
 *   sequences them in conversational order so the user gets the
 *   human voice before the bullets.
 *
 * Composition order
 * ──────────────────
 *   1. Crop + condition       — "Your maize looks stressed."
 *   2. What it means           — short plain-language reason.
 *   3. Action today            — top recommended action.
 *   4. Weather context         — caution line, if present.
 *   5. Regional context        — "This pattern is common…", if present.
 *
 *   We deliberately leave OUT next-check and saveable-summary —
 *   those duplicate the follow-up block and the share button.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Never reads from window / localStorage.
 *   • Returns '' (empty string) when there's nothing useful to say so
 *     the caller can skip the block cleanly.
 *   • i18n is intentionally OUT of scope — the decision envelope's
 *     fields are pre-translated by the server's scanResultNormalizer
 *     when a Twi / Hindi / etc. user scans. We just sequence the
 *     pieces in the order an agronomist would speak them.
 */

// ─── Sentence punctuation helper ─────────────────────────────────
// We respect "?" and "!" so a question stays a question. Everything
// else gets a period if it doesn't end with one.
function _terminate(s) {
  const trimmed = String(s || '').trim();
  if (!trimmed) return '';
  const last = trimmed[trimmed.length - 1];
  if (last === '.' || last === '!' || last === '?') return trimmed;
  return trimmed + '.';
}

// Drop the leading "→ " the saveable-summary composer uses so the
// action reads as a sentence inside the paragraph.
function _stripArrow(s) {
  const t = String(s || '').trim();
  return t.startsWith('→ ') ? t.slice(2).trim() : t;
}

// Capitalise the first character so an action like "remove infected
// leaves" reads correctly when it starts its own sentence.
function _capFirst(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Compose the conversational paragraph.
 *
 * @param {object} decision  — the 12-field decision envelope from
 *                              scanResultNormalizer.normalizeToDecisionShape.
 *                              Tolerates partial envelopes (e.g. older
 *                              server bundles) — missing fields are
 *                              simply skipped.
 * @param {object} [options]
 * @param {string} [options.cropFallback]  — render this crop name
 *                  when decision.cropDetected is null (e.g. "Your maize"
 *                  vs "Your crop"). Used by the card when the active
 *                  farm has a crop registered.
 * @returns {string}  one calm paragraph, or '' when the envelope
 *                    carries nothing worth saying.
 */
export function composeAgronomistReply(decision, options = {}) {
  if (!decision || typeof decision !== 'object') return '';

  const _get = (k) => {
    const v = decision[k];
    if (v == null) return '';
    return String(v).trim();
  };

  const crop          = _get('cropDetected') || String(options.cropFallback || '').trim();
  const issue         = _get('issueDetected');
  const whatItMeans   = _get('whatItMeans');
  const actionToday   = _stripArrow(_get('actionToday'));
  const weather       = _get('weatherCaution');
  const region        = _get('regionContext');

  const parts = [];

  // ── Lead: crop + condition ─────────────────────────────────
  // Prefer whatItMeans when it reads as a complete observation
  // already (the policy module sometimes emits "Your tomato leaves
  // show yellow patches typical of blight."). Otherwise stitch a
  // crop + issue lead.
  if (whatItMeans) {
    parts.push(_terminate(whatItMeans));
  } else if (crop && issue) {
    parts.push(_terminate(`Your ${crop.toLowerCase()} shows signs of ${issue.toLowerCase()}`));
  } else if (issue) {
    parts.push(_terminate(`What we see looks like ${issue.toLowerCase()}`));
  } else if (crop) {
    parts.push(_terminate(`Your ${crop.toLowerCase()} was scanned`));
  }

  // ── Action today ───────────────────────────────────────────
  if (actionToday) {
    parts.push(_terminate(_capFirst(actionToday)));
  }

  // ── Weather context ────────────────────────────────────────
  if (weather) {
    parts.push(_terminate(_capFirst(weather)));
  }

  // ── Regional context ───────────────────────────────────────
  if (region) {
    parts.push(_terminate(_capFirst(region)));
  }

  // Empty paragraph — let the caller skip the block.
  if (parts.length === 0) return '';

  // Join with single spaces so the result is one readable line in
  // a CSS-wrapped paragraph. We avoid newlines because the card's
  // text style controls wrapping for us.
  return parts.join(' ');
}

export default { composeAgronomistReply };
