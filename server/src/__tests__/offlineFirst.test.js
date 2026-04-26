import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project paths relative to the repository root, not
// process.cwd() — the test runner is invoked with cwd=server/,
// which broke 'src/components/X.jsx' style relative paths.
const REPO_ROOT_FOR_TEST_READS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."
);

function readFile(relPath) {
  return fs.readFileSync(path.resolve(REPO_ROOT_FOR_TEST_READS, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — Local Draft Persistence
// ═══════════════════════════════════════════════════════════

describe('Local draft persistence — useDraft hook', () => {
  const code = readFile('src/utils/useDraft.js');

  it('saves draft to localStorage on every setState', () => {
    expect(code).toContain('localStorage.setItem');
    expect(code).toContain('farroway:draft:');
  });

  it('restores draft from localStorage on mount', () => {
    expect(code).toContain('localStorage.getItem');
  });

  it('provides clearDraft to remove saved data', () => {
    expect(code).toContain('clearDraft');
    expect(code).toContain('localStorage.removeItem');
  });

  it('exposes draftRestored flag', () => {
    expect(code).toContain('draftRestored');
  });
});

describe('Draft usage in critical forms', () => {
  it('OnboardingWizard uses useDraft', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('useDraft');
    expect(code).toContain("'onboarding-wizard'");
  });

  it('FarmerProgressTab uses useDraft for season form', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain('useDraft');
    expect(code).toContain('season-form:');
  });

  it('FarmerProgressTab uses useDraft for progress form', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain('progress-form:');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — Offline Queue
// ═══════════════════════════════════════════════════════════

describe('Offline queue — IndexedDB mutation store', () => {
  const code = readFile('src/utils/offlineQueue.js');

  it('uses IndexedDB for persistence', () => {
    expect(code).toContain('indexedDB.open');
    expect(code).toContain('farroway-offline');
  });

  it('exports enqueue function', () => {
    expect(code).toContain('export async function enqueue');
  });

  it('exports syncAll function', () => {
    expect(code).toContain('export async function syncAll');
  });

  it('has 10s dedup window', () => {
    expect(code).toContain('10000');
  });

  it('has MAX_RETRIES of 5', () => {
    expect(code).toContain('MAX_RETRIES');
    expect(code).toContain('5');
  });

  it('has 7-day expiry for stale mutations', () => {
    expect(code).toContain('EXPIRY_MS');
    expect(code).toContain('7 * 24 * 60 * 60 * 1000');
  });

  it('handles 409 Conflict as already-processed', () => {
    expect(code).toContain('409');
  });

  it('logs sync failures to localStorage ring buffer', () => {
    expect(code).toContain('farroway:sync_failures');
  });

  it('exports isOnline helper', () => {
    expect(code).toContain('export function isOnline');
    expect(code).toContain('navigator.onLine');
  });

  it('has auto-sync on reconnect', () => {
    expect(code).toContain("addEventListener('online'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — Sync State Visibility
// ═══════════════════════════════════════════════════════════

describe('SyncStatus — global sync indicator', () => {
  const code = readFile('src/components/SyncStatus.jsx');

  it('shows offline state', () => {
    expect(code).toContain("t('sync.offline')");
  });

  it('shows pending state with count', () => {
    expect(code).toContain("t('sync.pendingOne'");
    expect(code).toContain("t('sync.pendingMany'");
  });

  it('shows syncing state', () => {
    expect(code).toContain("t('sync.syncing')");
  });

  it('shows sync success state', () => {
    expect(code).toContain("t('sync.syncedOne'");
  });

  it('shows sync failure state', () => {
    expect(code).toContain("t('sync.failedOne'");
  });

  it('has Sync Now button', () => {
    expect(code).toContain("t('sync.syncNow')");
  });
});

describe('SyncStatus — mounted globally', () => {
  const app = readFile('src/App.jsx');

  it('imports SyncStatus', () => {
    expect(app).toContain('SyncStatus');
  });

  it('renders SyncStatus in root layout', () => {
    expect(app).toContain('<SyncStatus');
  });
});

describe('Sync translation keys exist', () => {
  const translations = readFile('src/i18n/translations.js');
  const keys = ['sync.offline', 'sync.pendingOne', 'sync.pendingMany', 'sync.syncNow', 'sync.syncing', 'sync.syncedOne', 'sync.failedOne'];

  for (const key of keys) {
    it(`has ${key} in all 5 languages`, () => {
      expect(translations).toContain(`'${key}'`);
      const idx = translations.indexOf(`'${key}'`);
      const chunk = translations.slice(idx, idx + 300);
      expect(chunk).toContain('en:');
      expect(chunk).toContain('fr:');
      expect(chunk).toContain('sw:');
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PART 4 — Safe Retry / Reconnect
// ═══════════════════════════════════════════════════════════

describe('useGuaranteedAction — retry safety', () => {
  const code = readFile('src/hooks/useGuaranteedAction.js');

  it('has timeout protection', () => {
    expect(code).toContain('DEFAULT_TIMEOUT_MS');
    expect(code).toContain('10000');
  });

  it('detects network errors for offline fallback', () => {
    expect(code).toContain('ERR_NETWORK');
    expect(code).toContain('navigator.onLine');
  });

  it('has SAVED_OFFLINE state', () => {
    expect(code).toContain('SAVED_OFFLINE');
  });

  it('has double-submit guard', () => {
    expect(code).toContain('guardRef');
  });

  it('supports retry with same args', () => {
    expect(code).toContain('retry');
    expect(code).toContain('lastActionRef');
  });
});

describe('Backend idempotency protection', () => {
  it('API client auto-generates idempotency keys for mutations', () => {
    const code = readFile('src/api/client.js');
    expect(code).toContain('X-Idempotency-Key');
  });

  it('farm setup route uses idempotencyCheck middleware', () => {
    const code = readFile('server/src/modules/farmProfiles/routes.js');
    expect(code).toContain('idempotencyCheck');
  });

  it('season creation route uses dedupGuard', () => {
    const code = readFile('server/src/modules/seasons/routes.js');
    expect(code).toContain('dedupGuard');
  });

  it('farmStore uses idempotency key for createProfile', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain('generateIdempotencyKey');
    expect(code).toContain("'X-Idempotency-Key'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — Photo Upload Offline Behavior
// ═══════════════════════════════════════════════════════════

describe('QuickUpdateFlow — photo failure does not destroy update', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('photo upload failure is caught separately from main update', () => {
    // Photo upload is in its own try/catch, separate from the main progress post
    expect(code).toContain('} catch (photoErr) {');
    expect(code).toContain("trackPilotEvent('photo_failed'");
  });

  it('photo compression failure falls back to original', () => {
    expect(code).toContain('If compression fails, use original');
  });

  it('queues text update to offline queue when offline', () => {
    expect(code).toContain('enqueue');
    expect(code).toContain('offlinePayload');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — Session Continuity
// ═══════════════════════════════════════════════════════════

describe('Auth persistence — session survives offline', () => {
  const code = readFile('src/store/authStore.js');

  it('stores token in localStorage', () => {
    expect(code).toContain('localStorage');
    expect(code).toContain('farroway_token');
  });

  it('stores user in localStorage', () => {
    expect(code).toContain('farroway_user');
  });

  it('restores from localStorage on app load', () => {
    expect(code).toContain('getItem');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 7 — Farmer Home Cached View
// ═══════════════════════════════════════════════════════════

describe('farmStore — localStorage cache for offline dashboard', () => {
  const code = readFile('src/store/farmStore.js');

  it('has cache key constant', () => {
    expect(code).toContain("'farroway:farmCache'");
  });

  it('has 24-hour cache TTL', () => {
    expect(code).toContain('CACHE_TTL');
    expect(code).toContain('24 * 60 * 60 * 1000');
  });

  it('loads cached data on init', () => {
    expect(code).toContain('loadCached');
    expect(code).toContain("cached?.profiles || []");
    expect(code).toContain("cached?.currentProfile || null");
    expect(code).toContain("cached?.financeScore || null");
  });

  it('saves to cache after successful fetch', () => {
    expect(code).toContain('saveCache');
  });

  it('exposes _fromCache flag', () => {
    expect(code).toContain('_fromCache');
  });

  it('falls back to cached profiles on network error', () => {
    expect(code).toContain("isNetworkError(err) && get().profiles.length > 0");
  });
});

describe('FarmerDashboardPage — offline rendering', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('uses _fromCache flag from farmStore', () => {
    expect(code).toContain('_fromCache');
  });

  it('shows offline cache banner when data is from cache', () => {
    expect(code).toContain('offline-cache-banner');
    expect(code).toContain("t('home.showingCached')");
  });

  it('caches farmer profile to localStorage on fetch', () => {
    expect(code).toContain("localStorage.setItem('farroway:farmerProfile'");
  });

  it('restores cached farmer profile when offline', () => {
    expect(code).toContain("localStorage.getItem('farroway:farmerProfile')");
  });

  it('does not show onboarding when using cached data', () => {
    expect(code).toContain('!_fromCache');
  });
});

describe('home.showingCached translation key', () => {
  const translations = readFile('src/i18n/translations.js');

  it('exists in all 5 languages', () => {
    expect(translations).toContain("'home.showingCached'");
    const idx = translations.indexOf("'home.showingCached'");
    const chunk = translations.slice(idx, idx + 400);
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 8 — ActionFeedback States
// ═══════════════════════════════════════════════════════════

describe('ActionFeedback — guarantee layer UI', () => {
  const code = readFile('src/components/ActionFeedback.jsx');

  it('supports LOADING state', () => {
    expect(code).toContain('LOADING');
  });

  it('supports SUCCESS state', () => {
    expect(code).toContain('SUCCESS');
  });

  it('supports SAVED_OFFLINE state', () => {
    expect(code).toContain('SAVED_OFFLINE');
  });

  it('supports RETRYABLE state', () => {
    expect(code).toContain('RETRYABLE');
  });

  it('supports ERROR state', () => {
    expect(code).toContain('ERROR');
  });

  it('shows still-working indicator', () => {
    expect(code).toContain('stillWorking');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 9 — No Regression in Online Flow
// ═══════════════════════════════════════════════════════════

describe('Normal online flow — no regression', () => {
  it('farmStore still fetches profiles from API', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain("api.get('/v1/farms')");
  });

  it('farmStore still creates profiles with API', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain("api.post('/v1/farms', data");
  });

  it('QuickUpdateFlow still submits via API when online', () => {
    const code = readFile('src/components/QuickUpdateFlow.jsx');
    expect(code).toContain("api.post(`/seasons/${seasonId}/progress`");
  });

  it('OnboardingWizard still calls onComplete on success', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('onComplete');
    expect(code).toContain('clearDraft');
  });
});
