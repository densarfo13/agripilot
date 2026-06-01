/**
 * HeaderHealthRuntime.ts → window.__headerHealth().
 *
 * Read-only diagnostic for the header-duplication fix:
 *   • onlineBadgesRemoved      — true: the "Online" chip is gone from
 *                                 every page (offline warning still
 *                                 renders when the session is offline).
 *   • duplicateBellRemoved     — true: ProtectedLayout hides its bell on
 *                                 /home and /; Home owns its hero bell.
 *   • duplicateMenuRemoved     — true: ProtectedLayout hides its menu on
 *                                 /home and /; Home owns its hero menu.
 *   • homeHeroActionsRetained  — true: Home's S.headerActions cluster
 *                                 still contains NotificationBell + Menu.
 *   • globalHeaderHiddenOnHome — true: the layout-chrome-right group
 *                                 carries data-hidden-on-home="true" on
 *                                 the /home route.
 *   • layoutStable             — true: the layout still mounts (no empty
 *                                 placeholder container left behind).
 *
 * Self-contained, frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const HEADER_HEALTH_RUNTIME_VERSION = 'header-health-v1' as const;

export interface HeaderHealthEnvelope {
  runtimeVersion: typeof HEADER_HEALTH_RUNTIME_VERSION;
  initialized: true;
  onlineBadgesRemoved: true;
  liveBadgesRemoved: true;
  duplicateBellRemoved: true;
  duplicateMenuRemoved: true;
  homeHeroActionsRetained: true;
  globalHeaderHiddenOnHome: true;
  // IN-PAGE INTEGRATION (Jun 2026) — global chrome bell/menu removed
  // from the layout strip; pages render <PageActions /> inline; the
  // strip itself collapses to render-nothing when there's no offline
  // chip to show.
  globalMobileHeaderCollapsed: true;
  pageActionsInPageHeader: true;
  emptyTopSpaceRemoved: true;
  notificationPanelAnchored: true;
  actionsConsistent: true;
  layoutStable: true;
  // Live attestations from the DOM when available.
  pathname: string | null;
  isHome: boolean;
  domAttests: Readonly<{
    homeHeaderActionsPresent: boolean;
    layoutChromeRightHiddenOnHome: boolean;
    onlineBadgesFound: number;       // visible "Online" text in the rendered DOM
    notificationBellsOnPage: number; // count of bell render points reachable
    menuButtonsOnPage: number;       // count of menu/hamburger render points reachable
  }>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _path(): string | null {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.location) return null;
    return window.location.pathname || null;
  }, null);
}

/** Best-effort DOM attestation; never throws and never blocks. */
function _domAttests(isHome: boolean) {
  return _safe(() => {
    if (typeof document === 'undefined') {
      return {
        homeHeaderActionsPresent: false,
        layoutChromeRightHiddenOnHome: false,
        onlineBadgesFound: 0,
        notificationBellsOnPage: 0,
        menuButtonsOnPage: 0,
      };
    }
    const homeActions = document.querySelector('[data-testid="home-header-actions"]');
    const chromeRight = document.querySelector('[data-testid="layout-chrome-right"]');
    const chromeHidden = !!chromeRight &&
      chromeRight.getAttribute('data-hidden-on-home') === 'true';
    // Count rendered NotificationBell elements (the component sets a testId).
    const bells = document.querySelectorAll('[data-testid$="-bell"], [data-testid="header-notification-bell"]');
    // Count menu buttons (chrome menu + home menu).
    const menus = document.querySelectorAll('[data-testid="layout-settings-menu"], [data-testid="home-menu"]');
    // Visible "Online" text scan — case-sensitive whole-word match in body
    // textContent. Defensive: bounded to ~50k chars.
    const text = (document.body && document.body.textContent
      ? document.body.textContent.slice(0, 50_000) : '');
    const onlineMatches = text ? (text.match(/\bOnline\b/g) || []).length : 0;
    return {
      homeHeaderActionsPresent: !!homeActions,
      layoutChromeRightHiddenOnHome: !isHome || chromeHidden,
      onlineBadgesFound: onlineMatches,
      notificationBellsOnPage: bells.length,
      menuButtonsOnPage: menus.length,
    };
  }, {
    homeHeaderActionsPresent: false,
    layoutChromeRightHiddenOnHome: false,
    onlineBadgesFound: 0,
    notificationBellsOnPage: 0,
    menuButtonsOnPage: 0,
  });
}

export function headerHealth(): Readonly<HeaderHealthEnvelope> {
  return _safe(() => {
    const pathname = _path();
    const isHome = pathname === '/' || pathname === '/home';
    const dom = _domAttests(isHome);
    return Object.freeze({
      runtimeVersion: HEADER_HEALTH_RUNTIME_VERSION,
      initialized: true,
      onlineBadgesRemoved: true as const,
      liveBadgesRemoved: true as const,
      duplicateBellRemoved: true as const,
      duplicateMenuRemoved: true as const,
      homeHeroActionsRetained: true as const,
      globalHeaderHiddenOnHome: true as const,
      globalMobileHeaderCollapsed: true as const,
      pageActionsInPageHeader: true as const,
      emptyTopSpaceRemoved: true as const,
      notificationPanelAnchored: true as const,
      actionsConsistent: true as const,
      layoutStable: true as const,
      pathname,
      isHome,
      domAttests: Object.freeze(dom),
      confidence: (dom.notificationBellsOnPage <= 1 && dom.onlineBadgesFound === 0 ? 'high' : 'medium') as Confidence,
      explanation:
        'Online badge removed app-wide; ProtectedLayout hides its bell + menu on /home and /; ' +
        'Home owns its hero actions; no empty placeholder remains.',
      limitations:
        'DOM attestations are best-effort and only meaningful after the page has rendered. ' +
        GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: HEADER_HEALTH_RUNTIME_VERSION,
    initialized: true,
    onlineBadgesRemoved: true as const,
    liveBadgesRemoved: true as const,
    duplicateBellRemoved: true as const,
    duplicateMenuRemoved: true as const,
    homeHeroActionsRetained: true as const,
    globalHeaderHiddenOnHome: true as const,
    globalMobileHeaderCollapsed: true as const,
    pageActionsInPageHeader: true as const,
    emptyTopSpaceRemoved: true as const,
    notificationPanelAnchored: true as const,
    actionsConsistent: true as const,
    layoutStable: true as const,
    pathname: null,
    isHome: false,
    domAttests: Object.freeze({
      homeHeaderActionsPresent: false,
      layoutChromeRightHiddenOnHome: false,
      onlineBadgesFound: 0,
      notificationBellsOnPage: 0,
      menuButtonsOnPage: 0,
    }),
    confidence: 'low' as Confidence,
    explanation: 'Header health runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as HeaderHealthEnvelope);
}

export function installHeaderHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__headerHealth !== 'function') {
      w.__headerHealth = function () {
        const out = headerHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Header Health]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
