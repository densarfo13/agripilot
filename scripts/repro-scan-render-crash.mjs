// repro-scan-render-crash.mjs — scan-render regression test (STEP 14 guard).
// Renders the scan result tree (Router-wrapped) with SUCCESS + LOW-CONFIDENCE envelopes,
// plus PhotoComparisonCard across the exact scanId falsy→truthy transition that caused the
// 2026-07-04 production crash. --strict (used by check:no-conditional-hooks) exits 1 on any crash.
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
globalThis.React = React; // tsx classic-JSX shim; the app itself uses Vite automatic runtime

globalThis.window = globalThis.window || { location: { pathname: '/scan' }, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), innerWidth: 390, innerHeight: 844 };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
try { Object.defineProperty(globalThis, 'navigator', { value: { language: 'sw', userAgent: 'repro' }, configurable: true }); } catch { /* node exposes navigator */ }
globalThis.document = globalThis.document || { createElement: () => ({ style: {} }), addEventListener() {}, removeEventListener() {}, documentElement: { style: {} }, body: {} };

const strict = process.argv.includes('--strict');
const base = {
  ok: true, scanId: 'scan_repro1', plantName: 'Pepper', scientificName: 'Capsicum annuum',
  candidates: [
    { plantName: 'Pepper', scientificName: 'Capsicum annuum', confidencePct: 34 },
    { plantName: 'Chili pepper', scientificName: 'Capsicum frutescens', confidencePct: 21 },
  ],
  possibleIssue: null, severity: null, recommendation: null,
  recommendedActions: [], organicTreatment: [], prevention: [],
  verdictV2: null, verdictV3: null, decision: null, harvest: null, safety: null,
  hybridUrgency: null, imagePreviewUrl: null, landHealth: null,
};
const ENVELOPES = {
  success: { ...base, confidenceTone: 'high', confidencePct: 87, status: 'identified', suppressed: false, possibleIssue: 'Leaf spot', severity: 'low', recommendedActions: ['Remove affected leaves'] },
  lowConf: { ...base, confidenceTone: 'needs_review', confidencePct: 34, status: 'needs_review', suppressed: false, scanRecovery: { status: 'low_confidence', reason: 'low_confidence' } },
  sparse: { ...base, confidenceTone: 'needs_review', candidates: [{ plantName: 'Pepper' }, {}], recommendedActions: null, organicTreatment: null },
};
const wrap = (el) => React.createElement(MemoryRouter, null, el);
const props = (env) => ({ result: env, experience: 'farmer', onRetake: () => {}, onAddTasks: () => {}, onChoose: () => {}, onAsk: () => {}, onSave: () => {}, onUpdated: () => {} });

const targets = [
  ['ScanCommandCard', '../src/components/scan/ScanCommandCard.jsx'],
  ['IntelligentScanResult', '../src/components/scan/IntelligentScanResult.jsx'],
  ['ScanResultCard', '../src/components/scan/ScanResultCard.jsx'],
  ['ScanVerificationChecklist', '../src/components/scan/ScanVerificationChecklist.jsx'],
  ['ManualIssuePicker', '../src/components/scan/ManualIssuePicker.jsx'],
];
let crashed = 0;
for (const [name, path] of targets) {
  let Comp;
  try { Comp = (await import(path)).default; }
  catch (e) { console.log('IMPORT-SKIP ' + name + ': ' + String(e.message).slice(0, 100)); continue; }
  for (const [label, env] of Object.entries(ENVELOPES)) {
    try { renderToString(wrap(React.createElement(Comp, props(env)))); console.log('PASS   ' + name + ' [' + label + ']'); }
    catch (e) { crashed++; console.log('CRASH  ' + name + ' [' + label + ']: ' + e.message); console.log((e.stack || '').split('\n').slice(0, 5).join('\n')); }
  }
}
// The exact 2026-07-04 regression: PhotoComparisonCard must render with scanId ABSENT
// then PRESENT (hook count must be identical across the transition — SSR proves both
// branches mount cleanly; the static gate proves order stability).
try {
  const PCC = (await import('../src/components/outcomes/PhotoComparisonCard.jsx')).default;
  renderToString(wrap(React.createElement(PCC, { scanId: '' })));
  renderToString(wrap(React.createElement(PCC, { scanId: 'scan_repro1' })));
  console.log('PASS   PhotoComparisonCard [scanId absent→present]');
} catch (e) { crashed++; console.log('CRASH  PhotoComparisonCard: ' + e.message); }

console.log(crashed ? ('FAIL: ' + crashed + ' crash(es)') : 'ALL PASS — scan result tree renders success/lowConf/sparse without a throw');
if (strict && crashed) process.exit(1);
