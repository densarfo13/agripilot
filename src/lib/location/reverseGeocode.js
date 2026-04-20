/**
 * reverseGeocode.js — real reverse-geocode helper + offline fallback.
 *
 * Strategy:
 *   1. If the browser is in a secure context and we're online,
 *      call bigdatacloud.net's free reverse-geocode-client endpoint.
 *      That API returns an ISO-2 `countryCode` directly — no
 *      ambiguous name-to-code mapping needed.
 *   2. If the network call fails / times out / returns nothing,
 *      fall back to a small local bounding-box heuristic that
 *      catches the countries we operate in (US, GH, IN, NG, KE,
 *      TZ, ZA). This keeps the "Detect my location" button useful
 *      offline.
 *
 *   reverseGeocode(lat, lng, opts?)
 *     → Promise<{
 *         country:              'US' | 'GH' | ... | null,    // ISO-2
 *         countryLabel:         'United States' | null,
 *         principalSubdivision: 'California' | null,
 *         stateCode:            'CA' | null,                  // mapped via countriesStates
 *         city:                 'Accra' | null,
 *         source:               'network' | 'coarse' | null,
 *         raw:                  object | null,
 *       } | null>
 *
 * Never throws — callers can `const r = await reverseGeocode(lat, lng)`
 * and treat `null` as "couldn't figure it out".
 */

import {
  getCountryLabel, getStatesForCountry,
} from '../../config/countriesStates.js';

const ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const DEFAULT_TIMEOUT_MS = 7000;

function isFiniteLatLng(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

/** Offline / fast heuristic — matches the boxes we already used in
 * FirstLaunchConfirm + NewFarmScreen. Kept deliberately coarse; the
 * network path supersedes it when available. */
export function coarseGeocode(lat, lng) {
  if (!isFiniteLatLng(lat, lng)) return null;
  const la = Number(lat), lo = Number(lng);
  if (la >=  24 && la <=  50 && lo >= -125 && lo <=  -66) return { country: 'US' };
  if (la >=   4.5 && la <=  11.5 && lo >=  -3.5 && lo <=    1.5) return { country: 'GH' };
  if (la >=   6 && la <=  37 && lo >=  68 && lo <=   97) return { country: 'IN' };
  if (la >=   4 && la <=  14 && lo >=   2 && lo <=   15) return { country: 'NG' };
  if (la >=  -5 && la <=   5 && lo >=  33 && lo <=   42) return { country: 'KE' };
  if (la >= -12 && la <=  -1 && lo >=  29 && lo <=   40) return { country: 'TZ' };
  if (la >= -35 && la <= -22 && lo >=  16 && lo <=   33) return { country: 'ZA' };
  return null;
}

function isSecureContext() {
  // Secure context covers https and http://localhost; the bigdatacloud
  // endpoint is HTTPS-only on production origins, so fetch would fail
  // on http:// hosts anyway.
  if (typeof window !== 'undefined') return !!window.isSecureContext;
  return true; // assume secure in Node/tests
}

function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * stateCodeFromLabel — bigdatacloud returns `principalSubdivision`
 * as a full name (e.g. "California"). Our dropdowns/state code key
 * is ISO-3166-2-style short codes. Map via the central tables.
 */
export function stateCodeFromLabel(countryCode, label) {
  if (!countryCode || !label) return null;
  const target = String(label).trim().toLowerCase();
  if (!target) return null;
  const states = getStatesForCountry(countryCode);
  for (const s of states) {
    if (String(s.label).toLowerCase() === target) return s.code;
  }
  // Last-chance: some bigdatacloud responses include a bare code.
  const upper = label.toUpperCase();
  for (const s of states) if (s.code === upper) return s.code;
  return null;
}

/**
 * fetchWithTimeout — wraps fetch with AbortController so a slow
 * network never hangs the caller. Returns null on any failure.
 */
async function fetchWithTimeout(url, timeoutMs) {
  if (typeof fetch !== 'function') return null;
  const controller = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null;
  const signal = controller ? controller.signal : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(url, { signal });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}

/**
 * reverseGeocode — main export. Network-first with coarse fallback.
 *
 * opts:
 *   timeoutMs?: number   (default 7000)
 *   forceCoarse?: bool   (test shim — skip the network call)
 *   fetchJson?: fn       (test shim — swap the network function)
 */
export async function reverseGeocode(lat, lng, opts = {}) {
  if (!isFiniteLatLng(lat, lng)) return null;

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const fetchJson = typeof opts.fetchJson === 'function'
    ? opts.fetchJson
    : (u) => fetchWithTimeout(u, timeoutMs);

  // Fast path — skip network when the caller says so, or when the
  // environment forbids it.
  const canNetwork = !opts.forceCoarse && isSecureContext() && isOnline();

  if (canNetwork) {
    const la = Number(lat).toFixed(6);
    const lo = Number(lng).toFixed(6);
    const url =
      `${ENDPOINT}?latitude=${la}&longitude=${lo}&localityLanguage=en`;
    const data = await fetchJson(url);
    if (data && (data.countryCode || data.countryName)) {
      const country = data.countryCode ? String(data.countryCode).toUpperCase() : null;
      const countryLabel = data.countryName
        || (country ? getCountryLabel(country) : null);
      const principalSubdivision = data.principalSubdivision || null;
      const stateCode = country && principalSubdivision
        ? stateCodeFromLabel(country, principalSubdivision)
        : null;
      return Object.freeze({
        country,
        countryLabel,
        principalSubdivision,
        stateCode,
        city: data.city || data.locality || null,
        source: 'network',
        raw: data,
      });
    }
  }

  // Fallback — bounding-box heuristic. No state / city info; just
  // the country code we're fairly confident about.
  const coarse = coarseGeocode(lat, lng);
  if (coarse && coarse.country) {
    return Object.freeze({
      country: coarse.country,
      countryLabel: getCountryLabel(coarse.country) || null,
      principalSubdivision: null,
      stateCode: null,
      city: null,
      source: 'coarse',
      raw: null,
    });
  }
  return null;
}

export const _internal = Object.freeze({ ENDPOINT, DEFAULT_TIMEOUT_MS });
