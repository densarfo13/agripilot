/**
 * statusTransitions.js — named, testable status-machine helpers.
 *
 * The raw `canTransitionListing` / `canTransitionInterest` live in
 * listingMatcher.js; this module wraps them as "perform the
 * transition safely" services the marketService + route layer
 * call. Invalid transitions throw a typed HttpError so routes can
 * translate it into a 409 without each caller re-implementing the
 * rule.
 *
 *   transitionListingStatus(prisma, { user, id, to })
 *   transitionInterestStatus(prisma, { user, id, to, note })
 *
 * Both enforce ownership + valid-transition + optional admin
 * override (`user.role === 'admin'` bypasses the machine — for
 * rescues only).
 */

import { canTransitionListing, canTransitionInterest } from './listingMatcher.js';

function httpErr(status, code) {
  const e = new Error(code);
  e.status = status;
  e.code = code;
  return e;
}

export async function transitionListingStatus(prisma, { user, id, to } = {}) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await prisma.cropListing.findUnique({ where: { id } });
  if (!row) throw httpErr(404, 'listing_not_found');
  const isAdmin = user.role === 'admin';
  if (row.farmerId !== user.id && !isAdmin) throw httpErr(403, 'forbidden');
  if (!canTransitionListing(row.status, to) && !isAdmin) {
    throw httpErr(409, 'invalid_status_transition');
  }
  const updated = await prisma.cropListing.update({
    where: { id }, data: { status: to },
  });
  return { listing: updated, previous: row.status };
}

export async function transitionInterestStatus(prisma, { user, id, to, note } = {}) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await prisma.marketInterest.findUnique({
    where: { id }, include: { listing: true },
  });
  if (!row) throw httpErr(404, 'interest_not_found');
  const isAdmin = user.role === 'admin';
  if (row.listing.farmerId !== user.id && !isAdmin) throw httpErr(403, 'forbidden');
  if (!canTransitionInterest(row.status, to) && !isAdmin) {
    throw httpErr(409, 'invalid_status_transition');
  }
  const updated = await prisma.marketInterest.update({
    where: { id },
    data: {
      status: to,
      farmerResponseNote: typeof note === 'string' ? note.slice(0, 500) : null,
      respondedAt: new Date(),
    },
  });
  return { interest: updated, previous: row.status };
}
