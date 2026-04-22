import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AppSettingsProvider } from './context/AppSettingsContext.jsx';
import LanguageRegionGate from './components/LanguageRegionGate.jsx';
import { initSyncCoordinator } from './services/syncCoordinator.js';
import './index.css';
// Bootstrap the JSON-driven react-i18next namespace once, before any
// component mounts (spec §10). Legacy translations.js engine still
// runs in parallel; the two systems stay in sync via
// farroway:langchange events.
import './i18n/i18next.js';

// Initialize offline sync coordinator (auto-flushes on reconnect + visibility)
initSyncCoordinator();

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
