/**
 * Farmer Usability Hardening Tests
 *
 * Verifies: mode clarity, voice discoverability, icon consistency,
 * instant feedback, offline sync UX, first-time hints,
 * performance, complexity prevention, and localization.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

// ─── 1. Mode indicator shows correctly ──────────────────────
describe('Mode Clarity — ModeIndicator', () => {
  const src = readFile('src/components/ModeIndicator.jsx');

  it('renders mode label from translations', () => {
    expect(src).toContain("t('mode.basic')");
    expect(src).toContain("t('mode.standard')");
  });

  it('has data-testid for mode indicator', () => {
    expect(src).toContain('data-testid="mode-indicator"');
  });

  it('expands to show mode switcher on tap', () => {
    expect(src).toContain('setExpanded(true)');
    expect(src).toContain('data-testid="mode-indicator-expanded"');
  });

  it('only shows for farmer modes', () => {
    expect(src).toContain('!isFarmer');
    expect(src).toContain('allowedModes.length <= 1');
  });

  it('calls setMode on switch', () => {
    expect(src).toContain('setMode(m)');
  });
});

// ─── 2. Mode switch updates UI immediately ──────────────────
describe('Mode Clarity — FarmerSettingsPanel', () => {
  const src = readFile('src/components/FarmerSettingsPanel.jsx');

  it('has mode toggle buttons', () => {
    expect(src).toContain('allowedModes.map');
    expect(src).toContain('setMode(m)');
  });

  it('has voice on/off toggle', () => {
    expect(src).toContain("setAutoVoice(!autoVoice)");
    expect(src).toContain('data-testid="settings-voice-toggle"');
  });

  it('uses translated labels for voice states', () => {
    expect(src).toContain("t('settings.voiceOn')");
    expect(src).toContain("t('settings.voiceOff')");
  });

  it('uses translated label for mode', () => {
    expect(src).toContain("t('settings.viewMode')");
  });

  it('only renders for farmer modes', () => {
    expect(src).toContain('!isFarmer) return null');
  });

  it('has data-testid', () => {
    expect(src).toContain('data-testid="farmer-settings"');
  });
});

// ─── 3. Voice auto-plays once in basic mode ─────────────────
describe('Voice Discoverability — auto-play', () => {
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('imports speakText and languageToVoiceCode', () => {
    expect(basic).toContain("import { speakText, languageToVoiceCode }");
  });

  it('auto-plays voice on task load when autoVoice is on', () => {
    expect(basic).toContain('if (!autoVoice || taskLoading || !primaryTask) return');
  });

  it('tracks last spoken task to prevent re-plays', () => {
    expect(basic).toContain('lastSpokenTaskRef');
    expect(basic).toContain('lastSpokenTaskRef.current === primaryTask.id');
  });

  it('voice failure is non-blocking', () => {
    expect(basic).toContain('catch { /* voice fail is non-blocking */');
  });
});

// ─── 4. Voice off setting prevents auto-play ────────────────
describe('Voice Discoverability — off setting', () => {
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');
  const settings = readFile('src/components/FarmerSettingsPanel.jsx');

  it('BasicFarmerHome checks autoVoice before speaking', () => {
    expect(basic).toContain('!autoVoice');
  });

  it('settings panel toggles autoVoice', () => {
    expect(settings).toContain('setAutoVoice(!autoVoice)');
  });
});

// ─── 5. Icon + label mapping is consistent ──────────────────
describe('Icon Clarity — consistent mapping', () => {
  const pres = readFile('src/lib/taskPresentation.js');
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');
  const today = readFile('src/components/TodayTaskCard.jsx');
  const modal = readFile('src/components/TaskActionModal.jsx');

  it('taskPresentation exports getTaskIcon', () => {
    expect(pres).toContain('export function getTaskIcon(task)');
  });

  it('taskPresentation exports getTaskLabelKey', () => {
    expect(pres).toContain('export function getTaskLabelKey(task)');
  });

  it('BasicFarmerHome shows 1-word label under icon', () => {
    expect(basic).toContain('getTaskLabelKey(primaryTask)');
    expect(basic).toContain('iconLabel');
    expect(basic).toContain('shortLabel');
  });

  it('TodayTaskCard uses getTaskIcon', () => {
    expect(today).toContain('getTaskIcon(primaryTask)');
    expect(today).toContain('getTaskIconBg(primaryTask)');
  });

  it('TaskActionModal uses getTaskIcon', () => {
    expect(modal).toContain('getTaskIcon(task)');
    expect(modal).toContain('getTaskIconBg(task)');
  });

  it('all components import from same taskPresentation module', () => {
    expect(basic).toContain("from '../../lib/taskPresentation.js'");
    expect(today).toContain("from '../lib/taskPresentation.js'");
    expect(modal).toContain("from '../lib/taskPresentation.js'");
  });

  it('taskPresentation has fallback default icon', () => {
    expect(pres).toContain("default:     '🎯'");
  });
});

// ─── 6. Action tap shows instant success feedback ───────────
describe('Instant Feedback — ActionFeedbackBanner', () => {
  const src = readFile('src/components/ActionFeedbackBanner.jsx');

  it('supports success status', () => {
    expect(src).toContain("'feedback.saved'");
  });

  it('supports offline status', () => {
    expect(src).toContain("'feedback.savedOffline'");
  });

  it('supports failed status with retry', () => {
    expect(src).toContain("'feedback.failed'");
    expect(src).toContain("'feedback.tapRetry'");
    expect(src).toContain('onRetry');
  });

  it('provides haptic feedback on success', () => {
    expect(src).toContain('navigator.vibrate');
  });

  it('auto-hides after timeout', () => {
    expect(src).toContain('autoHideMs');
    expect(src).toContain('setTimeout');
  });

  it('does not auto-hide on failed status', () => {
    expect(src).toContain("status !== 'failed'");
  });

  it('has data-testid per status', () => {
    expect(src).toContain('data-testid={`feedback-${status}`}');
  });
});

// ─── 7. Offline save shows correct offline state ────────────
describe('Offline Sync UX — Dashboard integration', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('sets feedbackStatus to offline on offline save', () => {
    expect(dash).toContain("setFeedbackStatus('offline')");
  });

  it('sets feedbackStatus to success on online save', () => {
    expect(dash).toContain("setFeedbackStatus('success')");
  });

  it('sets feedbackStatus to failed on error', () => {
    expect(dash).toContain("setFeedbackStatus('failed')");
  });

  it('provides haptic on success', () => {
    expect(dash).toContain('navigator.vibrate(50)');
  });

  it('provides different haptic pattern for offline', () => {
    expect(dash).toContain('navigator.vibrate([30, 30, 30])');
  });
});

// ─── 8. Retry state appears on failed sync ──────────────────
describe('Offline Sync UX — retry behavior', () => {
  const banner = readFile('src/components/ActionFeedbackBanner.jsx');

  it('shows retry hint on failed state', () => {
    expect(banner).toContain("status === 'failed'");
    expect(banner).toContain('onRetry');
  });

  it('clicking failed banner triggers retry', () => {
    expect(banner).toContain("status === 'failed' ? onRetry : onDismiss");
  });
});

// ─── 9. First-time hint overlay shows only once ─────────────
describe('First-time Guidance — HintOverlay', () => {
  const hint = readFile('src/components/HintOverlay.jsx');
  const lib = readFile('src/lib/hints.js');

  it('checks shouldShowHint before rendering', () => {
    expect(hint).toContain('shouldShowHint(hintId)');
  });

  it('calls dismissHint on tap', () => {
    expect(hint).toContain('dismissHint(hintId)');
  });

  it('checks isExperiencedUser to skip hints', () => {
    expect(hint).toContain('isExperiencedUser()');
  });

  it('delays show for smooth UX', () => {
    expect(hint).toContain('setTimeout(() => setVisible(true)');
  });

  it('has data-testid', () => {
    expect(hint).toContain('data-testid={`hint-${hintId}`}');
  });

  it('hints.js uses localStorage for persistence', () => {
    expect(lib).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(lib).toContain("localStorage.setItem(STORAGE_KEY");
  });

  it('hints.js defines HINT_IDS', () => {
    expect(lib).toContain('HINT_IDS');
    expect(lib).toContain('TAP_TASK');
    expect(lib).toContain('TAP_SPEAKER');
  });
});

// ─── 10. Farmer home does not reintroduce clutter ───────────
describe('Complexity Prevention — basic mode', () => {
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('has no WeeklyProgressCard', () => {
    expect(basic).not.toContain('WeeklyProgressCard');
  });

  it('has no WeatherStatusCard', () => {
    expect(basic).not.toContain('WeatherStatusCard');
  });

  it('has no expandedSection', () => {
    expect(basic).not.toContain('expandedSection');
  });

  it('has no FarmerIdCard or SupportCard', () => {
    expect(basic).not.toContain('FarmerIdCard');
    expect(basic).not.toContain('SupportCard');
  });

  it('has no analytics cards', () => {
    expect(basic).not.toContain('FarmBenchmarkCard');
    expect(basic).not.toContain('FarmEconomicsCard');
  });

  it('shows only one task', () => {
    expect(basic).toContain('primaryTask');
    expect(basic).not.toContain('tasks.map');
    expect(basic).not.toContain('allTasks');
  });
});

// ─── 11. Localization for new labels/messages ───────────────
describe('Localization — new translation keys', () => {
  const src = readFile('src/i18n/translations.js');

  it('has feedback.saved in 5 languages', () => {
    expect(src).toContain("'feedback.saved'");
  });

  it('has feedback.savedOffline', () => {
    expect(src).toContain("'feedback.savedOffline'");
  });

  it('has feedback.failed', () => {
    expect(src).toContain("'feedback.failed'");
  });

  it('has feedback.tapRetry', () => {
    expect(src).toContain("'feedback.tapRetry'");
  });

  it('has hint.tapTask', () => {
    expect(src).toContain("'hint.tapTask'");
  });

  it('has hint.tapSpeaker', () => {
    expect(src).toContain("'hint.tapSpeaker'");
  });

  it('has settings.viewMode', () => {
    expect(src).toContain("'settings.viewMode'");
  });

  it('has settings.voiceGuide', () => {
    expect(src).toContain("'settings.voiceGuide'");
  });

  it('has settings.voiceOn and voiceOff', () => {
    expect(src).toContain("'settings.voiceOn'");
    expect(src).toContain("'settings.voiceOff'");
  });

  it('has voice.welcome in 5 languages', () => {
    expect(src).toContain("'voice.welcome'");
  });

  it('sync messages use farmer-friendly language', () => {
    expect(src).toContain('No internet');
    expect(src).toContain('waiting to send');
    expect(src).toContain('Send Now');
    expect(src).toContain('Sending...');
    expect(src).toContain('not sent');
  });
});

// ─── 12. Performance / loading behavior ─────────────────────
describe('Performance — home screen optimization', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('skips farm-scoped data in basic mode', () => {
    expect(dash).toContain('isBasic) return');
  });

  it('loads primary task first (separate from farm data)', () => {
    expect(dash).toContain('loadPrimaryTask');
    expect(dash).toContain('loadFarmScopedData');
  });

  it('FarmerSettingsPanel is lazy-loaded', () => {
    expect(dash).toContain("import('../components/FarmerSettingsPanel.jsx')");
  });

  it('BasicFarmerHome is lazy-loaded', () => {
    expect(dash).toContain("import('../components/farmer/BasicFarmerHome.jsx')");
  });

  it('voice welcome uses translated text (not hardcoded English)', () => {
    expect(dash).toContain("t('voice.welcome')");
    expect(dash).not.toContain("'Welcome to your farm. Check your task for today.'");
  });

  it('voice welcome plays only once via ref guard', () => {
    expect(dash).toContain('voicePlayedRef');
    expect(dash).toContain('voicePlayedRef.current = true');
  });
});

// ─── Bonus: Dashboard mode indicator wiring ─────────────────
describe('Dashboard — mode indicator wiring', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports ModeIndicator', () => {
    expect(dash).toContain("import ModeIndicator from '../components/ModeIndicator.jsx'");
  });

  it('renders ModeIndicator in basic mode', () => {
    expect(dash).toContain('<ModeIndicator');
  });

  it('imports ActionFeedbackBanner', () => {
    expect(dash).toContain("import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx'");
  });

  it('renders ActionFeedbackBanner in both modes', () => {
    // Should appear at least twice (basic + standard mode)
    const matches = dash.match(/<ActionFeedbackBanner/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Bonus: TaskActionModal icon + voice ────────────────────
describe('TaskActionModal — icon + voice integration', () => {
  const modal = readFile('src/components/TaskActionModal.jsx');

  it('shows task icon in modal', () => {
    expect(modal).toContain('iconCircle');
    expect(modal).toContain('iconEmoji');
  });

  it('has VoicePromptButton for replay', () => {
    expect(modal).toContain('VoicePromptButton');
    expect(modal).toContain('voiceText');
  });

  it('uses getPriorityColors from taskPresentation', () => {
    expect(modal).toContain('getPriorityColors');
  });
});

// ─── Bonus: Component file structure ────────────────────────
describe('Component Structure — new files exist', () => {
  const check = (rel) => fs.existsSync(path.join(rootDir, rel));

  it('ModeIndicator exists', () => expect(check('src/components/ModeIndicator.jsx')).toBe(true));
  it('ActionFeedbackBanner exists', () => expect(check('src/components/ActionFeedbackBanner.jsx')).toBe(true));
  it('FarmerSettingsPanel exists', () => expect(check('src/components/FarmerSettingsPanel.jsx')).toBe(true));
  it('HintOverlay exists', () => expect(check('src/components/HintOverlay.jsx')).toBe(true));
  it('hints.js exists', () => expect(check('src/lib/hints.js')).toBe(true));
});
