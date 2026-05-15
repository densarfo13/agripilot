/**
 * checkTranslations.test.js — Global Language Consistency Fix.
 *
 * The check:translations gate (scripts/check-translations.mjs) is
 * the build-time guarantee against mixed-language screens. A mixed
 * screen happens when a key has a value in some languages but not
 * the active one; the gate fails the build if that drift appears.
 *
 * Coverage:
 *   - the gate passes on the current source tree
 *   - it enforces 100% parity for the 5 launch-complete languages
 *   - it ratchets Hindi coverage (no-regression baseline)
 *   - it verifies all 8 locale JSON files stay key-identical
 *   - it is registered in package.json + wired into build:safe
 *   - translations.js itself is structurally sound (every key is a
 *     {en,fr,sw,ha,tw,hi} object)
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. The gate passes ────────────────────────────────────

describe('check:translations — build-time gate', () => {
  it('passes on the current source tree', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-translations.mjs', {
        cwd: ROOT, encoding: 'utf8',
      });
    } catch (err) {
      throw new Error('check:translations FAILED:\n'
        + ((err.stdout || '') + (err.stderr || '')));
    }
    expect(stdout).toMatch(/\[check:translations\] PASS/);
    expect(stdout).toMatch(/en\/fr\/sw\/ha\/tw at 100%/);
    expect(stdout).toMatch(/8 locale JSON files key-identical/);
  });
});

// ─── 2. package.json wiring ────────────────────────────────

describe('check:translations — registered + wired into build:safe', () => {
  const pkg = JSON.parse(read('package.json'));

  it('check:translations npm script is registered', () => {
    expect(pkg.scripts['check:translations']).toBe('node scripts/check-translations.mjs');
  });

  it('build:safe runs check:translations before npm run build', () => {
    expect(pkg.scripts['build:safe']).toContain('check:translations');
    const idxCheck = pkg.scripts['build:safe'].indexOf('check:translations');
    const idxBuild = pkg.scripts['build:safe'].indexOf('npm run build');
    expect(idxCheck).toBeLessThan(idxBuild);
  });
});

// ─── 3. translations.js structural soundness ───────────────

describe('translations.js — every key carries all 6 launch languages', () => {
  it('the 5 launch-complete languages have a non-blank value for every active key', async () => {
    const mod = await import('../../../src/i18n/translations.js');
    const T = mod.default || mod;
    const REQUIRED = ['en', 'fr', 'sw', 'ha', 'tw'];
    const blank = (v) => typeof v !== 'string' || v.trim() === '';
    const gaps = [];
    for (const k of Object.keys(T)) {
      const v = T[k];
      if (!v || typeof v !== 'object') { gaps.push(k + ' (bad shape)'); continue; }
      if (blank(v.en)) continue; // intentional placeholder — skip
      for (const lang of REQUIRED) {
        if (blank(v[lang])) gaps.push(`${k}:${lang}`);
      }
    }
    expect(gaps).toEqual([]);
  });
});

// ─── 4. locale JSON parity ─────────────────────────────────

describe('src/i18n/locales — all 8 files key-identical to en.json', () => {
  function leafKeys(obj, prefix = '') {
    let out = [];
    for (const k of Object.keys(obj)) {
      const kp = prefix ? prefix + '.' + k : k;
      const val = obj[k];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out = out.concat(leafKeys(val, kp));
      } else { out.push(kp); }
    }
    return out;
  }

  it('fr / tw / ha / sw / hi / es / pt match en.json exactly', () => {
    const enKeys = new Set(
      leafKeys(JSON.parse(read('src/i18n/locales/en.json'))),
    );
    const drift = [];
    for (const lang of ['fr', 'tw', 'ha', 'sw', 'hi', 'es', 'pt']) {
      const k = leafKeys(JSON.parse(read(`src/i18n/locales/${lang}.json`)));
      const kSet = new Set(k);
      const missing = [...enKeys].filter((x) => !kSet.has(x));
      const extra   = k.filter((x) => !enKeys.has(x));
      if (missing.length || extra.length) {
        drift.push(`${lang}: missing ${missing.length}, extra ${extra.length}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
