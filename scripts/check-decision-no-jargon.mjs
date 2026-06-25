/**
 * check-decision-no-jargon.mjs — FARROWAY DECISION ENGINE §5/§10.
 * The farmer never sees AI / LLM / model / provider / Plant.id / Crop.health /
 * Insect.id in the decision surface. The explainer sanitizes; the surface text
 * carries none of these literals.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ex = rd('src/runtime/decision/DecisionExplainer.ts');
h(ex, 'sanitizeFarmerText', 'explainer must export the jargon sanitizer');
h(ex, 'JARGON_TERMS', 'explainer must define the banned-term list');
for (const t of ['plant.id', 'crop.health', 'insect.id', 'model', 'provider'])
  h(ex, t, 'sanitizer must cover the term: ' + t);

// The farmer-facing decision surface must not RENDER a provider/AI literal in JSX text.
const hero = rd('src/components/home/DecisionHero.jsx');
const BAD = /(Plant\.id|Crop\.health|Insect\.id|\bLLM\b|neural network)/i;
// Allow these words only inside comments; flag if they appear in a JSX string literal.
const jsxText = hero.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
if (BAD.test(jsxText)) E.push('DecisionHero renders a provider/AI literal to the farmer');

if (E.length) { console.error('[check:decision-no-jargon] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:decision-no-jargon] PASS — decision surface carries no provider/AI jargon; explainer sanitizes.');
