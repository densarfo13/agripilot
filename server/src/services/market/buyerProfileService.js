/**
 * buyerProfileService.js — read + update the buyer's location
 * preferences. One row per user; lazy-create on first access.
 *
 * Public API:
 *   getBuyerProfile(prisma, { user })
 *   updateBuyerProfile(prisma, { user, patch })
 *
 * The preferred-regions shape is:
 *   [{ country: 'US', stateCode: 'MD' }, { country: 'GH' }, …]
 * stateCode is optional so a buyer can bookmark a whole country.
 */

function httpErr(status, code) {
  const e = new Error(code);
  e.status = status;
  e.code = code;
  return e;
}

// ─── sanitizers ──────────────────────────────────────────
function sanitizeCountries(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    const c = String(v || '').trim().toUpperCase();
    if (c && c.length <= 5 && !out.includes(c)) out.push(c);
    if (out.length >= 10) break;
  }
  return out;
}

function sanitizeRegions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const country = String(r.country || '').trim().toUpperCase();
    if (!country) continue;
    const stateCode = r.stateCode ? String(r.stateCode).trim().toUpperCase() : null;
    const label = r.label ? String(r.label).trim().slice(0, 80) : null;
    const key = `${country}:${stateCode || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ country, stateCode, label });
    if (out.length >= 20) break;
  }
  return out;
}

function ensureShape(row) {
  if (!row) return null;
  let regions = row.preferredRegions;
  if (typeof regions === 'string') {
    try { regions = JSON.parse(regions); } catch { regions = []; }
  }
  return {
    id: row.id,
    userId: row.userId,
    preferredCountries: Array.isArray(row.preferredCountries) ? row.preferredCountries : [],
    preferredRegions: Array.isArray(regions) ? regions : [],
    expandSearch: !!row.expandSearch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── readers ─────────────────────────────────────────────
export async function getBuyerProfile(prisma, { user } = {}) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  try {
    let row = await prisma.buyerProfile.findUnique({ where: { userId: user.id } });
    if (!row) {
      row = await prisma.buyerProfile.create({
        data: { userId: user.id, preferredCountries: [], preferredRegions: [] },
      });
    }
    return { profile: ensureShape(row) };
  } catch {
    // Pre-migration fallback — return a transient empty profile so
    // the client can still render without blowing up.
    return {
      profile: {
        id: null, userId: user.id,
        preferredCountries: [], preferredRegions: [],
        expandSearch: false,
      },
    };
  }
}

export async function updateBuyerProfile(prisma, { user, patch = {} } = {}) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const data = {};
  if (Array.isArray(patch.preferredCountries)) {
    data.preferredCountries = sanitizeCountries(patch.preferredCountries);
  }
  if (Array.isArray(patch.preferredRegions)) {
    data.preferredRegions = sanitizeRegions(patch.preferredRegions);
  }
  if (typeof patch.expandSearch === 'boolean') {
    data.expandSearch = patch.expandSearch;
  }
  try {
    const row = await prisma.buyerProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return { profile: ensureShape(row) };
  } catch {
    return { profile: null };
  }
}

export const _internal = { sanitizeCountries, sanitizeRegions, ensureShape };
