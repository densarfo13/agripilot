// Idempotent splicer for the Home wiring i18n keys (May 2026 spec §3 + §13).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Home wiring spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the home-wiring block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Home location-hint + safe-fallback copy. Aligned to spec',
  '  // wording: "Add location for weather tips" (was: "for live',
  '  // weather"). Defensive English fallbacks ship with each row.',
  "  'home.locationHint.cta':   { en: 'Add location',          fr: 'Ajouter un lieu',           sw: 'Ongeza eneo',           ha: 'Ƙara wuri',                 tw: 'Ka beae si',                hi: '\\u0938\\u094D\\u0925\\u093E\\u0928 \\u091C\\u094B\\u0921\\u093C\\u0947\\u0902' },",
  "  'home.locationHint.body':  { en: 'for weather tips',      fr: 'pour des conseils m\\u00e9t\\u00e9o',     sw: 'kwa vidokezo vya hali ya hewa', ha: 'don shawarwarin yanayi',     tw: 'ma wim tebea afotuo',           hi: '\\u092E\\u094C\\u0938\\u092E \\u0938\\u0941\\u091D\\u093E\\u0935 \\u0915\\u0947 \\u0932\\u093F\\u090F' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
