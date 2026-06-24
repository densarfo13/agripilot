/**
 * ScanReviewContracts.ts — sprint #214 §4. Sibling namespace.
 * Pure data.
 */

export const SCAN_REVIEW_CONTRACTS_VERSION = 'scan-review-contracts-v1';

export const SCAN_REVIEW_STORAGE_KEY = 'farroway:scanReviewQueue';
export const SCAN_REVIEW_MAX = 50;

export type ReviewStatus = 'pending_review' | 'reviewed' | 'discarded' | 'promoted_to_plant';

// NOTE privacy: no exact coords, no device id, no raw filename. imageUrl
// is the already-stored thumbnail ref the app holds; userId/farmId are
// opaque ids the app already uses.
export interface ScanReviewItem {
  scanId:       string;
  imageUrl:     string;
  qualityScore: number | null;
  confidence:   number | null;   // 0-100
  reasons:      ReadonlyArray<string>;
  createdAt:    string;          // ISO — caller-supplied
  farmId:       string | null;
  userId:       string | null;
  status:       ReviewStatus;
}
