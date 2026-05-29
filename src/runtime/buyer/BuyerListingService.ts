// Farroway buyer-side listing service. In-memory, append-only. SSR-safe.
import {
  BUYER_VISIBLE_STATUSES,
  CONTACT_PREFERENCES,
  LISTING_STATUSES,
  PRODUCT_TYPES,
  type ContactPreference,
  type ListingStatus,
  type ProductType,
  type SellListing,
  buyerIdempotencyKey,
} from "./buyerContracts";

export const BUYER_LISTING_SERVICE_VERSION = "farroway-buyer-runtime-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const _arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const _safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const _now = (): string =>
  _safe(() => new Date().toISOString(), "");

const _listings: SellListing[] = [];
const _byIdempotency = new Map<string, string>();

function _validProductType(v: unknown): ProductType {
  const s = _str(v, "other");
  return (PRODUCT_TYPES as readonly string[]).includes(s)
    ? (s as ProductType)
    : "other";
}

const _DEFAULT_LISTING_STATUS: ListingStatus = LISTING_STATUSES[0];

function _validListingStatus(v: unknown): ListingStatus {
  const s = _str(v, _DEFAULT_LISTING_STATUS);
  return (LISTING_STATUSES as readonly string[]).includes(s)
    ? (s as ListingStatus)
    : _DEFAULT_LISTING_STATUS;
}

function _validContactPref(v: unknown): ContactPreference {
  const s = _str(v, "app");
  return (CONTACT_PREFERENCES as readonly string[]).includes(s)
    ? (s as ContactPreference)
    : "app";
}

export interface UpsertSellListingInput {
  readonly id?: string;
  readonly sellerUserId: string;
  readonly productName: string;
  readonly productType?: ProductType;
  readonly quantity?: number;
  readonly unit?: string;
  readonly region?: string;
  readonly status?: ListingStatus;
  readonly contactPreference?: ContactPreference;
  readonly notes?: string;
}

export function upsertSellListing(
  ctx: UpsertSellListingInput
): SellListing | null {
  return _safe<SellListing | null>(() => {
    if (!_isObj(ctx)) return null;
    const sellerUserId = _str(ctx.sellerUserId);
    const productName = _str(ctx.productName);
    if (!sellerUserId || !productName) return null;

    const idemKey = buyerIdempotencyKey(
      "ready-to-sell",
      sellerUserId,
      productName,
      JSON.stringify({
        q: ctx.quantity ?? 0,
        u: ctx.unit ?? "",
        r: ctx.region ?? "",
      })
    );
    const existingId = _byIdempotency.get(idemKey);
    const targetId = _str(ctx.id) || existingId || `lst_${_now()}_${_listings.length}`;

    const now = _now();
    const prior = _listings.find((l) => l.id === targetId) || null;

    const record: SellListing = Object.freeze({
      id: targetId,
      sellerUserId,
      productName,
      productType: _validProductType(ctx.productType ?? prior?.productType),
      quantity: typeof ctx.quantity === "number" ? ctx.quantity : prior?.quantity ?? 0,
      unit: _str(ctx.unit, prior?.unit ?? ""),
      region: _str(ctx.region, prior?.region ?? ""),
      status: _validListingStatus(ctx.status ?? prior?.status ?? _DEFAULT_LISTING_STATUS),
      contactPreference: _validContactPref(
        ctx.contactPreference ?? prior?.contactPreference
      ),
      notes: _str(ctx.notes, prior?.notes ?? ""),
      createdAt: prior?.createdAt || now,
      updatedAt: now,
    });

    if (prior) {
      const idx = _listings.indexOf(prior);
      _listings.splice(idx, 1);
    }
    _listings.push(record);
    _byIdempotency.set(idemKey, targetId);
    return record;
  }, null);
}

export interface ApproveListingInput {
  readonly listingId: string;
  readonly callerUserId: string;
  readonly callerRole: "admin" | "seller" | string;
}

export function approveListing(ctx: ApproveListingInput): SellListing | null {
  return _safe<SellListing | null>(() => {
    if (!_isObj(ctx)) return null;
    const listingId = _str(ctx.listingId);
    const callerUserId = _str(ctx.callerUserId);
    const callerRole = _str(ctx.callerRole);
    const prior = _listings.find((l) => l.id === listingId) || null;
    if (!prior) return null;

    const isAdmin = callerRole === "admin";
    const isSeller = prior.sellerUserId === callerUserId;
    if (!isAdmin && !isSeller) return null;

    const updated: SellListing = Object.freeze({
      ...prior,
      status: "approved" as ListingStatus,
      updatedAt: _now(),
    });
    const idx = _listings.indexOf(prior);
    _listings.splice(idx, 1, updated);
    return updated;
  }, null);
}

export interface ListListingsForBuyerOpts {
  readonly productType?: ProductType;
  readonly region?: string;
  readonly limit?: number;
}

export function listListingsForBuyer(
  opts?: ListListingsForBuyerOpts
): readonly SellListing[] {
  return _safe<readonly SellListing[]>(() => {
    const limit = typeof opts?.limit === "number" ? opts.limit : 200;
    const productType = opts?.productType;
    const region = _str(opts?.region);
    const filtered = _listings.filter((l) => {
      if (!(BUYER_VISIBLE_STATUSES as readonly string[]).includes(l.status)) {
        return false;
      }
      if (productType && l.productType !== productType) return false;
      if (region && l.region !== region) return false;
      return true;
    });
    return Object.freeze(filtered.slice(0, limit));
  }, Object.freeze([]));
}

export interface ListListingsForSellerOpts {
  readonly sellerUserId: string;
  readonly limit?: number;
}

export function listListingsForSeller(
  opts: ListListingsForSellerOpts
): readonly SellListing[] {
  return _safe<readonly SellListing[]>(() => {
    if (!_isObj(opts)) return Object.freeze([]);
    const sellerUserId = _str(opts.sellerUserId);
    if (!sellerUserId) return Object.freeze([]);
    const limit = typeof opts.limit === "number" ? opts.limit : 200;
    const filtered = _listings.filter((l) => l.sellerUserId === sellerUserId);
    return Object.freeze(filtered.slice(0, limit));
  }, Object.freeze([]));
}

export interface ListingsSnapshot {
  readonly version: string;
  readonly totalBuyerVisible: number;
  readonly approvedCount: number;
  readonly activeCount: number;
  readonly pausedCount: number;
  readonly closedCount: number;
  readonly emptyStateLabel: string;
  readonly capturedAt: string;
}

export function listingsSnapshot(): ListingsSnapshot {
  return _safe<ListingsSnapshot>(() => {
    let approved = 0;
    let active = 0;
    let paused = 0;
    let closed = 0;
    let buyerVisible = 0;
    for (const l of _listings) {
      if (l.status === "approved") {
        approved++;
        buyerVisible++;
      } else if (l.status === "active") {
        active++;
        buyerVisible++;
      } else if (l.status === "paused") paused++;
      else if (l.status === "closed") closed++;
      // drafts intentionally NEVER counted in buyer-visible totals.
    }
    return Object.freeze({
      version: BUYER_LISTING_SERVICE_VERSION,
      totalBuyerVisible: buyerVisible,
      approvedCount: approved,
      activeCount: active,
      pausedCount: paused,
      closedCount: closed,
      emptyStateLabel: buyerVisible === 0 ? "Not enough data yet" : "",
      capturedAt: _now(),
    });
  }, Object.freeze({
    version: BUYER_LISTING_SERVICE_VERSION,
    totalBuyerVisible: 0,
    approvedCount: 0,
    activeCount: 0,
    pausedCount: 0,
    closedCount: 0,
    emptyStateLabel: "Not enough data yet",
    capturedAt: "",
  }));
}

// Internal accessor used only by sibling services in this runtime.
export function _findListingById(listingId: string): SellListing | null {
  return _safe<SellListing | null>(
    () => _listings.find((l) => l.id === listingId) || null,
    null
  );
}
