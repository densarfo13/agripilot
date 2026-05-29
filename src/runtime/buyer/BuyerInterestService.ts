// Farroway buyer-side interest service. Idempotent. SSR-safe.
import {
  BUYER_VISIBLE_STATUSES,
  type BuyerInterest,
  type InterestStatus,
  buyerIdempotencyKey,
} from "./buyerContracts";
import { _findListingById } from "./BuyerListingService";

export const BUYER_INTEREST_SERVICE_VERSION = "farroway-buyer-runtime-v1";

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

const _interests: BuyerInterest[] = [];
const _byIdempotency = new Map<string, string>();

export interface SendBuyerInterestInput {
  readonly buyerUserId: string;
  readonly listingId: string;
  readonly message?: string;
}

export function sendBuyerInterest(
  ctx: SendBuyerInterestInput
): BuyerInterest | null {
  return _safe<BuyerInterest | null>(() => {
    if (!_isObj(ctx)) return null;
    const buyerUserId = _str(ctx.buyerUserId);
    const listingId = _str(ctx.listingId);
    if (!buyerUserId || !listingId) return null;

    const listing = _findListingById(listingId);
    if (!listing) return null;
    if (!(BUYER_VISIBLE_STATUSES as readonly string[]).includes(listing.status)) {
      return null;
    }

    const idemKey = buyerIdempotencyKey("interest", buyerUserId, listingId);
    const existingId = _byIdempotency.get(idemKey);
    if (existingId) {
      const existing = _interests.find((i) => i.id === existingId);
      if (existing) return existing;
    }

    const record: BuyerInterest = Object.freeze({
      id: `int_${_now()}_${_interests.length}`,
      buyerUserId,
      listingId,
      sellerUserId: listing.sellerUserId,
      message: _str(ctx.message, ""),
      status: "sent" as InterestStatus,
      createdAt: _now(),
    });
    _interests.push(record);
    _byIdempotency.set(idemKey, record.id);
    return record;
  }, null);
}

export function listInterestsForBuyer(
  buyerUserId: string
): readonly BuyerInterest[] {
  return _safe<readonly BuyerInterest[]>(() => {
    const uid = _str(buyerUserId);
    if (!uid) return Object.freeze([]);
    const filtered = _interests.filter((i) => i.buyerUserId === uid);
    return Object.freeze(filtered.slice());
  }, Object.freeze([]));
}

export function listInterestsForSeller(
  sellerUserId: string
): readonly BuyerInterest[] {
  return _safe<readonly BuyerInterest[]>(() => {
    const uid = _str(sellerUserId);
    if (!uid) return Object.freeze([]);
    const filtered = _interests.filter((i) => i.sellerUserId === uid);
    return Object.freeze(filtered.slice());
  }, Object.freeze([]));
}

export interface InterestsSnapshot {
  readonly version: string;
  readonly totalInterests: number;
  readonly sentCount: number;
  readonly viewedCount: number;
  readonly acceptedCount: number;
  readonly declinedCount: number;
  readonly closedCount: number;
  readonly emptyStateLabel: string;
  readonly capturedAt: string;
}

export function interestsSnapshot(): InterestsSnapshot {
  return _safe<InterestsSnapshot>(() => {
    let sent = 0;
    let viewed = 0;
    let accepted = 0;
    let declined = 0;
    let closed = 0;
    for (const i of _interests) {
      if (i.status === "sent") sent++;
      else if (i.status === "viewed") viewed++;
      else if (i.status === "accepted") accepted++;
      else if (i.status === "declined") declined++;
      else if (i.status === "closed") closed++;
      // NOTE: never expose buyer-private messages in snapshots.
    }
    const total = _interests.length;
    return Object.freeze({
      version: BUYER_INTEREST_SERVICE_VERSION,
      totalInterests: total,
      sentCount: sent,
      viewedCount: viewed,
      acceptedCount: accepted,
      declinedCount: declined,
      closedCount: closed,
      emptyStateLabel: total === 0 ? "Not enough data yet" : "",
      capturedAt: _now(),
    });
  }, Object.freeze({
    version: BUYER_INTEREST_SERVICE_VERSION,
    totalInterests: 0,
    sentCount: 0,
    viewedCount: 0,
    acceptedCount: 0,
    declinedCount: 0,
    closedCount: 0,
    emptyStateLabel: "Not enough data yet",
    capturedAt: "",
  }));
}
