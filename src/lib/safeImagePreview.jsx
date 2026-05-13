/**
 * safeImagePreview.jsx — broken-image-placeholder elimination.
 *
 *   import {
 *     validateImageUrl,
 *     SafeImagePreview,
 *   } from '../lib/safeImagePreview.jsx';
 *
 *   <SafeImagePreview
 *     src={analyzingImageUrl}
 *     alt="Crop photo"
 *     fallback="/icons/logo-premium.jpg"
 *     style={S.image}
 *   />
 *
 * Why this exists
 *   Scan surfaces (ScanAnalyzing, UsefulResultCard, ScanHistory)
 *   render <img src={maybeBadUrl} /> straight from various
 *   pipelines: Object URLs that can be GC'd, data URLs that may
 *   be malformed, server URLs that may 404, base64 strings that
 *   may be truncated. When any of those fail, the browser shows
 *   the universally-recognised "broken image" placeholder icon
 *   that screams "this app is broken" to the user.
 *
 *   This module gives the scan UI a single defensive surface:
 *     • validateImageUrl(s) — synchronous shape check (cheap).
 *     • <SafeImagePreview /> — async existence check + fallback.
 *   Both routes hide invalid URLs BEFORE the browser tries to
 *   render the broken-image icon.
 *
 * Strict-rule audit
 *   • SSR-safe — every window/Image guard.
 *   • Never throws — every step catches.
 *   • Pure presentational — no router, no analytics, no storage.
 */

import React, { useEffect, useRef, useState } from 'react';

// ─── Shape validation ──────────────────────────────────────────

/**
 * Synchronous shape check. Returns true when the value is a
 * non-empty string with a recognised URL form:
 *   • `data:image/*;…`         (self-contained, safe forever)
 *   • `blob:…`                 (Object URL, lifetime-bound)
 *   • `https://…` / `http://…` (network)
 *   • `/path/…` / `./…`        (relative — caller resolves)
 *
 * Does NOT make a network request. Use this for the cheap
 * pre-flight before passing src into <SafeImagePreview /> or
 * to skip rendering entirely when the value is obviously bad.
 *
 * @param {unknown} src
 * @returns {boolean}
 */
export function validateImageUrl(src) {
  try {
    if (typeof src !== 'string') return false;
    const s = src.trim();
    if (!s) return false;
    // Recognised schemes.
    if (s.startsWith('data:image/')) {
      // Defensive: a malformed data: URL with no comma will
      // render as a broken image. Require the schema + comma.
      const idx = s.indexOf(',');
      return idx > 0 && idx < s.length - 1;
    }
    if (s.startsWith('blob:') || s.startsWith('http://') || s.startsWith('https://')) {
      return s.length > 8; // reject 'blob:' alone, etc.
    }
    if (s.startsWith('/') || s.startsWith('./')) return true;
    return false;
  } catch { return false; }
}

// ─── Async existence check via Image() decode ──────────────────

/**
 * Attempt to decode the URL via a hidden Image element. Resolves
 * to true if the browser successfully loaded a non-zero pixel
 * image; false on any error or empty decode.
 *
 * Bounded by `timeoutMs` so a hanging URL doesn't block the
 * caller forever. Default 5s — same order of magnitude as the
 * scan analysis itself.
 *
 * @param {string} src
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export function probeImageUrl(src, options = {}) {
  return new Promise((resolve) => {
    try {
      if (!validateImageUrl(src)) { resolve(false); return; }
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        // SSR / non-browser — accept on shape alone.
        resolve(true);
        return;
      }
      const timeoutMs = Number.isFinite(options.timeoutMs)
        ? options.timeoutMs : 5000;
      let done = false;
      const img = new Image();
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(false);
      }, timeoutMs);
      img.onload = () => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch { /* swallow */ }
        // Decoded but zero-byte (some empty data URLs) — treat
        // as broken.
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
      };
      img.onerror = () => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch { /* swallow */ }
        resolve(false);
      };
      img.src = src;
    } catch { resolve(false); }
  });
}

// ─── React component ──────────────────────────────────────────

/**
 * <SafeImagePreview /> — renders an image only after the URL has
 * been validated AND decoded. Falls back to either:
 *   • the supplied `fallback` URL (if provided)
 *   • a calm placeholder div (no broken-image icon)
 *
 * Props:
 *   src         (string)   — the image URL (may be invalid)
 *   alt         (string)   — alt text
 *   fallback    (string)   — optional fallback URL
 *   style       (object)   — passed through to the rendered element
 *   className   (string)   — passed through
 *   testId      (string)   — applied to the visible element
 *   onValidated (fn)       — fires once with the URL that won
 *                             (the src, the fallback, or null)
 *
 * The component holds 3 internal states:
 *   'probing'    — checking src + fallback in order
 *   'ok'         — display the validated URL
 *   'placeholder'— neither src nor fallback validated; show calm div
 */
export function SafeImagePreview({
  src,
  alt = '',
  fallback,
  style,
  className,
  testId = 'safe-image-preview',
  onValidated,
}) {
  const [state, setState] = useState('probing');
  const [chosen, setChosen] = useState(null);
  // Prevent late probe resolutions from overwriting state after
  // src changes / component unmounts.
  const seqRef = useRef(0);

  useEffect(() => {
    const mySeq = ++seqRef.current;
    let cancelled = false;
    setState('probing');
    setChosen(null);
    (async () => {
      try {
        // Try src first.
        if (validateImageUrl(src)) {
          const ok = await probeImageUrl(src);
          if (cancelled || seqRef.current !== mySeq) return;
          if (ok) {
            setChosen(src);
            setState('ok');
            try { onValidated && onValidated(src); } catch { /* swallow */ }
            return;
          }
        }
        // Fallback.
        if (validateImageUrl(fallback)) {
          const ok2 = await probeImageUrl(fallback);
          if (cancelled || seqRef.current !== mySeq) return;
          if (ok2) {
            setChosen(fallback);
            setState('ok');
            try { onValidated && onValidated(fallback); } catch { /* swallow */ }
            return;
          }
        }
        // Neither worked — calm placeholder, NO broken-image icon.
        if (cancelled || seqRef.current !== mySeq) return;
        setChosen(null);
        setState('placeholder');
        try { onValidated && onValidated(null); } catch { /* swallow */ }
      } catch {
        if (cancelled || seqRef.current !== mySeq) return;
        setChosen(null);
        setState('placeholder');
      }
    })();
    return () => { cancelled = true; };
  }, [src, fallback, onValidated]);

  if (state === 'ok' && chosen) {
    return (
      <img
        src={chosen}
        alt={alt}
        style={style}
        className={className}
        data-testid={testId}
        data-state="ok"
      />
    );
  }
  // Calm placeholder — no broken-image icon, no error wording.
  return (
    <div
      style={{
        ...PLACEHOLDER_STYLE,
        ...(style || {}),
      }}
      className={className}
      data-testid={testId}
      data-state={state}
      aria-label={alt || 'image-placeholder'}
      role="img"
    />
  );
}

const PLACEHOLDER_STYLE = Object.freeze({
  background: 'linear-gradient(135deg, #F6F1E7 0%, #EFE3CB 100%)',
  borderRadius: 12,
});

const _module = { validateImageUrl, probeImageUrl, SafeImagePreview };
export default _module;
