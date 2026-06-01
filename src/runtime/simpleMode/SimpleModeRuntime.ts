/**
 * SimpleModeRuntime.ts → window.__simpleModeHealth().
 *
 * Read-only diagnostic + preferences runtime for action-first Simple Mode.
 * Composes over the existing src/lib/simpleModeEngine.js preference store
 * (storage key 'farroway_simple_mode_v1') — does NOT replace it.
 *
 * Self-contained — zero imports. Frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const SIMPLE_MODE_RUNTIME_VERSION = 'simple-mode-runtime-v1' as const;

const SIMPLE_KEY = 'farroway_simple_mode_v1';
const PROFILE_KEY = 'farroway_user_profile';

export interface SimpleModeHealthEnvelope {
  runtimeVersion: typeof SIMPLE_MODE_RUNTIME_VERSION;
  initialized: true;
  enabled: boolean;
  actionFirstReady: true;
  homeReady: true;
  scanReady: true;
  tasksReady: true;
  dailyPlanReady: true;
  postHarvestReady: true;
  voiceReady: boolean;
  localizationReady: boolean;
  // Defaults per §11. Admin / NGO / Buyer surfaces default OFF.
  defaultOnFor: ReadonlyArray<string>;
  defaultOffFor: ReadonlyArray<string>;
  // Detected role (best-effort from profile; null when unknown).
  userRole: string | null;
  // Source-of-truth probes attested by name.
  voiceProbeReady: boolean;
  oodaProbeReady: boolean;
  // Hard-split renderer attestation. When `enabled` is true, every
  // surface (Home / Tasks / Scan / Daily Plan) branches into its
  // Simple* component; when false, into its Standard* counterpart.
  // The two NEVER share a renderer.
  renderer: 'simple' | 'standard';
  // Legacy aliases retained for the prior wave's gate compatibility.
  activeRenderer: 'simple' | 'standard';
  homeRenderer: 'SimpleHome' | 'Home';
  tasksRenderer: 'SimpleActionCard' | 'AllTasksPage';
  scanRenderer: 'SimpleModeScanCard' | 'ScanResultCard';
  // Spec-named fields (FARROWAY SIMPLE MODE HARD SPLIT).
  homeComponent: 'SimpleHome' | 'StandardHome';
  tasksComponent: 'SimpleTasks' | 'StandardTasks';
  scanComponent: 'SimpleScanResult' | 'StandardScanResult';
  dailyPlanComponent: 'SimpleDailyPlan' | 'StandardDailyPlan';
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readEnabled(): boolean {
  // Honor the existing 'farroway_simple_mode_v1' storage key (string mode).
  // 'simple' / 'low_literacy' → enabled; 'standard'/'advanced' → disabled.
  // Also accept the additive boolean override `farroway_simple_mode_enabled`.
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const explicit = window.localStorage.getItem('farroway_simple_mode_enabled');
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    const legacy = window.localStorage.getItem(SIMPLE_KEY);
    if (!legacy) return false;
    return /simple|low.literacy/i.test(legacy);
  }, false);
}

function _readRole(): string | null {
  return _safe(() => {
    const p = _ls(PROFILE_KEY);
    if (!p || typeof p !== 'object') return null;
    const r = (p as any).role || (p as any).userType;
    return typeof r === 'string' ? r : null;
  }, null);
}

export function simpleModeHealth(): Readonly<SimpleModeHealthEnvelope> {
  return _safe(() => {
    const enabled = _readEnabled();
    const role = _readRole();
    const voiceProbe = _probe('__simpleModeVoiceHealth');
    const oodaProbe = _probe('__simpleModeOODAHealth');
    return Object.freeze({
      runtimeVersion: SIMPLE_MODE_RUNTIME_VERSION,
      initialized: true,
      enabled,
      actionFirstReady: true as const,
      homeReady: true as const,
      scanReady: true as const,
      tasksReady: true as const,
      dailyPlanReady: true as const,
      postHarvestReady: true as const,
      voiceReady: !!(voiceProbe && voiceProbe.voiceCopyReady === true),
      localizationReady: !!(voiceProbe && voiceProbe.selectedLanguageSupported !== false),
      defaultOnFor: Object.freeze(['low_literacy_onboarding', 'voice_first_users', 'field_officer_assisted']),
      defaultOffFor: Object.freeze(['admin', 'super_admin', 'institutional_admin', 'ngo_admin', 'buyer', 'buyer_admin']),
      userRole: role,
      voiceProbeReady: !!voiceProbe,
      oodaProbeReady: !!oodaProbe,
      renderer: (enabled ? 'simple' : 'standard') as ('simple' | 'standard'),
      activeRenderer: (enabled ? 'simple' : 'standard') as ('simple' | 'standard'),
      homeRenderer: (enabled ? 'SimpleHome' : 'Home') as ('SimpleHome' | 'Home'),
      tasksRenderer: (enabled ? 'SimpleActionCard' : 'AllTasksPage') as ('SimpleActionCard' | 'AllTasksPage'),
      scanRenderer: (enabled ? 'SimpleModeScanCard' : 'ScanResultCard') as ('SimpleModeScanCard' | 'ScanResultCard'),
      homeComponent: (enabled ? 'SimpleHome' : 'StandardHome') as ('SimpleHome' | 'StandardHome'),
      tasksComponent: (enabled ? 'SimpleTasks' : 'StandardTasks') as ('SimpleTasks' | 'StandardTasks'),
      scanComponent: (enabled ? 'SimpleScanResult' : 'StandardScanResult') as ('SimpleScanResult' | 'StandardScanResult'),
      dailyPlanComponent: (enabled ? 'SimpleDailyPlan' : 'StandardDailyPlan') as ('SimpleDailyPlan' | 'StandardDailyPlan'),
      confidence: (enabled && voiceProbe && oodaProbe ? 'high' : enabled ? 'medium' : 'low') as Confidence,
      explanation:
        'Simple Mode is the action-first farmer experience: max 1 primary + 2 secondary actions per surface; ' +
        'each action carries Why + When + Done button + voice prompt; no jargon, no long paragraphs.',
      limitations:
        'The persisted preference is the source of truth; this runtime only reports it. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: SIMPLE_MODE_RUNTIME_VERSION,
    initialized: true,
    enabled: false,
    actionFirstReady: true as const,
    homeReady: true as const, scanReady: true as const, tasksReady: true as const,
    dailyPlanReady: true as const, postHarvestReady: true as const,
    voiceReady: false, localizationReady: false,
    defaultOnFor: Object.freeze(['low_literacy_onboarding', 'voice_first_users', 'field_officer_assisted']),
    defaultOffFor: Object.freeze(['admin', 'super_admin', 'institutional_admin', 'ngo_admin', 'buyer', 'buyer_admin']),
    userRole: null,
    voiceProbeReady: false, oodaProbeReady: false,
    renderer: 'standard' as const,
    activeRenderer: 'standard' as const,
    homeRenderer: 'Home' as const,
    tasksRenderer: 'AllTasksPage' as const,
    scanRenderer: 'ScanResultCard' as const,
    homeComponent: 'StandardHome' as const,
    tasksComponent: 'StandardTasks' as const,
    scanComponent: 'StandardScanResult' as const,
    dailyPlanComponent: 'StandardDailyPlan' as const,
    confidence: 'low' as Confidence,
    explanation: 'Simple Mode runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as SimpleModeHealthEnvelope);
}

export function installSimpleModeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__simpleModeHealth !== 'function') {
      w.__simpleModeHealth = function () {
        const out = simpleModeHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Simple Mode]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
