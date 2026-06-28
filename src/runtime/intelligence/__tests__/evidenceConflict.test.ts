/**
 * evidenceConflict.test.ts — cross-source conflict detection. `tsx evidenceConflict.test.ts`.
 * Proves opposite-polarity claims from different sources flag a conflict + recommend
 * verification, while agreement / single-source / ambiguous never false-alarm.
 */
import { detectEvidenceConflict, evidenceConflictHealth } from '../evidenceConflict';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Opposite claims, different sources → conflict + verify.
const conflict = detectEvidenceConflict([
  { source: 'photo', axis: 'moisture', polarity: 'dry' },
  { source: 'soil reading', axis: 'moisture', polarity: 'wet' },
]);
ok(conflict.hasConflict === true, 'photo=dry vs soil=wet → conflict');
ok(conflict.recommendation === 'verify', 'conflict recommends verify (never picks one)');
ok(conflict.sources.length === 2 && /disagree/i.test(conflict.message), 'conflict names both sources + says disagree');

// Agreement → no conflict.
ok(detectEvidenceConflict([
  { source: 'photo', axis: 'moisture', polarity: 'dry' },
  { source: 'soil reading', axis: 'moisture', polarity: 'dry' },
]).hasConflict === false, 'both dry → no conflict');

// Same source cannot conflict with itself.
ok(detectEvidenceConflict([
  { source: 'photo', axis: 'moisture', polarity: 'dry' },
  { source: 'photo', axis: 'moisture', polarity: 'wet' },
]).hasConflict === false, 'same source → no conflict (not cross-source)');

// Different axes never conflict.
ok(detectEvidenceConflict([
  { source: 'photo', axis: 'moisture', polarity: 'dry' },
  { source: 'soil reading', axis: 'nutrient', polarity: 'wet' },
]).hasConflict === false, 'different axes → no conflict');

// Insufficient / malformed → never a false alarm.
ok(detectEvidenceConflict([{ source: 'photo', axis: 'moisture', polarity: 'dry' }]).hasConflict === false, 'single claim → no conflict');
ok(detectEvidenceConflict([]).hasConflict === false, 'empty → no conflict');
ok(detectEvidenceConflict(null).hasConflict === false, 'null → no conflict (never throws)');
ok(detectEvidenceConflict([{ source: 'photo' }, { source: 'soil' }]).hasConflict === false, 'missing axis/polarity → no conflict');

const h = evidenceConflictHealth();
ok(h.detectsOpposite && h.ignoresAgreement && h.singleSourceNoConflict, 'health attests detect-opposite + ignore-agreement + single-source-safe');

console.log('[test:evidence-conflict] PASS — ' + passed + ' assertions (opposite cross-source claims flag a conflict + recommend verification; agreement / single-source / ambiguous never false-alarm).');
