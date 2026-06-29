/**
 * scanIdentificationBenchmark.test.js — P0-1 release gate. Vitest.
 *
 * SCOPE (honest): this benchmarks the PIPELINE, not real-image CV accuracy. It feeds the
 * real consensus internals (_pickTopIdentification / _confToScore / _scoreToBand) a
 * representative CONFIDENT provider payload for each supported crop and asserts the pipeline
 * surfaces a named, confident identification — i.e. a good provider match for a supported
 * crop is NEVER dropped to Unknown/low by our own normalization+decision code. It also
 * asserts weak/empty inputs correctly stay non-confident (so they route to a failure verdict,
 * never a fabricated ID). Real end-to-end accuracy on real photos requires the production
 * scan run — this gate prevents the PIPELINE-side "supported crop returns Unknown" regression.
 *
 * Target: >= 95% of supported-crop fixtures yield a confident named ID.
 */
import { describe, it, expect } from 'vitest';
import { _internal } from '../ml/scanConsensusEngine.js';

const { _pickTopIdentification, _confToScore, _scoreToBand } = _internal;

// Plant.id-shaped fixture for a supported crop at a confident score.
const pid = (commonName, scientificName, score = 0.86) => ({ identification: { commonName, scientificName, score } });
// PlantNet-shaped fixture.
const pnt = (commonName, scientificName, score = 0.82) => ({
  raw: { results: [{ score, species: { scientificNameWithoutAuthor: scientificName, commonNames: [commonName] } }] },
});

// Supported staples across the Ghana/Kenya pilot (common + scientific name).
const BENCHMARK = [
  { crop: 'Maize',     parsed: pid('Maize', 'Zea mays') },
  { crop: 'Tomato',    parsed: pid('Tomato', 'Solanum lycopersicum') },
  { crop: 'Cassava',   parsed: pid('Cassava', 'Manihot esculenta') },
  { crop: 'Cowpea',    parsed: pid('Cowpea', 'Vigna unguiculata') },
  { crop: 'Groundnut', parsed: pid('Groundnut', 'Arachis hypogaea') },
  { crop: 'Plantain',  parsed: pid('Plantain', 'Musa paradisiaca') },
  { crop: 'Yam',       parsed: pid('Yam', 'Dioscorea rotundata') },
  { crop: 'Okra',      parsed: pid('Okra', 'Abelmoschus esculentus') },
  { crop: 'Pepper',    parsed: pid('Pepper', 'Capsicum annuum') },
  { crop: 'Onion',     parsed: pid('Onion', 'Allium cepa') },
  { crop: 'Cocoa',     parsed: pid('Cocoa', 'Theobroma cacao') },
  { crop: 'Mango',     parsed: pid('Mango', 'Mangifera indica') },
  // PlantNet-only path (Plant.id absent) must identify too.
  { crop: 'Rice',      parsed: null, parsedNet: pnt('Rice', 'Oryza sativa') },
  { crop: 'Sorghum',   parsed: null, parsedNet: pnt('Sorghum', 'Sorghum bicolor') },
  { crop: 'Millet',    parsed: null, parsedNet: pnt('Pearl millet', 'Pennisetum glaucum') },
  { crop: 'Banana',    parsed: null, parsedNet: pnt('Banana', 'Musa acuminata') },
];

describe('scan identification benchmark (P0-1)', () => {
  it('confident provider data for every supported crop yields a confident named ID', () => {
    const failures = [];
    for (const row of BENCHMARK) {
      const id = _pickTopIdentification(row.parsed, row.parsedNet || null);
      const band = id ? _scoreToBand(_confToScore(id.score)) : 'low';
      const named = !!(id && (id.commonName || id.scientificName));
      const confident = named && band !== 'low';
      if (!confident) failures.push(`${row.crop}: id=${JSON.stringify(id)} band=${band}`);
    }
    const rate = (BENCHMARK.length - failures.length) / BENCHMARK.length;
    if (failures.length) console.error('benchmark misses:\n  ' + failures.join('\n  '));
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it('each supported crop keeps its expected common name (no Latin-name collapse)', () => {
    for (const row of BENCHMARK) {
      const id = _pickTopIdentification(row.parsed, row.parsedNet || null);
      expect(id).not.toBeNull();
      expect(String(id.commonName).toLowerCase()).toContain(row.crop.toLowerCase().split(' ')[0].slice(0, 4));
    }
  });

  it('weak / empty inputs stay NON-confident (route to a failure verdict, never a fabricated ID)', () => {
    // No candidates at all → no identification (NO_PLANT / NO_CANDIDATES, not a fake name).
    expect(_pickTopIdentification(null, null)).toBeNull();
    // A low-score match is classified 'low' (LOW_CONFIDENCE) — not surfaced as a confident ID.
    expect(_scoreToBand(_confToScore(0.30))) .toBe('low');
    expect(_scoreToBand(_confToScore(0.44))) .toBe('low');
    // The 0.45 / 0.75 band boundaries hold.
    expect(_scoreToBand(0.45)).toBe('medium');
    expect(_scoreToBand(0.75)).toBe('high');
  });
});
