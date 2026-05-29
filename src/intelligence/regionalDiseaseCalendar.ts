/**
 * src/intelligence/regionalDiseaseCalendar.ts — region+plant
 * disease calendar.
 *
 *   import {
 *     regionalDiseaseCalendar, REGIONAL_DISEASE_CALENDAR_VERSION,
 *   } from 'src/intelligence/regionalDiseaseCalendar';
 *
 *   regionalDiseaseCalendar({
 *     country: 'Ghana', plantId: 'tomato', now: ...,
 *   })
 *
 * What this is
 * ────────────
 *   Returns the disease watch list for a (region × plant) pair,
 *   keyed by calendar month. The calendar is shipped in the
 *   bundle as a STARTER table — the same content-team backlog
 *   pattern the plant DB uses for Phase 12. Spec-call-out regions
 *   (Maryland · Ghana · India) are seeded; everything else falls
 *   back to the plant's general disease list with a 'general'
 *   confidence band.
 *
 * Returns frozen envelope:
 *   {
 *     country, plantId, monthIndex,
 *     active:    [{ disease, severity, monthsActive, source }],
 *     upcoming:  [{ disease, monthsUntil }],
 *     scopeNote: 'seeded' | 'general' | 'unknown',
 *     runtimeVersion,
 *   }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch.
 *   • Honest 'general' / 'unknown' bands when seed data missing.
 */

import { findPlant } from '../data/plants/index.js';

export const REGIONAL_DISEASE_CALENDAR_VERSION = 'regional-disease-calendar-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// Months are 0-indexed (Jan = 0, Dec = 11) — matches JS Date.
// `severity` is qualitative: low / medium / high.
const CALENDAR: Record<string, Record<string, Array<{
  disease: string; severity: string; months: number[];
}>>> = {
  Maryland: {
    rose: [
      { disease: 'black_spot',     severity: 'high',   months: [5, 6, 7, 8] },
      { disease: 'powdery_mildew', severity: 'medium', months: [4, 5, 9] },
      { disease: 'aphids',         severity: 'medium', months: [3, 4, 5] },
    ],
    tomato: [
      { disease: 'early_blight',   severity: 'high',   months: [5, 6, 7] },
      { disease: 'late_blight',    severity: 'high',   months: [6, 7, 8] },
    ],
  },
  Ghana: {
    tomato: [
      { disease: 'late_blight',    severity: 'high',   months: [4, 5, 6, 9, 10] },
      { disease: 'bacterial_spot', severity: 'medium', months: [3, 4, 5] },
    ],
    // 'maize' has no entry in the starter plant DB, but the
    // calendar still surfaces it so QA can see the regional
    // pattern landing.
    maize: [
      { disease: 'maize_streak_virus',  severity: 'high',   months: [3, 4, 5] },
      { disease: 'fall_armyworm',       severity: 'high',   months: [4, 5, 6, 9] },
      { disease: 'gray_leaf_spot',      severity: 'medium', months: [5, 6, 7] },
    ],
    cassava: [
      { disease: 'cassava_mosaic',      severity: 'high',   months: [3, 4, 5, 6] },
      { disease: 'cassava_brown_streak', severity: 'medium', months: [4, 5, 6] },
    ],
  },
  India: {
    tomato: [
      { disease: 'late_blight',    severity: 'high',   months: [6, 7, 8] },
      { disease: 'leaf_curl_virus', severity: 'high',   months: [4, 5, 6, 9] },
    ],
    rice: [
      { disease: 'rice_blast',     severity: 'high',   months: [6, 7, 8] },
      { disease: 'bacterial_leaf_blight', severity: 'high', months: [7, 8, 9] },
      { disease: 'brown_spot',     severity: 'medium', months: [6, 7] },
    ],
  },
};

const SEEDED_REGIONS = Object.keys(CALENDAR);

interface CalendarCtx {
  country?: string;
  state?: string;
  district?: string;
  plantId?: string;
  now?: number;
}

function _monthIndex(now: number | undefined): number {
  const t = typeof now === 'number' ? now : Date.now();
  return new Date(t).getUTCMonth();
}

export function regionalDiseaseCalendar(ctx: CalendarCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as CalendarCtx;
    const country = _str(c.country) || _str(c.state);
    const plantId = _str(c.plantId);
    const monthIndex = _monthIndex(_num(c.now) || undefined);

    const region = CALENDAR[country];
    const seeded = !!(region && region[plantId]);

    if (seeded) {
      const entries = region[plantId];
      const active: any[] = [];
      const upcoming: any[] = [];
      for (const e of entries) {
        if (e.months.indexOf(monthIndex) !== -1) {
          active.push(Object.freeze({
            disease:      e.disease,
            severity:     e.severity,
            monthsActive: Object.freeze(e.months),
            source:       'seeded',
          }));
        } else {
          // Closest future month
          const nextMonth = e.months
            .map((m) => (m - monthIndex + 12) % 12)
            .filter((d) => d > 0)
            .sort((a, b) => a - b)[0];
          if (nextMonth != null && nextMonth <= 3) {
            upcoming.push(Object.freeze({
              disease: e.disease, monthsUntil: nextMonth,
              source: 'seeded',
            }));
          }
        }
      }
      return Object.freeze({
        runtimeVersion: REGIONAL_DISEASE_CALENDAR_VERSION,
        country, plantId, monthIndex,
        active:    Object.freeze(active),
        upcoming:  Object.freeze(upcoming),
        scopeNote: 'seeded',
      });
    }

    // Fallback: plant DB general disease list — no severity, no months.
    const plant = findPlant(plantId);
    if (plant && _arr(plant.diseases).length > 0) {
      const active = _arr(plant.diseases).map((d) => Object.freeze({
        disease: _str(d), severity: 'unknown',
        monthsActive: Object.freeze([] as number[]),
        source: 'general',
      }));
      return Object.freeze({
        runtimeVersion: REGIONAL_DISEASE_CALENDAR_VERSION,
        country, plantId, monthIndex,
        active:    Object.freeze(active),
        upcoming:  Object.freeze([]),
        scopeNote: 'general',
        deferred: Object.freeze({
          seededCalendar:
            'region+plant combination not in seeded calendar; '
            + 'falling back to plant disease list — content-team '
            + 'backlog to expand seeded regions',
        }),
      });
    }

    return Object.freeze({
      runtimeVersion: REGIONAL_DISEASE_CALENDAR_VERSION,
      country, plantId, monthIndex,
      active:    Object.freeze([]),
      upcoming:  Object.freeze([]),
      scopeNote: 'unknown',
      deferred:  Object.freeze({
        seededCalendar:
          'no seeded calendar for this region+plant; expand the '
          + 'CALENDAR table to cover it',
      }),
    });
  }, Object.freeze({
    runtimeVersion: REGIONAL_DISEASE_CALENDAR_VERSION,
    country: '', plantId: '', monthIndex: 0,
    active:   Object.freeze([]),
    upcoming: Object.freeze([]),
    scopeNote: 'unknown',
  }));
}

export const SEEDED_DISEASE_REGIONS = Object.freeze(SEEDED_REGIONS);
