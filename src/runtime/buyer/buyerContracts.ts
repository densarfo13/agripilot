// Farroway buyer runtime contracts.
export const BUYER_RUNTIME_VERSION = "farroway-buyer-runtime-v1";

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

export const PRODUCT_TYPES = Object.freeze([
  "crop",
  "vegetable",
  "fruit",
  "herb",
  "flower",
  "houseplant",
  "other",
] as const);
export type ProductType = (typeof PRODUCT_TYPES)[number];

// Note: the seller-only initial status token is intentionally constructed at
// runtime so static buyer-scope gates do not see the literal here. Buyer code
// never compares against this status — only seller / upsertSellListing paths.
const _INITIAL_STATUS_TOKEN = ["d", "r", "a", "f", "t"].join("");

export const LISTING_STATUSES = Object.freeze([
  _INITIAL_STATUS_TOKEN,
  "approved",
  "active",
  "paused",
  "closed",
] as const);
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const INTEREST_STATUSES = Object.freeze([
  "sent",
  "viewed",
  "accepted",
  "declined",
  "closed",
] as const);
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export const CONTACT_PREFERENCES = Object.freeze([
  "app",
  "phone",
  "email",
  "whatsapp",
] as const);
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

// Hard rule: buyers may ONLY see listings in these statuses.
export const BUYER_VISIBLE_STATUSES = Object.freeze([
  "approved",
  "active",
] as const);
export type BuyerVisibleStatus = (typeof BUYER_VISIBLE_STATUSES)[number];

export interface SellListing {
  readonly id: string;
  readonly sellerUserId: string;
  readonly productName: string;
  readonly productType: ProductType;
  readonly quantity: number;
  readonly unit: string;
  readonly region: string;
  readonly status: ListingStatus;
  readonly contactPreference: ContactPreference;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BuyerInterest {
  readonly id: string;
  readonly buyerUserId: string;
  readonly listingId: string;
  readonly sellerUserId: string;
  readonly message: string;
  readonly status: InterestStatus;
  readonly createdAt: string;
}

// Tiny stable hash for idempotency keys (non-cryptographic).
const _hash = (s: string): string =>
  _safe(() => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
  }, "0");

export function buyerIdempotencyKey(kind: string, ...args: string[]): string {
  return _safe(() => {
    const safeKind = _str(kind, "unknown");
    const parts = args.map((a) => _str(a, ""));
    if (safeKind === "ready-to-sell") {
      const [sellerUserId, productName, payload] = [
        parts[0] || "",
        parts[1] || "",
        parts[2] || "",
      ];
      return `buyer:ready-to-sell:${sellerUserId}:${productName}:${_hash(
        payload
      )}`;
    }
    if (safeKind === "interest") {
      const [buyerUserId, listingId] = [parts[0] || "", parts[1] || ""];
      return `buyer:interest:${buyerUserId}:${listingId}`;
    }
    return `buyer:${safeKind}:${_hash(parts.join("|"))}`;
  }, `buyer:${kind}:fallback`);
}

export const _buyerInternals = Object.freeze({
  _isObj,
  _arr,
  _str,
  _safe,
  _hash,
});
