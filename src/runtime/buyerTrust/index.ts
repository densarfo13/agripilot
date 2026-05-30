/**
 * src/runtime/buyerTrust/index.ts — Buyer Trust Signals barrel.
 *
 *   import {
 *     getTrustSignals,
 *     buyerTrustHealth,
 *     installBuyerTrustGlobal,
 *     BUYER_TRUST_RUNTIME_VERSION,
 *     BUYER_TRUST_BADGE,
 *     ACTIVE_GROWER_WINDOW_DAYS,
 *     type TrustSignal, type TrustBadge,
 *   } from 'src/runtime/buyerTrust';
 *
 *   installBuyerTrustGlobal();   // pins window.__buyerTrustHealth
 *
 * What this is
 * ────────────
 *   One-stop import surface for the v1 Buyer Trust Signals
 *   runtime. Re-exports the contracts module + the runtime's
 *   public functions. No engine logic lives in this file —
 *   pure composition.
 *
 * Strict-rule audit
 *   • Pure re-export module. No side effects at import time.
 *   • SSR-safe — the runtime it re-exports is SSR-safe.
 *   • The single window global (__buyerTrustHealth) is pinned
 *     only when the host app calls installBuyerTrustGlobal()
 *     (typically from src/App.jsx alongside the other launch
 *     diagnostic installs).
 */

export {
  BUYER_TRUST_RUNTIME_VERSION,
  BUYER_TRUST_BADGE,
  TRUST_STORAGE_KEYS,
  ACTIVE_GROWER_WINDOW_DAYS,
  type TrustSignal,
  type TrustBadge,
} from './buyerTrustContracts';

export {
  getTrustSignals,
  buyerTrustHealth,
  installBuyerTrustGlobal,
} from './BuyerTrustRuntime';
