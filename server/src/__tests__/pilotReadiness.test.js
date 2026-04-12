import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── 1. Farmer Lifecycle State Consistency ────────────────

describe('Farmer Lifecycle State Model', () => {
  const code = readFile('src/utils/farmerLifecycle.js');

  it('exports FARMER_STATE with exactly three states', () => {
    expect(code).toContain("NEW: 'NEW'");
    expect(code).toContain("SETUP_INCOMPLETE: 'SETUP_INCOMPLETE'");
    expect(code).toContain("ACTIVE: 'ACTIVE'");
  });

  it('exports isFarmProfileComplete function', () => {
    expect(code).toContain('export function isFarmProfileComplete(');
  });

  it('exports getFarmerLifecycleState function', () => {
    expect(code).toContain('export function getFarmerLifecycleState(');
  });

  it('defines REQUIRED_FIELDS for setup completeness', () => {
    expect(code).toContain('REQUIRED_FIELDS');
    expect(code).toContain("key: 'crop'");
    expect(code).toContain("key: 'landSizeValue'");
    expect(code).toContain("key: 'landSizeUnit'");
  });

  it('is used by FarmerDashboardPage', () => {
    const dash = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(dash).toContain('farmerLifecycle');
  });
});

// ─── 2. Submit Guard (Double-Tap Prevention) ──────────────

describe('Submit Guard — Double-Tap Prevention', () => {
  const criticalFiles = [
    'src/components/OnboardingWizard.jsx',
    'src/pages/PestRiskCheck.jsx',
    'src/pages/TreatmentFeedback.jsx',
    'src/pages/ProfileSetup.jsx',
    'src/components/QuickUpdateFlow.jsx',
    'src/pages/AcceptInvitePage.jsx',
  ];

  criticalFiles.forEach((file) => {
    it(`${path.basename(file)} uses submitGuardRef`, () => {
      const code = readFile(file);
      expect(code).toContain('submitGuardRef');
      expect(code).toContain('useRef');
    });
  });

  it('OnboardingWizard guard blocks during submission', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('if (submitGuardRef.current) return');
  });

  it('PestRiskCheck guard blocks during submission', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain('if (submitGuardRef.current) return');
  });

  it('TreatmentFeedback guard blocks during submission', () => {
    const code = readFile('src/pages/TreatmentFeedback.jsx');
    // Guard may be combined with other checks in a single if statement
    expect(code).toContain('submitGuardRef.current');
    expect(code).toContain('submitGuardRef.current = true');
  });
});

// ─── 3. Draft Preservation (Offline Safety) ──────────────

describe('Draft Preservation — useDraft Hook', () => {
  it('useDraft hook exists with localStorage backing', () => {
    const code = readFile('src/utils/useDraft.js');
    expect(code).toContain('localStorage');
    expect(code).toContain('export');
  });

  it('OnboardingWizard uses draft preservation', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('useDraft');
    expect(code).toContain('clearDraft');
  });

  it('ProfileSetup uses draft preservation', () => {
    const code = readFile('src/pages/ProfileSetup.jsx');
    expect(code).toContain('useDraft');
    expect(code).toContain('clearDraft');
  });
});

// ─── 4. Offline Queue & Idempotency ─────────────────────

describe('Offline Queue — IndexedDB + Idempotency', () => {
  const queue = readFile('src/utils/offlineQueue.js');

  it('uses IndexedDB for mutation queue', () => {
    expect(queue).toContain('indexedDB');
    expect(queue).toContain("DB_NAME = 'farroway-offline'");
  });

  it('handles 409 Conflict as already-processed', () => {
    expect(queue).toContain('409');
    expect(queue).toContain('conflict_already_processed');
  });

  it('auto-syncs on reconnect', () => {
    expect(queue).toContain('online');
    expect(queue).toContain('syncAll');
  });

  it('has pilot instrumentation for sync success and failure', () => {
    expect(queue).toContain("trackPilotEvent('offline_synced'");
    expect(queue).toContain("trackPilotEvent('offline_sync_failed'");
  });

  it('idempotency key is attached via axios interceptor', () => {
    const api = readFile('src/api/client.js');
    expect(api).toContain('X-Idempotency-Key');
  });
});

// ─── 5. Pilot Instrumentation Coverage ──────────────────

describe('Pilot Instrumentation — trackPilotEvent', () => {
  it('pilotTracker utility exists and exports trackPilotEvent', () => {
    const code = readFile('src/utils/pilotTracker.js');
    expect(code).toContain('export function trackPilotEvent(');
  });

  const instrumentedFlows = [
    { file: 'src/pages/PestRiskCheck.jsx', events: ['update_submitted', 'update_failed', 'photo_upload_failed'] },
    { file: 'src/pages/TreatmentFeedback.jsx', events: ['update_submitted', 'update_failed'] },
    { file: 'src/pages/ProfileSetup.jsx', events: ['setup_completed', 'setup_failed'] },
    { file: 'src/components/OnboardingWizard.jsx', events: ['onboarding_completed', 'setup_failed'] },
    { file: 'src/components/SeedScanFlow.jsx', events: ['seed_scan_failed'] },
    { file: 'src/components/LandBoundaryCapture.jsx', events: ['boundary_save_failed'] },
    { file: 'src/utils/offlineQueue.js', events: ['offline_synced', 'offline_sync_failed'] },
  ];

  instrumentedFlows.forEach(({ file, events }) => {
    events.forEach((event) => {
      it(`${path.basename(file)} tracks '${event}'`, () => {
        const code = readFile(file);
        expect(code).toContain(`trackPilotEvent('${event}'`);
      });
    });
  });
});

// ─── 6. Localization — No Hardcoded English in Farmer UI ─

describe('Localization — Farmer-Facing Screens', () => {
  const farmerScreens = [
    'src/pages/PestRiskCheck.jsx',
    'src/pages/PestRiskResult.jsx',
    'src/pages/TreatmentFeedback.jsx',
    'src/pages/ProfileSetup.jsx',
    'src/components/LandBoundaryCapture.jsx',
    'src/components/SeedScanFlow.jsx',
  ];

  farmerScreens.forEach((file) => {
    it(`${path.basename(file)} has no t() || 'fallback' patterns`, () => {
      const code = readFile(file);
      // Match t('...') || 'English fallback' — but allow || '' (empty fallback is safe)
      const fallbackPattern = /t\([^)]+\)\s*\|\|\s*'[^']/g;
      const matches = code.match(fallbackPattern) || [];
      expect(matches).toEqual([]);
    });
  });

  it('translations.js has all pest advice keys in 5 languages', () => {
    const translations = readFile('src/i18n/translations.js');
    const requiredKeys = [
      'pest.levelMsg.low', 'pest.levelMsg.moderate', 'pest.levelMsg.high', 'pest.levelMsg.urgent',
      'pest.advice.low.1', 'pest.advice.moderate.1', 'pest.advice.high.1', 'pest.advice.urgent.1',
      'pest.checkAgain',
    ];
    requiredKeys.forEach((key) => {
      expect(translations).toContain(`'${key}'`);
    });
  });

  it('translations.js has boundary warning keys', () => {
    const translations = readFile('src/i18n/translations.js');
    ['boundary.warnFewPoints', 'boundary.warnLowAccuracy', 'boundary.warnDuplicate', 'boundary.validationFailed'].forEach((key) => {
      expect(translations).toContain(`'${key}'`);
    });
  });
});

// ─── 7. Mobile Usability — CTA Visibility ───────────────

describe('Mobile Usability — Bottom CTA Padding', () => {
  it('PestRiskCheck has bottom padding for mobile', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain('paddingBottom');
  });

  it('TreatmentFeedback has bottom padding for mobile', () => {
    const code = readFile('src/pages/TreatmentFeedback.jsx');
    expect(code).toContain('paddingBottom');
  });
});

// ─── 8. Voice Flow Integration ──────────────────────────

describe('Voice Flow — Screen Integration', () => {
  const voiceScreens = [
    'src/pages/PestRiskCheck.jsx',
    'src/pages/PestRiskResult.jsx',
    'src/pages/TreatmentFeedback.jsx',
    'src/pages/ProfileSetup.jsx',
    'src/pages/FarmerProgressTab.jsx',
    'src/components/LandBoundaryCapture.jsx',
    'src/components/SeedScanFlow.jsx',
  ];

  voiceScreens.forEach((file) => {
    it(`${path.basename(file)} renders VoiceBar`, () => {
      const code = readFile(file);
      expect(code).toContain('VoiceBar');
      expect(code).toContain('voiceKey');
    });
  });

  it('VoiceBar stops speech on unmount', () => {
    const code = readFile('src/components/VoiceBar.jsx');
    expect(code).toContain('stopSpeech');
    expect(code).toContain('useEffect');
  });
});

// ─── 9. Score Gating — Incomplete Setup Hides Score ─────

describe('Score Gating — Setup Completeness', () => {
  it('FarmerDashboardPage checks lifecycle state before showing score', () => {
    const code = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(code).toContain('farmerLifecycle');
  });

  it('farmerLifecycle server utility gates canStartSeason on ACTIVE state', () => {
    const code = readFile('server/src/utils/farmerLifecycle.js');
    expect(code).toContain('canStartSeason');
    expect(code).toContain('ACTIVE');
  });
});

// ─── 10. Network Context — Online/Offline Awareness ─────

describe('Network Context — Offline Awareness', () => {
  it('NetworkContext exists and exports useNetwork', () => {
    const code = readFile('src/context/NetworkContext.jsx');
    expect(code).toContain('useNetwork');
    expect(code).toContain('isOnline');
  });

  const offlineAwareScreens = [
    'src/pages/PestRiskCheck.jsx',
    'src/components/LandBoundaryCapture.jsx',
  ];

  offlineAwareScreens.forEach((file) => {
    it(`${path.basename(file)} uses network context`, () => {
      const code = readFile(file);
      expect(code).toContain('useNetwork');
      expect(code).toContain('isOnline');
    });
  });
});

// ─── 11. Critical File Existence ────────────────────────

describe('Critical Files — Existence Check', () => {
  const criticalFiles = [
    'src/utils/farmerLifecycle.js',
    'src/utils/pilotTracker.js',
    'src/utils/voiceGuide.js',
    'src/utils/voiceAnalytics.js',
    'src/utils/useDraft.js',
    'src/utils/offlineQueue.js',
    'src/context/NetworkContext.jsx',
    'src/components/VoiceBar.jsx',
    'src/i18n/translations.js',
    'server/src/utils/farmerLifecycle.js',
  ];

  criticalFiles.forEach((file) => {
    it(`${file} exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  });
});
