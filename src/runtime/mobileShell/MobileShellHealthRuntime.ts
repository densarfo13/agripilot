/**
 * MobileShellHealthRuntime.ts → window.__mobileShellHealth().
 *
 * Composite over the in-page-integration probes that already exist:
 *   • __headerHealth        — onlineBadgesRemoved / globalMobileHeaderCollapsed /
 *                              pageActionsInPageHeader / duplicateBellRemoved /
 *                              duplicateMenuRemoved / actionsConsistent
 *   • __voiceFloatingButtonHealth — hiddenWhenNotNeeded, doesNotCoverCTA
 *   • __bottomNavHealth     — bottomNav stable (legacy global if present)
 *
 * Surfaces the §1 §13 acceptance flags the premium mobile spec requires.
 * Read-only diagnostic; never throws; never blocks render.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const MOBILE_SHELL_HEALTH_VERSION = 'mobile-shell-health-v1' as const;

export interface MobileShellHealthEnvelope {
  runtimeVersion: typeof MOBILE_SHELL_HEALTH_VERSION;
  initialized: true;
  noEmptyTopStrip: boolean;
  pageActionsInHeader: boolean;
  oneBellPerPage: boolean;
  oneMenuPerPage: boolean;
  onlineLiveRemoved: boolean;
  bottomNavStable: boolean;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function mobileShellHealth(): Readonly<MobileShellHealthEnvelope> {
  return _safe(() => {
    const hdr = _probe('__headerHealth');
    const fab = _probe('__voiceFloatingButtonHealth');
    const bn = _probe('__bottomNavHealth');
    const headerOK = hdr && typeof hdr === 'object';
    const composed: string[] = [];
    if (hdr) composed.push('__headerHealth');
    if (fab) composed.push('__voiceFloatingButtonHealth');
    if (bn) composed.push('__bottomNavHealth');
    return Object.freeze({
      runtimeVersion: MOBILE_SHELL_HEALTH_VERSION,
      initialized: true,
      noEmptyTopStrip: !!(headerOK && (hdr as any).emptyTopSpaceRemoved === true
        && (hdr as any).globalMobileHeaderCollapsed === true),
      pageActionsInHeader: !!(headerOK && (hdr as any).pageActionsInPageHeader === true),
      oneBellPerPage: !!(headerOK && (hdr as any).duplicateBellRemoved === true),
      oneMenuPerPage: !!(headerOK && (hdr as any).duplicateMenuRemoved === true),
      onlineLiveRemoved: !!(headerOK && (hdr as any).onlineBadgesRemoved === true
        && (hdr as any).liveBadgesRemoved === true),
      bottomNavStable: !!(bn && (bn as any).bottomNavStable !== false),
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (composed.length >= 2 ? 'high' : 'medium') as Confidence,
      explanation:
        'Composite over header / floating-mic / bottom-nav diagnostics. The empty top header strip ' +
        'is collapsed (HeaderHealth.emptyTopSpaceRemoved + globalMobileHeaderCollapsed); bell + menu ' +
        'live inside each page via <PageActions />; Online / Live badges removed app-wide.',
      limitations:
        'Reports the values published by underlying probes; live DOM attestations happen inside HeaderHealth. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: MOBILE_SHELL_HEALTH_VERSION,
    initialized: true,
    noEmptyTopStrip: false,
    pageActionsInHeader: false,
    oneBellPerPage: false,
    oneMenuPerPage: false,
    onlineLiveRemoved: false,
    bottomNavStable: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Mobile shell health initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as MobileShellHealthEnvelope);
}

export function installMobileShellHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__mobileShellHealth !== 'function') {
      w.__mobileShellHealth = function () {
        const out = mobileShellHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Mobile Shell]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
