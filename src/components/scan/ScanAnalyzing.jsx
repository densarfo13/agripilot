/**
 * ScanAnalyzing — premium analyzing screen between photo capture
 * and result.
 *
 *   <ScanAnalyzing imageUrl={dataUrl} onCancel={() => …} />
 *
 * Replaces the old "Analyzing..." button-text experience with a
 * proper transition surface:
 *   • Photo preview with rounded corners + soft shadow + scan
 *     line that sweeps top→bottom
 *   • Progressive copy sequence (4 steps over ~2.4 s):
 *       1. "Analyzing plant image…"
 *       2. "Checking visible leaf patterns…"
 *       3. "Looking for common stress signals…"
 *       4. "Preparing guidance…"
 *   • Optional Cancel button — caller wires the abort path
 *
 * Strict-rule audit
 *   • All hooks unconditional — rules-of-hooks safe.
 *   • Never throws — every effect wraps its setState/timer call.
 *   • CSS-only animations (transform + opacity) — GPU composited.
 *   • prefers-reduced-motion honored via .ff-scan-pulse / .ff-scan-line
 *     (defined in index.css; both classes degrade to no animation).
 *   • No fake percentages, no fake scientific jargon, no scary
 *     wording (spec §3 + §5).
 *   • Self-rescues: if the parent doesn't transition out of
 *     "analyzing" within 8s the surface stops cycling messages
 *     and shows a calm fallback line.
 */

import React, { useEffect, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';
import { LeafGlyph } from '../icons/InlineGlyphs.jsx';
// Phase 11 — leaf focus guidance chip row. Renders the live
// guidance flags ("move closer", "lighting too dark", "multiple
// leaves") from the leafFocusEngine. Self-suppresses when no
// flags are active so the perfect-scan path stays minimal.
import LeafFocusGuidance from './LeafFocusGuidance.jsx';
// Scan Hardening §1 — every <img> on the scan flow renders through
// SafeImagePreview which probes the URL with a hidden Image() decode
// BEFORE rendering, so the browser's broken-image icon never appears
// for a stale Object URL / malformed data: URL / 404'd server path.
import { SafeImagePreview, validateImageUrl } from '../../lib/safeImagePreview.jsx';

// Step keys + English fallbacks. Total cycle ≈ 3.2 seconds at the
// default cadence below.
// May 2026 agricultural-intelligence pipeline — the progressive
// labels now mirror the FIVE pipeline stages the engine actually
// runs (photo quality → identification → leaf-pattern comparison
// → weather + region context fusion → guidance composition).
// Surfacing each stage builds trust: the user sees that Farroway
// isn't just "thinking" but is checking the photo, comparing it
// against patterns, AND folding their farm's own context into the
// answer. The final entry holds open-ended so a slow network just
// keeps the calmest line on screen until the parent flips phase.
const STEPS = Object.freeze([
  { key: 'scan.analyzing.step1', fallback: 'Checking photo quality…',                  msHold: 600 },
  { key: 'scan.analyzing.step2', fallback: 'Identifying the crop…',                    msHold: 700 },
  { key: 'scan.analyzing.step3', fallback: 'Comparing leaf patterns…',                 msHold: 700 },
  { key: 'scan.analyzing.step4', fallback: 'Adding weather and region context…',       msHold: 700 },
  { key: 'scan.analyzing.step5', fallback: 'Preparing your guidance…',                 msHold: 999_999 },
]);

// Safety cap — if the parent never transitions out of analyzing
// (network hiccup, abort, etc.) we swap to this calm wait line so
// the user isn't stuck on "Preparing guidance…" forever.
const SAFETY_MS = 8_000;

// ─── Component ────────────────────────────────────────────────────

export default function ScanAnalyzing({
  imageUrl   = null,
  onCancel,
  experience = 'generic',
  // Scan Pipeline Audit §4 — escalation flag fed by ScanPage.
  // null            → default step copy
  // 'still_checking' → "Still checking your crop" (after 5s)
  escalation = null,
  // Phase 11 — leaf focus context. When supplied, the analyzing
  // surface renders the bbox overlay (shows the user where the
  // engine isolated the leaf) and a guidance chip row below the
  // headline. Both self-suppress when focusContext is null /
  // not-ok / no flags set, so the calm-path UX is unchanged.
  focusContext = null,
}) {
  useStrictTranslation();

  const [stepIdx,   setStepIdx]   = useState(0);
  const [tookLong,  setTookLong]  = useState(false);

  // Cycle through the step copy until we hit the last one (which
  // holds for the rest of the analysis duration). Any unmount
  // clears the timer cleanly.
  useEffect(() => {
    if (stepIdx >= STEPS.length - 1) return undefined;
    let t = null;
    try {
      t = setTimeout(() => {
        try { setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)); }
        catch { /* swallow */ }
      }, STEPS[stepIdx].msHold);
    } catch { /* swallow */ }
    return () => { if (t) { try { clearTimeout(t); } catch { /* swallow */ } } };
  }, [stepIdx]);

  // After SAFETY_MS, swap to the gentle wait line — keeps the user
  // from staring at "Preparing guidance…" if the parent took too
  // long to move on.
  useEffect(() => {
    let t = null;
    try {
      t = setTimeout(() => { try { setTookLong(true); } catch { /* swallow */ } }, SAFETY_MS);
    } catch { /* swallow */ }
    return () => { if (t) { try { clearTimeout(t); } catch { /* swallow */ } } };
  }, []);

  const step = STEPS[stepIdx] || STEPS[STEPS.length - 1];
  // Message priority (Scan Pipeline Audit §4):
  //   1. escalation === 'still_checking' (parent's 5s timer fired)
  //   2. tookLong (this component's internal SAFETY_MS timer)
  //   3. current step copy
  const message =
    escalation === 'still_checking'
      ? tSafe('scan.analyzing.stillChecking', 'Still checking your crop')
      : tookLong
        ? tSafe('scan.analyzing.taking', 'This is taking a moment. Hang on…')
        : tSafe(step.key, step.fallback);

  return (
    <section
      style={S.wrap}
      data-testid="scan-analyzing"
      data-experience={experience}
      aria-live="polite"
      aria-busy="true"
    >
      {/* Photo preview frame — rounded, soft shadow, scan line.
          Falls back to a calm gradient placeholder when no image
          URL was supplied OR the URL fails to decode (offline /
          file-API edge cases / GC'd Object URL). The synchronous
          validateImageUrl() gate eliminates obviously-malformed
          inputs without firing the Image() probe at all. */}
      <div style={S.frame} data-testid="scan-analyzing-frame">
        {/* Phase 11 — prefer the focus overlay (original + leaf
            bbox drawn) when the engine succeeded. Shows the user
            where the AI is looking. Falls through to the raw
            imageUrl when isolation failed / surface unavailable. */}
        {validateImageUrl(_pickPreviewSrc(focusContext, imageUrl)) ? (
          <SafeImagePreview
            src={_pickPreviewSrc(focusContext, imageUrl)}
            alt={tSafe('scan.preview.alt', 'Plant photo')}
            style={S.image}
            testId="scan-analyzing-image"
          />
        ) : (
          <div style={S.placeholder} aria-hidden="true"><LeafGlyph size={36} /></div>
        )}
        {/* Scan line — CSS animation defined in index.css
            (.ff-scan-line). prefers-reduced-motion disables it. */}
        <div className="ff-scan-line" style={S.scanLine} aria-hidden="true" />
        {/* Soft pulse glow on the frame edge */}
        <div className="ff-scan-pulse" style={S.pulse} aria-hidden="true" />
      </div>

      {/* Progressive copy + dot indicator */}
      <div style={S.body}>
        <p style={S.headline} data-testid="scan-analyzing-message">
          {message}
        </p>
        <div style={S.dots} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={i <= stepIdx ? { ...S.dot, ...S.dotActive } : S.dot}
            />
          ))}
        </div>
        {/* Phase 11 — guidance chips. Self-suppresses when no flag
            is active so the calm-path UX is unchanged for a
            well-framed scan. */}
        <LeafFocusGuidance guidance={focusContext && focusContext.guidance} />
        <p style={S.note}>
          {tSafe('scan.analyzing.note', 'Your photo stays on this device.')}
        </p>
      </div>

      {typeof onCancel === 'function' ? (
        <button
          type="button"
          onClick={onCancel}
          style={S.cancelBtn}
          data-testid="scan-analyzing-cancel"
        >
          {tSafe('common.cancel', 'Cancel')}
        </button>
      ) : null}
    </section>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.1rem',
    padding: '0.5rem 0 0.75rem',
  },
  // Frame is square so portrait + landscape photos fit cleanly.
  // 320 px cap to stay under the typical mobile content width
  // without getting too small on small phones.
  frame: {
    position: 'relative',
    width: 'min(320px, 80vw)',
    aspectRatio: '1 / 1',
    borderRadius: '20px',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, rgba(200,148,77,0.08) 0%, rgba(53,93,73,0.18) 100%)',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.06) inset',
      '0 18px 40px -12px rgba(0,0,0,0.42)',
      '0 0 0 1px rgba(200,148,77,0.18)',
    ].join(', '),
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    animation: 'farroway-fade-in 320ms ease-out both',
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem',
    opacity: 0.7,
  },
  // Scan line — full-width thin gradient bar that sweeps top→bottom.
  // Animation lives in index.css (.ff-scan-line) so prefers-reduced-
  // motion can disable it cleanly.
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '3px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(134,239,172,0.85) 30%, rgba(134,239,172,1) 50%, rgba(134,239,172,0.85) 70%, transparent 100%)',
    boxShadow: '0 0 18px 6px rgba(134,239,172,0.55)',
    pointerEvents: 'none',
  },
  pulse: {
    position: 'absolute',
    inset: 0,
    borderRadius: '20px',
    boxShadow: '0 0 0 0 rgba(200,148,77,0.40)',
    pointerEvents: 'none',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.55rem',
    minHeight: '4.5rem',  // reserve space so step copy doesn't jump
  },
  headline: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 1.4,
    transition: 'opacity 180ms ease-out',
  },
  dots: {
    display: 'flex',
    gap: '0.4rem',
    marginTop: '0.1rem',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.18)',
    transition: 'background 220ms ease-out',
  },
  dotActive: {
    background: '#86EFAC',
    boxShadow: '0 0 6px 1px rgba(134,239,172,0.55)',
  },
  note: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  cancelBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.65)',
    padding: '0.5rem 0.95rem',
    borderRadius: '999px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/**
 * Phase 11 — prefer the leaf-focus overlay (original + bbox)
 * over the raw capture URL when the engine succeeded. Falls
 * through cleanly when focusContext is missing or isolation
 * failed so the legacy preview path stays intact.
 */
function _pickPreviewSrc(focusContext, fallback) {
  try {
    if (focusContext && focusContext.ok
        && typeof focusContext.focusOverlayDataUrl === 'string'
        && focusContext.focusOverlayDataUrl) {
      return focusContext.focusOverlayDataUrl;
    }
  } catch { /* swallow */ }
  return fallback;
}

export const _internal = Object.freeze({ STEPS, SAFETY_MS, _pickPreviewSrc });
