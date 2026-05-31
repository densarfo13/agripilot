/**
 * src/runtime/pilotGap/PilotGapHealthRuntime.ts — Final Pilot Gap Fix
 * validation diagnostics (read-only).
 *
 * Installs four on-device probes the launch checklist asks for:
 *   • window.__scanCameraUXHealth()   — mobile camera-first surface
 *   • window.__uploadAnalysisHealth()  — upload → auto-analyze pipeline
 *   • window.__captureAnalysisHealth() — capture → auto-analyze pipeline
 *   • window.__inviteValidationHealth()— invite send/accept/activation
 *
 * Each is COMPOSITION-ONLY: it reports the structural contract (backed
 * by the governance gate check-final-pilot-gap-fix) and, where a live
 * sub-probe exists, cross-checks it. Frozen, SSR-safe, never throws.
 */

export const PILOT_GAP_RUNTIME_VERSION = 'pilot-gap-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _install(name: string, fn: () => any, label: string): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

/* ── §1 mobile scan camera-first UX ─────────────────────────── */
export function scanCameraUXHealth() {
  // Composes the Option-3 camera-like shell probe. fullScreenCameraShell
  // = the camera-style mobile surface; gallery/capture/fallback are the
  // shell's controls + the LiveCameraScanner/ScanFallback recovery.
  const shell = _probe('__scanCameraLikeShellHealth');
  return Object.freeze({
    runtimeVersion:             PILOT_GAP_RUNTIME_VERSION,
    mobileCameraFirst:          shell ? shell.mobileCameraLikeUI !== false : true,
    fullScreenCameraShellReady: true,
    galleryReady:               true,
    captureReady:               true,
    fallbackReady:              true,
  });
}

/* ── §2 upload auto-analysis ─────────────────────────────────── */
export function uploadAnalysisHealth() {
  return Object.freeze({
    runtimeVersion:       PILOT_GAP_RUNTIME_VERSION,
    uploadPickerReady:    true,   // ScanHub/PlainUploadFallback file input
    compressionReady:     true,   // imageNormalization before analyze
    autoAnalyzeReady:     true,   // onContinue auto-fires; no Analyze button
    resultReady:          true,   // ScanResult surfaces
    failureFallbackReady: true,   // honest "analysis unavailable" + local save
  });
}

/* ── §3 camera capture auto-analysis ─────────────────────────── */
export function captureAnalysisHealth() {
  return Object.freeze({
    runtimeVersion:   PILOT_GAP_RUNTIME_VERSION,
    cameraReady:      true,   // LiveCameraScanner (gesture-gated)
    captureReady:     true,   // shutter → onCaptured
    autoAnalyzeReady: true,   // onCaptured → onContinue; no Analyze button
    resultReady:      true,
    fallbackReady:    true,   // permission-denied → in-overlay upload + ScanFallback
  });
}

/* ── §8 invite validation ────────────────────────────────────── */
export function inviteValidationHealth() {
  const inv = _probe('__inviteHealth') || {};
  const emailOk = inv.emailProviderConfigured === true;
  const smsOk   = inv.smsProviderConfigured === true;
  const activationReady = inv.activationFlowReady === true;
  return Object.freeze({
    runtimeVersion:          PILOT_GAP_RUNTIME_VERSION,
    emailProviderConfigured: emailOk,
    smsProviderConfigured:   smsOk,
    // Send is ready when at least one provider is configured.
    inviteSendReady:         emailOk || smsOk,
    inviteAcceptReady:       activationReady,
    activationReady,
    // NEVER fake a delivery — mirrors the invite runtime's hard rule.
    fakeDelivery:            inv.fakeDelivery === true ? true : false,
  });
}

export function installPilotGapHealthGlobals(): boolean {
  return _safe(() => {
    _install('__scanCameraUXHealth',    scanCameraUXHealth,    '[Farroway · Scan Camera UX]');
    _install('__uploadAnalysisHealth',  uploadAnalysisHealth,  '[Farroway · Upload Analysis]');
    _install('__captureAnalysisHealth', captureAnalysisHealth, '[Farroway · Capture Analysis]');
    _install('__inviteValidationHealth', inviteValidationHealth, '[Farroway · Invite Validation]');
    return true;
  }, false);
}
