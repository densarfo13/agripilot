/**
 * listingValidationService.js — pre-activation gate.
 *
 *   validateListingForActivation(prisma, { user, data })
 *     → { valid, errors, warnings }
 *
 * Checks:
 *   - quantity > 0
 *   - valid quality + delivery + pricing enums
 *   - no duplicate ACTIVE listing for the same cropCycleId
 *   - when cropCycleId is missing, enforces the supply-credibility
 *     rule (unless allowManualWithoutHarvest) — same rule as
 *     createListing, replicated here so callers can pre-check
 *     without writing
 *
 * Pure on top of prisma; no side effects.
 */

const QUALITY_OK = new Set(['high', 'medium', 'low']);
const DELIVERY_OK = new Set(['pickup', 'delivery', 'either']);
const PRICING_OK  = new Set(['fixed', 'negotiable', 'ask_buyer']);

export async function validateListingForActivation(prisma, { user, data = {}, allowManualWithoutHarvest = false } = {}) {
  const errors = {};
  const warnings = {};

  if (!user?.id) errors.user = 'unauthenticated';

  const qty = Number(data.quantity);
  if (!Number.isFinite(qty) || qty <= 0) errors.quantity = 'invalid_quantity';

  if (!data.cropKey) errors.cropKey = 'required';
  if (!data.country) errors.country = 'required';

  if (data.quality && !QUALITY_OK.has(String(data.quality).toLowerCase())) {
    errors.quality = 'invalid_enum';
  }
  if (data.deliveryMode && !DELIVERY_OK.has(data.deliveryMode)) {
    errors.deliveryMode = 'invalid_enum';
  }
  if (data.pricingMode && !PRICING_OK.has(data.pricingMode)) {
    errors.pricingMode = 'invalid_enum';
  }

  // Supply credibility: listing must tie back to a harvest cycle
  // unless the caller explicitly opted into manual creation.
  if (!data.cropCycleId && !allowManualWithoutHarvest && user?.role !== 'admin') {
    errors.cropCycleId = 'harvest_context_required';
  }

  // Duplicate-active-listing guard: if this cropCycleId already has
  // an active listing owned by someone else (or even this user),
  // block re-creation. The status machine still allows edits.
  if (data.cropCycleId && prisma?.cropListing?.findFirst) {
    try {
      const existing = await prisma.cropListing.findFirst({
        where: {
          cropCycleId: data.cropCycleId,
          status: { in: ['active', 'reserved'] },
        },
        select: { id: true, farmerId: true, status: true },
      });
      if (existing && existing.id) {
        errors.duplicate = 'duplicate_active_listing';
        warnings.existingListingId = existing.id;
      }
    } catch { /* pre-migration — skip */ }
  }

  if (qty > 0 && qty < 1) warnings.quantity = 'below_one_unit';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
