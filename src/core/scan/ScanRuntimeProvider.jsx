/**
 * ScanRuntimeProvider.jsx — React context that lets ONE
 * ScanRuntime instance be shared across multiple Scan UI
 * components without each component owning a private one.
 *
 *   import {
 *     ScanRuntimeProvider, useSharedScanRuntime,
 *   } from 'src/core/scan/ScanRuntimeProvider.jsx';
 *
 *   <ScanRuntimeProvider activeFarm={farm} locale={lang} classifier={fn}>
 *     <ScanCapturePreview />
 *     <ScanResultPanel />
 *     <ScanRetryButton />
 *   </ScanRuntimeProvider>
 *
 *   // Each child reads:
 *   const rt = useSharedScanRuntime();
 *
 * What this is
 * ────────────
 *   The provider mounts ONE runtime via `useScanRuntime`, exposes
 *   it through React Context, and auto-registers it with the
 *   diagnostic globals. Child components are PURE subscribers —
 *   they read `rt.state` / `rt.preview` / `rt.result` and call
 *   `rt.choosePhoto(...)` / `rt.analyzeImage()` etc.
 *
 *   `useSharedScanRuntime()` falls back to a fresh per-component
 *   runtime when no provider is mounted — incremental adoption
 *   never breaks a screen.
 *
 * Strict-rule audit
 *   • SSR-safe (Context render-tree only; the hook gates on window).
 *   • Never throws — child components degrade to a no-op snapshot
 *     if the provider is missing.
 */

import React, { createContext, useContext } from 'react';

import {
  useScanRuntime, SCAN_STATE,
} from '../../hooks/useScanRuntime.js';

const ScanRuntimeContext = createContext(null);

/**
 * The provider. All props are passed through to `useScanRuntime`.
 *
 *   @prop {object}   activeFarm
 *   @prop {string}   locale
 *   @prop {Function} classifier
 *   @prop {Function} onTelemetry
 *   @prop {boolean}  autoRegisterDiagnostic
 */
export function ScanRuntimeProvider(props) {
  const cfg = props || {};
  const rt = useScanRuntime({
    activeFarm:             cfg.activeFarm,
    locale:                 cfg.locale,
    classifier:             cfg.classifier,
    onTelemetry:            cfg.onTelemetry,
    autoRegisterDiagnostic: cfg.autoRegisterDiagnostic !== false,
  });

  return (
    <ScanRuntimeContext.Provider value={rt}>
      {props && props.children}
    </ScanRuntimeContext.Provider>
  );
}

/**
 * Read the shared ScanRuntime from context, or fall back to a
 * fresh per-component runtime when no provider is mounted. The
 * fallback is the SAME canonical authority — it just won't be
 * shared with sibling components.
 *
 * Important: the fallback runtime is created on FIRST CALL of
 * the hook in the rendering subtree. To avoid that, mount the
 * provider near the top of the Scan flow.
 */
export function useSharedScanRuntime(fallbackCfg) {
  const ctx = useContext(ScanRuntimeContext);
  // Hooks must be called unconditionally — call useScanRuntime
  // here too, so the hook order is stable whether the provider
  // is present or not. We only RETURN the fallback when ctx is
  // null.
  const fallback = useScanRuntime({
    activeFarm:             fallbackCfg && fallbackCfg.activeFarm,
    locale:                 fallbackCfg && fallbackCfg.locale,
    classifier:             fallbackCfg && fallbackCfg.classifier,
    onTelemetry:            fallbackCfg && fallbackCfg.onTelemetry,
    autoRegisterDiagnostic:
      fallbackCfg && fallbackCfg.autoRegisterDiagnostic === true,
  });
  return ctx || fallback;
}

export { SCAN_STATE };

const _module = { ScanRuntimeProvider, useSharedScanRuntime, SCAN_STATE };
export default _module;
