/**
 * serviceWorkerManager.js — OFFLINE_SHELL_V1 registration + diagnostics.
 *
 * Registers /sw.js (skips Capacitor native, which ships its own shell)
 * and installs window.__offlineShellHealth(). Auto-applies an updated SW
 * (skipWaiting) so a deploy is never blocked behind a waiting worker.
 * Never throws.
 */
import { OFFLINE_SHELL_ENABLED, SW_URL } from './offlineShellConfig.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _state = { registered: false, controllerChanged: false, updateApplied: false, error: null };

export function registerOfflineShell() {
  if (!OFFLINE_SHELL_ENABLED) return;
  if (_safe(() => typeof navigator === 'undefined' || !('serviceWorker' in navigator), true)) return;
  if (_safe(() => typeof window !== 'undefined' && !!window.Capacitor, false)) return; // native shell
  _safe(() => {
    const reg = () => navigator.serviceWorker.register(SW_URL).then((registration) => {
      _state.registered = true;
      if (registration.waiting) _safe(() => registration.waiting.postMessage('SKIP_WAITING'));
      _safe(() => registration.addEventListener('updatefound', () => {
        const nw = registration.installing;
        if (!nw) return;
        _safe(() => nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            _state.updateApplied = true;
            _safe(() => nw.postMessage('SKIP_WAITING'));
          }
        }));
      }));
    }).catch((e) => { _state.error = (e && e.message) || 'register_failed'; });

    // Register after load so the SW install never competes with first paint.
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') reg();
      else window.addEventListener('load', reg, { once: true });
      navigator.serviceWorker.addEventListener('controllerchange',
        () => { _state.controllerChanged = true; });
    }
  });
}

export function installOfflineShellHealth() {
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => Object.defineProperty(window, '__offlineShellHealth', {
    configurable: true, enumerable: false, writable: false,
    value: () => Object.freeze({
      enabled: OFFLINE_SHELL_ENABLED,
      swSupported: _safe(() => typeof navigator !== 'undefined' && 'serviceWorker' in navigator, false),
      registered: _state.registered,
      controlled: _safe(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), false),
      controllerChanged: _state.controllerChanged,
      updateApplied: _state.updateApplied,
      online: _safe(() => navigator.onLine, null),
      error: _state.error,
    }),
  }));
}

export default { registerOfflineShell, installOfflineShellHealth };
