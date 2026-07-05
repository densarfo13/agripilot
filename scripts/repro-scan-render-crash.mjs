// repro-scan-render-crash.mjs — STEP 14 reproduction harness.
// Renders every scan-result component server-side with the PRODUCTION-shaped envelope
// (plant.id 200, candidates=2, conf=low — from Railway logs 2026-07-04T21:17:38Z).
// A throw here IS the production crash, with the exact component + stack.
import React from 'react';
import { renderToString } from 'react-dom/server';
globalThis.React = React; // tsx classic-JSX shim; the app itself uses Vite automatic runtime

// Minimal browser shims so components can import (tSafe/localStorage/window guards).
globalThis.window = globalThis.window || { location: { pathname: '/scan' }, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), navigator: {}, innerWidth: 390, innerHeight: 844 };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
try { Object.defineProperty(globalThis, 'navigator', { value: { language: 'sw', userAgent: 'repro' }, configurable: true }); } catch { /* node ≥21 exposes navigator; leave it */ }
globalThis.document = globalThis.document || { createElement: () => ({ style: {} }), addEventListener() {}, removeEventListener() {}, documentElement: { style: {} }, body: {} };

// Production-shaped envelope: low confidence, 2 candidates, health module sparse.
const lowConf = {
  ok: true, scanId: 'scan_repro1', plantName: 'Pepper', scientificName: 'Capsicum annuum',
  confidenceTone: 'needs_review', confidencePct: 34, status: 'needs_review', suppressed: false,
  candidates: [
    { plantName: 'Pepper', scientificName: 'Capsicum annuum', confidencePct: 34 },
    { plantName: 'Chili pepper', scientificName: 'Capsicum frutescens', confidencePct: 21 },
  ],
  possibleIssue: null, severity: null, recommendation: null,
  recommendedActions: [], organicTreatment: [], prevention: [],
  scanRecovery: { status: 'low_confidence', reason: 'low_confidence' },
  verdictV2: null, verdictV3: null, decision: null, harvest: null, safety: null,
  hybridUrgency: null, imagePreviewUrl: null, landHealth: null,
};
// Variant with sparse candidates (missing confidencePct/sciName) + null arrays.
const sparse = { ...lowConf, candidates: [{ plantName: 'Pepper' }, {}], recommendedActions: null, organicTreatment: null };

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
  catch (e) { console.log('IMPORT-SKIP ' + name + ': ' + String(e.message).slice(0, 120)); continue; }
  for (const [label, env] of [['lowConf', lowConf], ['sparse', sparse]]) {
    try {
      renderToString(React.createElement(Comp, { result: env, experience: 'farmer', onRetake: () => {}, onAddTasks: () => {}, onChoose: () => {}, onAsk: () => {}, onSave: () => {} }));
      console.log('PASS   ' + name + ' [' + label + ']');
    } catch (e) {
      crashed++;
      console.log('CRASH  ' + name + ' [' + label + ']: ' + e.message);
      console.log((e.stack || '').split('\n').slice(0, 6).join('\n'));
    }
  }
}
console.log(crashed ? ('REPRODUCED: ' + crashed + ' crash(es)') : 'NO CRASH in harness (shape differs or import-skipped target)');
