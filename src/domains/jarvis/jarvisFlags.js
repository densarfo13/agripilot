/**
 * jarvisFlags.js — Jarvis MVP kill-switch (default OFF).
 *
 * Jarvis renders NOTHING unless 'farroway.jarvis.enabled' === '1' in localStorage —
 * so even if this branch ever merges, production farmers see no change until the
 * flag is deliberately flipped per-device (pilot-controlled). "Disable Jarvis"
 * sets '0', which also wins over any future default-on.
 */

const KEY = 'farroway.jarvis.enabled';

const _ls = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };

export function isJarvisEnabled() {
  try { const ls = _ls(); return !!ls && ls.getItem(KEY) === '1'; } catch { return false; }
}

export function setJarvisEnabled(on) {
  try { const ls = _ls(); if (ls) ls.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export default { isJarvisEnabled, setJarvisEnabled };
