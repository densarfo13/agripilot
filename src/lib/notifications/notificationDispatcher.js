/**
 * notificationDispatcher.js — channel abstraction.
 *
 * v1 channels:
 *   in_app  — store-only (the feed in NotificationCenter)
 *   push    — stub: prepare for future browser/OS push wiring
 *   sms     — stub: prepare for future SMS provider wiring
 *
 * Adapters can be registered at app boot and swapped without
 * touching consumers. If no adapter is registered for a channel,
 * the dispatcher silently no-ops (never throws).
 */

// Default in-app dispatcher — the store has already written the
// record; this is where a future hook (toast, sound) can live.
const _adapters = {
  in_app: (_notif) => { /* intentional no-op; store has already written */ },
  push:   null,
  sms:    null,
};

/**
 * setPushAdapter / setSmsAdapter — plug in real providers later.
 *
 *   setPushAdapter(async (notif) => { … fetch('/api/push/send', …) })
 *   setSmsAdapter (async (notif) => { … provider.send(...) })
 */
export function setPushAdapter(fn) { _adapters.push = typeof fn === 'function' ? fn : null; }
export function setSmsAdapter(fn)  { _adapters.sms  = typeof fn === 'function' ? fn : null; }
export function setInAppAdapter(fn){ _adapters.in_app = typeof fn === 'function' ? fn : () => {}; }
export function resetAdapters() {
  _adapters.in_app = () => {};
  _adapters.push   = null;
  _adapters.sms    = null;
}

export function dispatchNotification(notif) {
  if (!notif || typeof notif !== 'object') return 'noop';
  const channel = notif.channel === 'push' || notif.channel === 'sms'
    ? notif.channel : 'in_app';
  const fn = _adapters[channel];
  if (typeof fn !== 'function') return 'no_adapter';
  try {
    const r = fn(notif);
    // Swallow promises — we don't want await-ing consumers blocked
    // on a slow provider.
    if (r && typeof r.then === 'function') r.catch(() => {});
    return 'ok';
  } catch { return 'error'; }
}

export const _internal = Object.freeze({ getAdapters: () => ({ ..._adapters }) });
