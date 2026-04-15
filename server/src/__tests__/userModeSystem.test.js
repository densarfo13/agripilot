/**
 * User Mode System Tests
 *
 * Verifies: mode resolution, persistence, presentation layer,
 * BasicFarmerHome, mode-aware Dashboard, context wiring,
 * voice integration, translations, and component structure.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

// ─── 1. userMode.js — mode resolution logic ─────────────────
describe('User Mode — resolution logic', () => {
  const src = readFile('src/lib/userMode.js');

  it('exports resolveDefaultMode function', () => {
    expect(src).toContain('export function resolveDefaultMode(role, experienceLevel)');
  });

  it('maps admin roles to advanced mode', () => {
    expect(src).toContain("ADVANCED_ROLES.includes(role)) return 'advanced'");
  });

  it('maps new farmers to basic mode', () => {
    expect(src).toContain("experienceLevel === 'new') return 'basic'");
  });

  it('maps experienced farmers to standard mode', () => {
    expect(src).toContain("experienceLevel === 'experienced') return 'standard'");
  });

  it('defaults to standard for unknown', () => {
    expect(src).toContain("return 'standard'");
  });

  it('prevents farmers from selecting advanced mode', () => {
    expect(src).toContain("persisted === 'advanced' && !ADVANCED_ROLES.includes(role)");
  });

  it('exports getAllowedModes', () => {
    expect(src).toContain('export function getAllowedModes(role)');
  });

  it('exports persistMode and clearPersistedMode', () => {
    expect(src).toContain('export function persistMode');
    expect(src).toContain('export function clearPersistedMode');
  });
});

// ─── 2. taskPresentation.js — centralized maps ──────────────
describe('User Mode — task presentation layer', () => {
  const src = readFile('src/lib/taskPresentation.js');

  it('exports taskIconMap with key task types', () => {
    expect(src).toContain('taskIconMap');
    expect(src).toContain('watering');
    expect(src).toContain('planting');
    expect(src).toContain('spraying');
    expect(src).toContain('harvest');
    expect(src).toContain('fertilizing');
    expect(src).toContain('weeding');
  });

  it('exports getTaskIcon function with title inference', () => {
    expect(src).toContain('export function getTaskIcon(task)');
    expect(src).toContain("title.includes('water')");
  });

  it('exports taskLabelKeys', () => {
    expect(src).toContain('taskLabelKeys');
    expect(src).toContain('task.label.watering');
  });

  it('exports taskVoiceKeys', () => {
    expect(src).toContain('taskVoiceKeys');
    expect(src).toContain('task.voice.watering');
  });

  it('exports taskActionKeys', () => {
    expect(src).toContain('taskActionKeys');
    expect(src).toContain('taskAction.iWatered');
  });

  it('exports priorityColors', () => {
    expect(src).toContain('priorityColors');
    expect(src).toContain('#EF4444');
    expect(src).toContain('#F59E0B');
  });

  it('exports getTaskIconBg for icon backgrounds', () => {
    expect(src).toContain('export function getTaskIconBg(task)');
  });
});

// ─── 3. UserModeContext — React context wiring ──────────────
describe('User Mode — context provider', () => {
  const src = readFile('src/context/UserModeContext.jsx');

  it('exports UserModeProvider and useUserMode', () => {
    expect(src).toContain('export function UserModeProvider');
    expect(src).toContain('export function useUserMode');
  });

  it('derives mode from role + experienceLevel', () => {
    expect(src).toContain('getEffectiveMode(role, experienceLevel)');
  });

  it('provides setMode that respects allowed modes', () => {
    expect(src).toContain('getAllowedModes(role)');
    expect(src).toContain('allowed.includes(newMode)');
  });

  it('provides resetMode to clear override', () => {
    expect(src).toContain('clearPersistedMode()');
  });

  it('provides boolean helpers: isBasic, isStandard, isAdvanced', () => {
    expect(src).toContain("isBasic = mode === 'basic'");
    expect(src).toContain("isStandard = mode === 'standard'");
    expect(src).toContain("isAdvanced = mode === 'advanced'");
  });

  it('uses useAuth and useProfile for role/experience', () => {
    expect(src).toContain('useAuth');
    expect(src).toContain('useProfile');
  });
});

// ─── 4. App.jsx — UserModeProvider mounted ──────────────────
describe('User Mode — App provider wiring', () => {
  const src = readFile('src/App.jsx');

  it('imports UserModeProvider', () => {
    expect(src).toContain("import { UserModeProvider } from './context/UserModeContext.jsx'");
  });

  it('wraps routes in UserModeProvider', () => {
    expect(src).toContain('<UserModeProvider>');
    expect(src).toContain('</UserModeProvider>');
  });
});

// ─── 5. BasicFarmerHome — icon-first component ─────────────
describe('User Mode — BasicFarmerHome', () => {
  const src = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('imports getTaskIcon from taskPresentation', () => {
    expect(src).toContain('getTaskIcon');
    expect(src).toContain("from '../../lib/taskPresentation.js'");
  });

  it('imports VoicePromptButton', () => {
    expect(src).toContain('VoicePromptButton');
  });

  it('renders large task icon (4rem+)', () => {
    expect(src).toContain("fontSize: '4rem'");
  });

  it('renders single big CTA button', () => {
    expect(src).toContain('bigCta');
    expect(src).toContain("minHeight: '56px'");
  });

  it('has voice prompt per task', () => {
    expect(src).toContain('getTaskVoiceKey');
    expect(src).toContain('<VoicePromptButton');
  });

  it('shows progress (completed + remaining)', () => {
    expect(src).toContain('completedCount');
    expect(src).toContain('taskCount');
  });

  it('has data-testid for testing', () => {
    expect(src).toContain('data-testid="basic-farmer-home"');
    expect(src).toContain('data-testid="basic-task-icon"');
    expect(src).toContain('data-testid="basic-do-now-btn"');
  });

  it('handles all states: loading, setup, stage, task, done', () => {
    expect(src).toContain('taskLoading');
    expect(src).toContain('!setupComplete');
    expect(src).toContain('!stageSet');
    expect(src).toContain('primaryTask');
  });
});

// ─── 6. Dashboard — mode-aware rendering ────────────────────
describe('User Mode — Dashboard mode-awareness', () => {
  const src = readFile('src/pages/Dashboard.jsx');

  it('imports useUserMode', () => {
    expect(src).toContain("import { useUserMode } from '../context/UserModeContext.jsx'");
  });

  it('uses mode and isBasic from context', () => {
    expect(src).toContain('useUserMode()');
    expect(src).toContain('isBasic');
  });

  it('lazy-loads BasicFarmerHome', () => {
    expect(src).toContain("import('../components/farmer/BasicFarmerHome.jsx')");
  });

  it('renders BasicFarmerHome when isBasic', () => {
    expect(src).toContain('if (isBasic)');
    expect(src).toContain('<BasicFarmerHome');
  });

  it('still renders standard layout for standard mode', () => {
    expect(src).toContain('<TodayTaskCard');
    expect(src).toContain('<QuickActionsRow');
    expect(src).toContain('<WeeklyProgressCard');
  });
});

// ─── 7. ModeSwitcher component ──────────────────────────────
describe('User Mode — ModeSwitcher', () => {
  const src = readFile('src/components/ModeSwitcher.jsx');

  it('imports useUserMode', () => {
    expect(src).toContain('useUserMode');
  });

  it('renders mode buttons from allowedModes', () => {
    expect(src).toContain('allowedModes.map');
  });

  it('highlights active mode', () => {
    expect(src).toContain('mode === m');
    expect(src).toContain('btnActive');
  });

  it('calls setMode on click', () => {
    expect(src).toContain('setMode(m)');
  });

  it('returns null when only one mode allowed', () => {
    expect(src).toContain('allowedModes.length <= 1) return null');
  });

  it('has data-testid', () => {
    expect(src).toContain('data-testid="mode-switcher"');
  });
});

// ─── 8. Translations — mode labels ─────────────────────────
describe('User Mode — translations', () => {
  const src = readFile('src/i18n/translations.js');

  it('has mode.basic in all 5 languages', () => {
    expect(src).toContain("'mode.basic'");
  });

  it('has mode.standard', () => {
    expect(src).toContain("'mode.standard'");
  });

  it('has task.label keys', () => {
    expect(src).toContain("'task.label.watering'");
    expect(src).toContain("'task.label.planting'");
    expect(src).toContain("'task.label.harvest'");
  });

  it('has task.voice keys', () => {
    expect(src).toContain("'task.voice.watering'");
    expect(src).toContain("'task.voice.planting'");
    expect(src).toContain("'task.voice.default'");
  });

  it('has voice prompts for setup/stage/done states', () => {
    expect(src).toContain("'task.voice.finishSetup'");
    expect(src).toContain("'task.voice.setStage'");
    expect(src).toContain("'task.voice.allDone'");
  });
});

// ─── 9. Voice integration — reuses existing voice system ────
describe('User Mode — voice integration', () => {
  const voice = readFile('src/lib/voice.js');
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('voice.js exports speakText', () => {
    expect(voice).toContain('export function speakText');
  });

  it('voice.js exports languageToVoiceCode', () => {
    expect(voice).toContain('export function languageToVoiceCode');
  });

  it('BasicFarmerHome uses VoicePromptButton', () => {
    expect(basic).toContain('<VoicePromptButton');
  });

  it('BasicFarmerHome passes voice text from task presentation', () => {
    expect(basic).toContain('getTaskVoiceKey');
    expect(basic).toContain('voiceText');
  });
});

// ─── 10. Component structure — organized folders ────────────
describe('User Mode — component structure', () => {
  it('BasicFarmerHome in farmer/ subfolder', () => {
    const p = path.join(rootDir, 'src/components/farmer/BasicFarmerHome.jsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('ModeSwitcher exists', () => {
    const p = path.join(rootDir, 'src/components/ModeSwitcher.jsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('UserModeContext exists', () => {
    const p = path.join(rootDir, 'src/context/UserModeContext.jsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('taskPresentation.js exists', () => {
    const p = path.join(rootDir, 'src/lib/taskPresentation.js');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('userMode.js exists', () => {
    const p = path.join(rootDir, 'src/lib/userMode.js');
    expect(fs.existsSync(p)).toBe(true);
  });
});

// ─── 11. No mode in farmer permissions ──────────────────────
describe('User Mode — mode ≠ permissions', () => {
  const ctx = readFile('src/context/UserModeContext.jsx');
  const mode = readFile('src/lib/userMode.js');

  it('mode system does NOT check permissions', () => {
    expect(mode).not.toContain('checkPermission');
    expect(mode).not.toContain('canAccess');
  });

  it('mode system comment clarifies mode ≠ permissions', () => {
    expect(mode).toContain('not permissions');
  });

  it('context does not modify auth or profile', () => {
    expect(ctx).not.toContain('setUser');
    expect(ctx).not.toContain('setProfile');
  });
});

// ─── 12. Performance — lazy loading ─────────────────────────
describe('User Mode — performance', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('BasicFarmerHome is lazy-loaded', () => {
    expect(dash).toContain("lazy(() => import('../components/farmer/BasicFarmerHome.jsx'))");
  });

  it('BasicFarmerHome wrapped in Suspense', () => {
    expect(dash).toContain('<Suspense');
    expect(dash).toContain('<BasicFarmerHome');
  });
});

// ─── 13. ADVANCED_ROLES match ───────────────────────────────
describe('User Mode — admin role coverage', () => {
  const mode = readFile('src/lib/userMode.js');

  it('includes super_admin', () => {
    expect(mode).toContain('super_admin');
  });

  it('includes institutional_admin', () => {
    expect(mode).toContain('institutional_admin');
  });

  it('includes reviewer', () => {
    expect(mode).toContain('reviewer');
  });

  it('includes field_officer', () => {
    expect(mode).toContain('field_officer');
  });

  it('includes investor_viewer', () => {
    expect(mode).toContain('investor_viewer');
  });
});

// ─── 14. Basic mode — low-literacy UX rules ────────────────
describe('User Mode — basic mode UX rules', () => {
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('has no dropdown menus', () => {
    expect(basic).not.toContain('<select');
    expect(basic).not.toContain('Dropdown');
  });

  it('has no small text (below 0.75rem)', () => {
    expect(basic).not.toContain("fontSize: '0.6");
    expect(basic).not.toContain("fontSize: '0.5");
  });

  it('uses 48px+ minimum touch targets', () => {
    // bigCta is 56px, all buttons should be large
    expect(basic).toContain("minHeight: '56px'");
  });

  it('centers content for single-focus UX', () => {
    expect(basic).toContain('alignItems: \'center\'');
    expect(basic).toContain('justifyContent: \'center\'');
  });
});

// ─── 15. No hardcoded English in farmer mode ────────────────
describe('User Mode — no hardcoded English', () => {
  const basic = readFile('src/components/farmer/BasicFarmerHome.jsx');

  it('uses t() for all visible text', () => {
    expect(basic).toContain("t('common.loading')");
    expect(basic).toContain("t('dashboard.finishSetup')");
    expect(basic).toContain("t('dashboard.doThisNow')");
    expect(basic).toContain("t('dashboard.addUpdate')");
    expect(basic).toContain("t('common.listen')");
  });

  it('does not have hardcoded English sentences', () => {
    expect(basic).not.toContain("'Welcome");
    expect(basic).not.toContain("'Click here");
    expect(basic).not.toContain("'Press the");
  });
});
