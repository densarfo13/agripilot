/**
 * cardToPng.js — render a Garden Mode share card to a PNG Blob.
 *
 *   import { renderShareCardPng } from '../lib/share/cardToPng.js';
 *
 *   const blob = await renderShareCardPng({
 *     nickname:  'Balcony Tomato',
 *     stage:     'flowering',
 *     emoji:     '🌼',
 *     caption:   'Steady care makes a difference.',
 *     photoUrl:  plant.photo,        // optional dataURL
 *     brand:     'Farroway',
 *     size:      720,                // square px (default — 720 fits IG square at 1.5×)
 *   });
 *
 *   if (blob) {
 *     // share via Web Share API or trigger download
 *   }
 *
 * Pipeline:
 *   build SVG string → load as <img> → drawImage to <canvas> → toBlob
 *
 * No external libraries. Pure browser APIs. Works on any modern
 * browser (Chrome/Safari/Firefox/Edge). All text and shapes are
 * SVG primitives, so the rasterized PNG is crisp at the requested
 * `size` — no font-loading races, no CSS dependencies.
 *
 * Strict-rule audit
 *   • Pure module — no React, no I/O beyond canvas + Image.
 *   • Never throws — every path resolves to a Blob or null.
 *   • SSR-safe — guards window/document/Image presence.
 *   • Defensive on missing inputs (fallback nickname, etc.).
 */

const DEFAULTS = Object.freeze({
  size:        720,
  brand:       'Farroway',
  bgTop:       '#F3E8D0',
  bgMid:       '#E8DEC4',
  bgBot:       '#DDD3B4',
  inkDark:     '#234733',
  ink:         '#2A3A2D',
  inkSoft:     '#5C6B5E',
  terracotta:  '#C97B45',
});

const STAGE_EMOJI = Object.freeze({
  seedling:      '🌱',
  growing:       '🌿',
  vegetative:    '🌿',
  flowering:     '🌼',
  fruiting:      '🍅',
  ready_to_pick: '🌾',
  harvest:       '🌾',
  resting:       '💤',
  dormant:       '💤',
});

function _stageEmoji(stage) {
  const s = String(stage || '').toLowerCase();
  if (!s) return '🌿';
  return STAGE_EMOJI[s] || (
    s.includes('flower')   ? '🌼' :
    s.includes('fruit')    ? '🍅' :
    s.includes('harvest') || s.includes('ready') ? '🌾' :
    s.includes('seed')     ? '🌱' :
    '🌿'
  );
}

function _isBrowser() {
  return typeof window !== 'undefined'
      && typeof document !== 'undefined'
      && typeof Image !== 'undefined';
}

// XML-escape user-supplied text before injecting into SVG.
function _xml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Word-wrap a caption into N lines for SVG <text>. Uses character
// length as a proxy for width — good enough for the ~22-char-per-line
// budget the card body affords at default sizing.
function _wrap(text, maxChars = 30, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else { if (cur) lines.push(cur); cur = w; }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [''];
}

// Capitalize first char (e.g. 'flowering' → 'Flowering').
function _titleCase(s) {
  const v = String(s || '').replace(/_/g, ' ').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}

/**
 * _buildSvg(opts) → string
 *
 * Builds the SVG markup for the share card. All shapes/text are
 * native SVG; the only raster element is the optional plant photo
 * embedded as a data URL via <image>.
 */
function _buildSvg(o) {
  const W = o.size, H = o.size;
  const palette = {
    bgTop:      o.bgTop      || DEFAULTS.bgTop,
    bgMid:      o.bgMid      || DEFAULTS.bgMid,
    bgBot:      o.bgBot      || DEFAULTS.bgBot,
    inkDark:    o.inkDark    || DEFAULTS.inkDark,
    ink:        o.ink        || DEFAULTS.ink,
    inkSoft:    o.inkSoft    || DEFAULTS.inkSoft,
    terracotta: o.terracotta || DEFAULTS.terracotta,
  };

  const nickname = _xml(o.nickname || 'My Plant');
  const stageStr = _titleCase(o.stage || '');
  const captionLines = _wrap(o.caption || '', 30, 3);
  const brand = _xml(o.brand || DEFAULTS.brand);
  const emoji = _xml(o.emoji || _stageEmoji(o.stage));

  // Hero region = upper 52% (matches DOM card).
  const heroH = Math.round(H * 0.52);
  const bodyY = heroH + 16;

  const photoBlock = (typeof o.photoUrl === 'string' && o.photoUrl)
    ? `<image href="${_xml(o.photoUrl)}"
              x="0" y="0"
              width="${W}" height="${heroH}"
              preserveAspectRatio="xMidYMid slice"/>
       <rect x="0" y="${heroH - 60}" width="${W}" height="60"
             fill="url(#heroFade)"/>`
    : `<text x="${W / 2}" y="${heroH / 2 + 30}"
              text-anchor="middle"
              font-size="120"
              dominant-baseline="middle">${emoji}</text>`;

  // Caption — 3 lines max, line-height 28px at 18px font.
  const captionTspans = captionLines.map((line, i) => (
    `<tspan x="48" dy="${i === 0 ? 0 : 28}">${_xml(line)}</tspan>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
     font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="${palette.bgTop}"/>
      <stop offset="60%" stop-color="${palette.bgMid}"/>
      <stop offset="100%" stop-color="${palette.bgBot}"/>
    </linearGradient>
    <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="${palette.bgMid}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${palette.bgMid}" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.3" r="0.7">
      <stop offset="0%"  stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Card background -->
  <rect width="${W}" height="${H}" rx="48" ry="48" fill="url(#bg)"/>

  <!-- Sunlight glow top-left -->
  <rect width="${W}" height="${H}" rx="48" ry="48" fill="url(#glow)"/>

  <!-- Hero (photo or emoji) -->
  ${photoBlock}

  <!-- Nickname -->
  <text x="48" y="${bodyY + 30}"
        font-size="36" font-weight="800"
        fill="${palette.inkDark}"
        letter-spacing="-0.005em">${nickname}</text>

  <!-- Stage chip -->
  ${stageStr ? `
  <rect x="48" y="${bodyY + 50}" width="${stageStr.length * 11 + 24}" height="26"
        rx="13" ry="13"
        fill="${palette.inkDark}" fill-opacity="0.10"/>
  <text x="${48 + 12}" y="${bodyY + 68}"
        font-size="14" font-weight="700"
        letter-spacing="0.05em"
        fill="${palette.inkDark}"
        opacity="0.80">${_xml(stageStr.toUpperCase())}</text>
  ` : ''}

  <!-- Caption (up to 3 lines) -->
  <text y="${bodyY + 110}"
        font-size="22" font-weight="500"
        fill="${palette.ink}">
    ${captionTspans}
  </text>

  <!-- Brand strip + label -->
  <line x1="${W * 0.18}" y1="${H - 56}" x2="${W * 0.82}" y2="${H - 56}"
        stroke="${palette.terracotta}" stroke-width="2" opacity="0.65"/>
  <text x="${W - 48}" y="${H - 28}"
        text-anchor="end"
        font-size="14" font-weight="800"
        letter-spacing="0.16em"
        fill="${palette.terracotta}">${_xml(brand.toUpperCase())}</text>
</svg>`;
}

function _svgToImage(svg) {
  return new Promise((resolve) => {
    if (!_isBrowser()) { resolve(null); return; }
    try {
      // Encode as a UTF-8 data URL so non-ASCII (emoji, accents,
      // localized captions) survive the trip into <img src>.
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload  = () => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } resolve(img); };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } resolve(null); };
      img.src = url;
    } catch { resolve(null); }
  });
}

function _canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => resolve(blob || null), 'image/png');
      } else {
        // Fallback for environments without toBlob — convert dataURL.
        const dataUrl = canvas.toDataURL('image/png');
        if (!dataUrl) { resolve(null); return; }
        const idx = dataUrl.indexOf(',');
        if (idx === -1) { resolve(null); return; }
        const b64 = dataUrl.slice(idx + 1);
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: 'image/png' }));
      }
    } catch { resolve(null); }
  });
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * renderShareCardPng(opts) → Promise<Blob | null>
 *
 * Returns a square PNG Blob (`image/png`) of the share card, or
 * null on any failure. Callers can either:
 *   • download via URL.createObjectURL(blob) + a temporary <a>,
 *   • share via navigator.share({ files: [new File([blob], …)] }),
 *   • upload to a server endpoint.
 *
 * Never throws.
 */
export async function renderShareCardPng(opts = {}) {
  if (!_isBrowser()) return null;

  const o = { ...DEFAULTS, ...(opts && typeof opts === 'object' ? opts : {}) };
  const svg = _buildSvg(o);

  const img = await _svgToImage(svg);
  if (!img) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width  = o.size;
    canvas.height = o.size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, o.size, o.size);
    return await _canvasToPngBlob(canvas);
  } catch {
    return null;
  }
}

/**
 * triggerPngDownload(blob, filename?) — best-effort download.
 *
 * Uses a temporary <a download> element. Cleans up the object URL
 * afterwards. Returns true on dispatch (not download completion —
 * the browser handles that asynchronously).
 */
export function triggerPngDownload(blob, filename = 'farroway-plant.png') {
  if (!_isBrowser() || !blob) return false;
  let url = '';
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href     = url;
    a.download = String(filename || 'farroway-plant.png');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  } finally {
    if (url) {
      try { setTimeout(() => URL.revokeObjectURL(url), 4000); }
      catch { /* swallow */ }
    }
  }
}

/**
 * canShareImageFiles() — capability check for `navigator.share` with
 * a `files` payload. Mobile Safari + Chrome on Android both support
 * this; older desktop browsers don't.
 */
export function canShareImageFiles() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return true; // optimistic — share() will fail gracefully
    // Build a tiny synthetic File to test with. Some platforms only
    // allow this check after a user gesture — treat any throw as 'no'.
    const probe = new File([new Blob(['x'])], 'probe.png', { type: 'image/png' });
    return !!navigator.canShare({ files: [probe] });
  } catch { return false; }
}

export const _internal = Object.freeze({
  DEFAULTS,
  STAGE_EMOJI,
  _buildSvg,
  _wrap,
  _xml,
  _titleCase,
  _stageEmoji,
});
