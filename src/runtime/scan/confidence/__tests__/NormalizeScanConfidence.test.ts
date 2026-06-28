/**
 * NormalizeScanConfidence.test.ts — locks the overloaded-confidence fix.
 * Self-running: `tsx NormalizeScanConfidence.test.ts`. Prints PASS or exits 1.
 *
 * Each "// BUG BEFORE" case is one the old `_num(result.confidence)` derivation in
 * ScanCommandCard got wrong (wrong band and/or no percent). They now resolve honestly.
 */
import { normalizeScanConfidence, bandFromPct } from '../normalizeScanConfidence';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── BUG BEFORE: confidence arrives as a STRING tone ──────────────────────────
// Old: _num('high') = null → no percent, band fell back to 'low' (red). Now: band 'high'.
{
  const r = normalizeScanConfidence({ confidence: 'high' });
  ok(r.band === 'high', "string 'high' → band high (was wrongly 'low')");
  ok(r.pct === null, "string tone yields no fabricated percent (pct null)");
}
{
  const r = normalizeScanConfidence({ confidence: 'medium' });
  ok(r.band === 'medium', "string 'medium' → band medium (was wrongly 'low')");
}
{
  const r = normalizeScanConfidence({ confidence: 'LOW' });
  ok(r.band === 'low', "string 'LOW' (any case) → band low");
}

// ── BUG BEFORE: confidence arrives as a 0–1 float ────────────────────────────
// Old: confidencePct = 0.88 → _fmtPct → '1%', band (0.88 < 45) → 'low'. Now: 88% / high.
{
  const r = normalizeScanConfidence({ confidence: 0.88 });
  ok(r.pct === 88, '0–1 float 0.88 → 88% (was rendered as 1%)');
  ok(r.band === 'high', '0–1 float 0.88 → band high (was wrongly low)');
}
{
  const r = normalizeScanConfidence({ confidence: 0.5 });
  ok(r.pct === 50 && r.band === 'medium', '0.5 → 50% / medium');
}

// ── Already-correct cases must stay correct (no regression) ──────────────────
{
  const r = normalizeScanConfidence({ confidence: 88 });
  ok(r.pct === 88 && r.band === 'high', '0–100 number 88 → 88% / high (unchanged)');
}
{
  const r = normalizeScanConfidence({ confidence: 60 });
  ok(r.pct === 60 && r.band === 'medium', '60 → medium');
}
{
  const r = normalizeScanConfidence({ confidencePct: 80 });
  ok(r.pct === 80 && r.band === 'high', 'explicit confidencePct 80 → 80% / high');
}

// ── Precedence: explicit band wins; tone wins over derived ───────────────────
{
  const r = normalizeScanConfidence({ confidence: 95, confidenceBand: 'medium' });
  ok(r.band === 'medium', 'explicit confidenceBand overrides a derived band');
  ok(r.pct === 95, 'percent still resolved alongside an explicit band');
}
{
  const r = normalizeScanConfidence({ confidence: 'high', confidenceBand: '' });
  ok(r.band === 'high', 'empty confidenceBand is ignored; string tone used');
}

// ── Robustness: bad / absent input never throws ──────────────────────────────
ok(normalizeScanConfidence(null).band === null, 'null → {pct:null, band:null}');
ok(normalizeScanConfidence(undefined).pct === null, 'undefined → no throw');
ok(normalizeScanConfidence({}).band === null, 'empty object → no signal');
ok(normalizeScanConfidence({ confidence: 'garbage' }).band === null, 'unknown tone → no band');
ok(normalizeScanConfidence({ confidence: NaN }).pct === null, 'NaN → pct null');
ok(normalizeScanConfidence({ confidence: 150 }).pct === 100, 'out-of-range clamps to 100');

// bandFromPct boundaries (the 75 / 45 thresholds the card uses).
ok(bandFromPct(75) === 'high' && bandFromPct(74) === 'medium', '75 boundary → high');
ok(bandFromPct(45) === 'medium' && bandFromPct(44) === 'low', '45 boundary → medium');

console.log('[NormalizeScanConfidence] PASS — ' + passed + ' assertions. '
  + 'String tone, 0–1 float, and 0–100 number all resolve to an honest { pct, band }.');
