import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initSyncCoordinator } from './services/syncCoordinator.js';
import './index.css';

// Initialize offline sync coordinator (auto-flushes on reconnect + visibility)
initSyncCoordinator();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
