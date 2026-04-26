import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AppSettingsProvider } from './context/AppSettingsContext.jsx';
import LanguageRegionGate from './components/LanguageRegionGate.jsx';
import { initSyncCoordinator } from './services/syncCoordinator.js';
import { registerServiceWorker } from './lib/sw/registerServiceWorker.js';
import './index.css';
// Bootstrap the JSON-driven react-i18next namespace once, before any
// component mounts (spec §10). Legacy translations.js engine still
// runs in parallel; the two systems stay in sync via
// farroway:langchange events.
import './i18n/i18next.js';

// Initialize offline sync coordinator (auto-flushes on reconnect + visibility)
initSyncCoordinator();

// Dev-only DOM text audit — runs ONCE on first idle, scans for
// likely hardcoded English literals, reports a single grouped block
// to the console. Vite tree-shakes the dynamic import out of the
// production bundle because `import.meta.env.DEV` is statically
// false there, so this code never ships to farmers.
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  import('./i18n/devTextAudit.js').catch(() => { /* never block boot */ });
}

// Register the service worker with new-version detection. The helper
// listens for `updatefound` and broadcasts `farroway:sw_activated`;
// any UI surface that wants to show "Reload to update" can listen for
// the global `farroway:sw_new_version` event below.
if (typeof window !== 'undefined') {
  registerServiceWorker({
    onNewVersion: (reload) => {
      try {
        window.__farrowayReloadForUpdate = reload;
        window.dispatchEvent(new CustomEvent('farroway:sw_new_version'));
      } catch { /* never propagate */ }
    },
    onActivated: (version) => {
      try { window.dispatchEvent(new CustomEvent('farroway:sw_activated', { detail: version })); }
      catch { /* never propagate */ }
    },
  }).catch(() => { /* never propagate */ });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppSettingsProvider>
        <LanguageRegionGate>
          <App />
        </LanguageRegionGate>
      </AppSettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
