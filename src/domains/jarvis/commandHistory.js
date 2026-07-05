/**
 * commandHistory.js — Jarvis MVP history (privacy-first).
 *
 * Voice/text commands are user data: stored LOCALLY only (localStorage ring, cap 20),
 * never sent to the server, deletable in one tap (spec: "command history delete").
 * SSR-safe; never throws; quota failures degrade to in-memory only.
 */

const KEY = 'farroway.jarvis.history.v1';
const CAP = 20;
let _mem = [];

const _ls = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };

function _read() {
  try {
    const raw = _ls() && _ls().getItem(KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a; }
  } catch { /* fall through */ }
  return _mem;
}

function _write(list) {
  _mem = list.slice(-CAP);
  try { const ls = _ls(); if (ls) ls.setItem(KEY, JSON.stringify(_mem)); } catch { /* memory only */ }
}

export function addCommand(text, intent) {
  try {
    const list = _read().slice();
    list.push({ text: String(text || '').slice(0, 200), intent: String(intent || 'UNKNOWN'), at: new Date().toISOString() });
    _write(list);
  } catch { /* never throw */ }
}

export function listCommands() {
  try { return _read().slice().reverse(); } catch { return []; }
}

export function clearCommands() {
  _mem = [];
  try { const ls = _ls(); if (ls) ls.removeItem(KEY); } catch { /* ignore */ }
}

export default { addCommand, listCommands, clearCommands };
