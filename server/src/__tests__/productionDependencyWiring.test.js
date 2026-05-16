/**
 * productionDependencyWiring.test.js — pins the May 2026
 * production-dependency wiring contract:
 *
 *   • WeatherHeroActionCard never renders a fake 0° / "Feels like 0°"
 *     when the weather payload is missing. Em-dash placeholders +
 *     "Add location for accurate weather guidance" only.
 *   • Legacy WeatherHeroCard also guards temp with the em-dash
 *     fallback (Number.isFinite gate).
 *   • RAILWAY_ENV_CHECKLIST.md exists at docs/ and lists the four
 *     required vars plus the new alias surfaces (Cloudinary / S3 /
 *     Mapbox / Plant.id / PlantNet / VITE_SENTRY_DSN).
 *
 * Failures here are regression-meaningful: anyone reintroducing
 * a `weather.temp || 0` or removing the operator-facing checklist
 * fails CI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Production dependency wiring (May 2026)', () => {

  describe('No fake 0° weather rendering', () => {
    // NOTE: the WeatherHeroActionCard test was removed — that
    // component was deleted in a later weather-card pass. The
    // em-dash / no-fake-0° contract is still pinned below for the
    // live WeatherHeroCard. Test debt cleanup: gone code path.

    it('legacy WeatherHeroCard also gates temp with the em-dash', () => {
      const src = read('src/components/WeatherHeroCard.jsx');
      expect(src).toMatch(/Number\.isFinite\(Number\(w\.temp\)\)/);
      // Display fallback uses em-dash, not "0".
      expect(src).toMatch(/'—°'|"—°"/);
    });
  });

  describe('Railway env checklist', () => {
    it('docs/RAILWAY_ENV_CHECKLIST.md exists', () => {
      expect(existsSync(resolve(ROOT, 'docs/RAILWAY_ENV_CHECKLIST.md'))).toBe(true);
    });

    it('lists the four required server-only vars', () => {
      const md = read('docs/RAILWAY_ENV_CHECKLIST.md');
      expect(md).toMatch(/DATABASE_URL/);
      expect(md).toMatch(/AUTH_SECRET/);
      expect(md).toMatch(/REDIS_URL/);
      expect(md).toMatch(/VITE_API_BASE_URL/);
    });

    it('documents the new alias surfaces from the wiring spec', () => {
      const md = read('docs/RAILWAY_ENV_CHECKLIST.md');
      // Maps aliases
      expect(md).toMatch(/MAPBOX_TOKEN/);
      // Scan provider aliases
      expect(md).toMatch(/PLANT_ID_API_KEY/);
      expect(md).toMatch(/PLANTNET_API_KEY/);
      // Cloud upload providers (future)
      expect(md).toMatch(/CLOUDINARY_API_KEY/);
      expect(md).toMatch(/S3_BUCKET/);
      expect(md).toMatch(/AWS_ACCESS_KEY_ID/);
      // Sentry client-side DSN
      expect(md).toMatch(/VITE_SENTRY_DSN/);
    });

    it('flags the frontend safety rule about VITE_-prefix', () => {
      const md = read('docs/RAILWAY_ENV_CHECKLIST.md');
      expect(md).toMatch(/VITE_/);
      // The cardinal rule is stated explicitly.
      expect(md.toLowerCase()).toMatch(/never put a server-only secret/);
    });
  });
});
