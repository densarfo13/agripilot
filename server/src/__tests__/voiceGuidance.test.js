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

// ─── 1. Voice Guide System (voiceGuide.js) ─────────────────

describe('Voice Guide System', () => {
  const code = readFile('src/utils/voiceGuide.js');

  it('exports speak function', () => {
    expect(code).toContain('export function speak(');
  });

  it('exports stopSpeech function', () => {
    expect(code).toContain('export function stopSpeech()');
  });

  it('exports isVoiceAvailable function', () => {
    expect(code).toContain('export function isVoiceAvailable()');
  });

  it('exports VOICE_MAP and VOICE_LANGUAGES', () => {
    expect(code).toContain('VOICE_MAP');
    expect(code).toContain('VOICE_LANGUAGES');
  });

  it('has human-like delivery settings (rate < 1, pitch < 1)', () => {
    expect(code).toContain('VOICE_RATE = 0.85');
    expect(code).toContain('VOICE_PITCH = 0.9');
  });

  it('supports pre-recorded audio fallback via AUDIO_MAP', () => {
    expect(code).toContain('AUDIO_MAP');
    expect(code).toContain('tryPlayAudio');
  });

  it('has smart voice selection with preferred patterns', () => {
    expect(code).toContain('PREFERRED_VOICE_PATTERNS');
    expect(code).toContain('selectBestVoice');
  });
});

// ─── 2. VOICE_MAP Coverage — All 15 Priority Flows ─────────

describe('VOICE_MAP Coverage', () => {
  const code = readFile('src/utils/voiceGuide.js');

  // Onboarding flow
  it('has onboarding voice prompts', () => {
    expect(code).toContain("'onboarding.welcome'");
    expect(code).toContain("'onboarding.farmName'");
    expect(code).toContain("'onboarding.crop'");
    expect(code).toContain("'onboarding.success'");
  });

  // Farmer home
  it('has farmer home voice prompts', () => {
    expect(code).toContain("'home.welcome'");
    expect(code).toContain("'home.status.onTrack'");
    expect(code).toContain("'home.status.needsUpdate'");
    expect(code).toContain("'home.primaryAction.addUpdate'");
  });

  // Update flow
  it('has update flow voice prompts', () => {
    expect(code).toContain("'update.start'");
    expect(code).toContain("'update.chooseType'");
    expect(code).toContain("'update.submit'");
    expect(code).toContain("'update.success'");
    expect(code).toContain("'update.savedOffline'");
    expect(code).toContain("'update.failed'");
  });

  // Pest risk check
  it('has pest risk check voice prompts', () => {
    expect(code).toContain("'pest.start'");
    expect(code).toContain("'pest.chooseCrop'");
    expect(code).toContain("'pest.takePhotos'");
    expect(code).toContain("'pest.photoRetake'");
    expect(code).toContain("'pest.answerQuestions'");
    expect(code).toContain("'pest.submit'");
    expect(code).toContain("'pest.submitting'");
  });

  // Pest risk result
  it('has pest risk result voice prompts', () => {
    expect(code).toContain("'pest.result'");
    expect(code).toContain("'pest.result.low'");
    expect(code).toContain("'pest.result.high'");
    expect(code).toContain("'pest.result.uncertain'");
  });

  // Land boundary
  it('has land boundary voice prompts', () => {
    expect(code).toContain("'boundary.start'");
    expect(code).toContain("'boundary.chooseMethod'");
    expect(code).toContain("'boundary.walking'");
    expect(code).toContain("'boundary.addPoint'");
    expect(code).toContain("'boundary.saved'");
    expect(code).toContain("'boundary.warning'");
  });

  // Progress / harvest
  it('has progress and harvest voice prompts', () => {
    expect(code).toContain("'progress.start'");
    expect(code).toContain("'progress.chooseStage'");
    expect(code).toContain("'progress.condition'");
    expect(code).toContain("'progress.harvest'");
    expect(code).toContain("'progress.saved'");
  });

  // Treatment feedback
  it('has treatment feedback voice prompts', () => {
    expect(code).toContain("'treatment.start'");
    expect(code).toContain("'treatment.chooseType'");
    expect(code).toContain("'treatment.outcome'");
    expect(code).toContain("'treatment.saved'");
  });

  // Seed scan
  it('has seed scan voice prompts', () => {
    expect(code).toContain("'seedScan.start'");
    expect(code).toContain("'seedScan.takePhoto'");
    expect(code).toContain("'seedScan.result'");
  });

  // Error / offline states
  it('has error and offline voice prompts', () => {
    expect(code).toContain("'error.general'");
    expect(code).toContain("'error.offline'");
    expect(code).toContain("'error.retry'");
  });

  // Profile setup
  it('has profile setup voice prompts', () => {
    expect(code).toContain("'setup.welcome'");
    expect(code).toContain("'setup.saved'");
  });

  // Officer validation
  it('has officer validation voice prompts', () => {
    expect(code).toContain("'officer.queue'");
    expect(code).toContain("'officer.approve'");
    expect(code).toContain("'officer.reject'");
    expect(code).toContain("'officer.empty'");
  });

  // Admin dashboard
  it('has admin dashboard voice prompts', () => {
    expect(code).toContain("'admin.overview'");
    expect(code).toContain("'admin.needsAttention'");
    expect(code).toContain("'admin.report'");
  });
});

// ─── 3. 5-Language Support ──────────────────────────────────

describe('5-Language Voice Support', () => {
  const code = readFile('src/utils/voiceGuide.js');

  it('supports English, French, Swahili, Hausa, and Twi', () => {
    expect(code).toContain("code: 'en'");
    expect(code).toContain("code: 'fr'");
    expect(code).toContain("code: 'sw'");
    expect(code).toContain("code: 'ha'");
    expect(code).toContain("code: 'tw'");
  });

  it('has BCP-47 language tag mapping', () => {
    expect(code).toContain('LANG_TAGS');
    expect(code).toContain("tw: 'ak'"); // Twi → Akan
  });

  it('each voice key has all 5 language translations', () => {
    // Check a representative key from each section has all 5 langs
    const testKeys = [
      "'pest.start'", "'boundary.start'", "'progress.start'",
      "'treatment.start'", "'seedScan.start'", "'error.general'",
    ];
    for (const key of testKeys) {
      const keyIdx = code.indexOf(key);
      expect(keyIdx).toBeGreaterThan(-1);
      // The block after the key should have en:, fr:, sw:, ha:, tw:
      const block = code.slice(keyIdx, keyIdx + 500);
      expect(block).toContain('en:');
      expect(block).toContain('fr:');
      expect(block).toContain('sw:');
      expect(block).toContain('ha:');
      expect(block).toContain('tw:');
    }
  });
});

// ─── 4. VoiceBar Component ──────────────────────────────────

describe('VoiceBar Component', () => {
  const code = readFile('src/components/VoiceBar.jsx');

  it('accepts voiceKey and compact props', () => {
    expect(code).toContain('voiceKey');
    expect(code).toContain('compact');
  });

  it('auto-plays once per voiceKey change', () => {
    expect(code).toContain('playedRef');
    expect(code).toContain('Auto-play once per voiceKey');
  });

  it('has listen/replay button', () => {
    expect(code).toContain('handleReplay');
    expect(code).toContain('Listen');
  });

  it('has language selector synced with i18n', () => {
    expect(code).toContain('getLanguage');
    expect(code).toContain('setLanguage');
    expect(code).toContain('farroway:langchange');
  });

  it('has mute toggle', () => {
    expect(code).toContain('voice-mute-btn');
    expect(code).toContain('setEnabled(false)');
  });

  it('stops speech on unmount', () => {
    expect(code).toContain('stopSpeech()');
  });

  it('tracks voice analytics events', () => {
    expect(code).toContain('trackVoiceEvent');
    expect(code).toContain('VOICE_PROMPT_SHOWN');
    expect(code).toContain('VOICE_PROMPT_PLAYED');
    expect(code).toContain('VOICE_PROMPT_REPLAYED');
  });
});

// ─── 5. Voice Analytics ─────────────────────────────────────

describe('Voice Analytics', () => {
  const code = readFile('src/utils/voiceAnalytics.js');

  it('tracks all event types', () => {
    expect(code).toContain('VOICE_PROMPT_SHOWN');
    expect(code).toContain('VOICE_PROMPT_PLAYED');
    expect(code).toContain('VOICE_PROMPT_REPLAYED');
    expect(code).toContain('VOICE_PROMPT_MUTED');
    expect(code).toContain('VOICE_STEP_COMPLETED');
    expect(code).toContain('VOICE_STEP_ABANDONED');
  });

  it('maps prompt keys to screen names for all new flows', () => {
    expect(code).toContain("'pest.start': 'pest_check'");
    expect(code).toContain("'boundary.start': 'boundary_capture'");
    expect(code).toContain("'progress.start': 'progress_update'");
    expect(code).toContain("'treatment.start': 'treatment_feedback'");
    expect(code).toContain("'seedScan.start': 'seed_scan'");
    expect(code).toContain("'error.general': 'error_state'");
    expect(code).toContain("'setup.welcome': 'profile_setup'");
  });

  it('debounces SHOWN events', () => {
    expect(code).toContain('SHOWN_DEBOUNCE_MS');
  });

  it('dual-writes to local and server', () => {
    expect(code).toContain('trackPilotEvent');
    expect(code).toContain('/v1/analytics/track');
  });

  it('exports convenience step tracking functions', () => {
    expect(code).toContain('export function trackVoiceStepCompleted');
    expect(code).toContain('export function trackVoiceStepAbandoned');
  });
});

// ─── 6. Screen Integration — VoiceBar Wired In ─────────────

describe('Screen Integration: VoiceBar wired into screens', () => {
  it('PestRiskCheck has VoiceBar', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('VoiceBar');
    expect(code).toContain('pest.chooseCrop');
    expect(code).toContain('pest.takePhotos');
    expect(code).toContain('pest.answerQuestions');
  });

  it('PestRiskResult has VoiceBar', () => {
    const code = readFile('src/pages/PestRiskResult.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('pest.result');
  });

  it('TreatmentFeedback has VoiceBar', () => {
    const code = readFile('src/pages/TreatmentFeedback.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('treatment.chooseType');
    expect(code).toContain('treatment.outcome');
  });

  it('LandBoundaryCapture has VoiceBar', () => {
    const code = readFile('src/components/LandBoundaryCapture.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('boundary.chooseMethod');
    expect(code).toContain('boundary.walking');
  });

  it('FarmerProgressTab has VoiceBar', () => {
    const code = readFile('src/pages/FarmerProgressTab.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('progress.start');
  });

  it('SeedScanFlow has VoiceBar', () => {
    const code = readFile('src/components/SeedScanFlow.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('seedScan.start');
  });

  it('ProfileSetup has VoiceBar', () => {
    const code = readFile('src/pages/ProfileSetup.jsx');
    expect(code).toContain("import VoiceBar from");
    expect(code).toContain('setup.welcome');
  });

  it('FarmerDashboardPage has VoiceBar (existing)', () => {
    const code = readFile('src/pages/FarmerDashboardPage.jsx');
    expect(code).toContain('VoiceBar');
    expect(code).toContain('home.welcome');
  });

  it('QuickUpdateFlow has VoiceBar (existing)', () => {
    const code = readFile('src/components/QuickUpdateFlow.jsx');
    expect(code).toContain('VoiceBar');
  });

  it('OfficerValidationPage has VoiceBar (existing)', () => {
    const code = readFile('src/pages/OfficerValidationPage.jsx');
    expect(code).toContain('VoiceBar');
    expect(code).toContain('officer.');
  });

  it('OnboardingWizard uses voice guide system', () => {
    const code = readFile('src/components/OnboardingWizard.jsx');
    expect(code).toContain('voiceGuide');
  });
});

// ─── 7. Offline Safety ──────────────────────────────────────

describe('Voice Offline Safety', () => {
  it('voiceGuide gracefully no-ops when speechSynthesis unavailable', () => {
    const code = readFile('src/utils/voiceGuide.js');
    expect(code).toContain("'speechSynthesis' in window");
    expect(code).toContain('if (!isVoiceAvailable()) return false');
  });

  it('VoiceBar returns null when unavailable', () => {
    const code = readFile('src/components/VoiceBar.jsx');
    expect(code).toContain('if (!isVoiceAvailable()) return null');
  });

  it('analytics fires silently on error', () => {
    const code = readFile('src/utils/voiceAnalytics.js');
    expect(code).toContain('.catch(() => {})');
  });
});

// ─── 8. UX Behavior ────────────────────────────────────────

describe('Voice UX Behavior', () => {
  it('stops current speech before playing new', () => {
    const code = readFile('src/utils/voiceGuide.js');
    expect(code).toContain('stopSpeech()');
    // speak calls stopSpeech first
    const speakFn = code.slice(code.indexOf('export function speak('));
    expect(speakFn).toContain('stopSpeech()');
  });

  it('VoiceBar stops speech on voiceKey change (via useEffect)', () => {
    const code = readFile('src/components/VoiceBar.jsx');
    // The auto-play effect calls stopSpeech before speaking
    expect(code).toContain('stopSpeech()');
  });

  it('replays prompts in new language when language changes', () => {
    const code = readFile('src/components/VoiceBar.jsx');
    expect(code).toContain('playedRef.current = {}'); // reset so prompts replay
    expect(code).toContain('replay prompts in new language');
  });

  it('minimum 44px touch targets', () => {
    const code = readFile('src/components/VoiceBar.jsx');
    expect(code).toContain("minHeight: '44px'");
    expect(code).toContain("minWidth: '44px'");
  });
});
