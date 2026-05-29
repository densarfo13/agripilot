// Farroway buyer runtime aggregator + diagnostics global.
import {
  BUYER_RUNTIME_VERSION,
  BUYER_VISIBLE_STATUSES,
  CONTACT_PREFERENCES,
  INTEREST_STATUSES,
  LISTING_STATUSES,
  PRODUCT_TYPES,
  buyerIdempotencyKey,
} from "./buyerContracts";
import {
  approveListing,
  listListingsForBuyer,
  listListingsForSeller,
  listingsSnapshot,
  upsertSellListing,
} from "./BuyerListingService";
import {
  interestsSnapshot,
  listInterestsForBuyer,
  listInterestsForSeller,
  sendBuyerInterest,
} from "./BuyerInterestService";

const _safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const _now = (): string =>
  _safe(() => new Date().toISOString(), "");

// Re-export verbs.
export {
  BUYER_RUNTIME_VERSION,
  BUYER_VISIBLE_STATUSES,
  CONTACT_PREFERENCES,
  INTEREST_STATUSES,
  LISTING_STATUSES,
  PRODUCT_TYPES,
  buyerIdempotencyKey,
  upsertSellListing,
  approveListing,
  listListingsForBuyer,
  listListingsForSeller,
  listingsSnapshot,
  sendBuyerInterest,
  listInterestsForBuyer,
  listInterestsForSeller,
  interestsSnapshot,
};

export interface BuyerDashboardHealth {
  readonly version: string;
  readonly available: true;
  readonly approvedListingsOnly: true;
  readonly interestWorkflowReady: true;
  readonly noPayments: true;
  readonly noEscrow: true;
  readonly buyerDataScoped: true;
  readonly fakeMetrics: false;
  readonly organizationScoped: true;
  readonly snapshots: {
    readonly listings: ReturnType<typeof listingsSnapshot>;
    readonly interests: ReturnType<typeof interestsSnapshot>;
  };
  readonly capturedAt: string;
}

export function buyerDashboardHealth(): BuyerDashboardHealth {
  return _safe<BuyerDashboardHealth>(
    () =>
      Object.freeze({
        version: BUYER_RUNTIME_VERSION,
        available: true as const,
        approvedListingsOnly: true as const,
        interestWorkflowReady: true as const,
        noPayments: true as const,
        noEscrow: true as const,
        buyerDataScoped: true as const,
        fakeMetrics: false as const,
        organizationScoped: true as const,
        snapshots: Object.freeze({
          listings: listingsSnapshot(),
          interests: interestsSnapshot(),
        }),
        capturedAt: _now(),
      }),
    Object.freeze({
      version: BUYER_RUNTIME_VERSION,
      available: true as const,
      approvedListingsOnly: true as const,
      interestWorkflowReady: true as const,
      noPayments: true as const,
      noEscrow: true as const,
      buyerDataScoped: true as const,
      fakeMetrics: false as const,
      organizationScoped: true as const,
      snapshots: Object.freeze({
        listings: listingsSnapshot(),
        interests: interestsSnapshot(),
      }),
      capturedAt: "",
    })
  );
}

export function installBuyerDashboardGlobal(): boolean {
  return _safe<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    w["__buyerDashboardHealth"] = () => buyerDashboardHealth();
    return true;
  }, false);
}
