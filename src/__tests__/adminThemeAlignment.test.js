/**
 * adminThemeAlignment.test.js — locks the 2026-07-05 admin color alignment.
 *
 * The 5 admin intelligence pages used a slate-blue local theme (#1E293B cards, #94A3B8 text)
 * that clashed with the Farmers page's green-glass tokens. They were realigned to the shared
 * `var(--…)` tokens (chrome only). Status/data colors (red/amber/gold) are preserved per the
 * spec's rule 6. The Farmers page itself is untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const INTEL_PAGES = [
  'pages/admin/RegionalRiskMap.jsx',
  'pages/admin/HighRiskFarms.jsx',
  'pages/admin/HotspotInspector.jsx',
  'pages/admin/AlertControlCenter.jsx',
  'pages/admin/InterventionEffectiveness.jsx',
];

describe('admin theme alignment → Farmers green-glass tokens', () => {
  for (const p of INTEL_PAGES) {
    it(`${p}: slate chrome literals removed`, () => {
      const src = read(p);
      expect(src).not.toContain('#1E293B'); // slate card bg
      expect(src).not.toContain('#94A3B8'); // slate muted text
      expect(src).not.toContain('#64748B'); // slate dim text
    });
    it(`${p}: uses the shared Farmers-page tokens for chrome`, () => {
      const src = read(p);
      expect(src).toContain('var(--card-elevated)');
      expect(src).toContain('var(--text-muted)');
    });
  }

  it('status colors are preserved (red urgent / amber warning kept — spec rule 6)', () => {
    const src = read('pages/admin/RegionalRiskMap.jsx');
    expect(src).toContain('#EF4444');   // red — urgent/error
    expect(src).toContain('#FBBF24');   // amber — warning/monitoring
    expect(src).toMatch(/rgba\(239,68,68/); // red status backgrounds
  });

  it('Farmers page still uses the shared class system (its colors are the source of truth)', () => {
    const src = read('pages/FarmerDetailPage.jsx');
    // The Farmers page was NOT modified this pass — it keeps consuming the shared
    // .page-body / .card / .page-header classes (index.css tokens), which the intelligence
    // pages were realigned toward. It is the source of truth, never a recolor target.
    expect(src).toContain('className="page-body"');
    expect(src).toContain('className="card"');
    expect(src).toContain('className="page-header"');
  });
});
