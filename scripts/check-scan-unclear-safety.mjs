/**
 * check-scan-unclear-safety.mjs — sprint #219.
 * The two invariants the bug requires:
 *   (1) plant unknown  → Create Task NOT shown.
 *   (2) scan unclear   → a failure explanation IS rendered.
 * Plus the __scanDebug trace must exist + be wired.
 */
import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};

// __scanDebug trace (full forensic shape, sprint #220)
const D='src/runtime/scanDebug/ScanDebugRuntime.ts';
if(!x(D))E.push('missing: '+D);else{const s=rd(D);h(s,'export function recordScanDebug','must export recordScanDebug');h(s,'__scanDebug','must pin __scanDebug');for(const f of ['imageId','imageQuality','photoQuality','providerStatus','providerLatency','candidates','topCandidate','confidence','mythosDecision','trustGate','reviewQueueDecision','uiDecision','failureReason'])h(s,f,'__scanDebug output must include: '+f);h(s,'provider_unconfigured_or_unavailable','must distinguish provider-unconfigured failure');}

// P0 #220 — the two ungated result cards must gate Create Task on
// canCreateTask (plant known + confidence>=70 + diagnosis known).
for(const f of ['src/components/scan/UsefulResultCard.jsx','src/components/scan/ScanResultCard.jsx']){
  if(!x(f)){E.push('missing: '+f);continue;}
  const s=rd(f);
  h(s,'canCreateTask','INVARIANT 1: '+f+' must compute canCreateTask before showing a task button');
  if(!/>=\s*70/.test(s))E.push('INVARIANT 1: '+f+' canCreateTask must require confidence >= 70');
}
h(rd('src/components/scan/UsefulResultCard.jsx'),'useful-result-unidentified',
  'INVARIANT 2: UsefulResultCard must render the unidentified explanation when canCreateTask is false');
h(rd('src/core/scanDetectionEngine.js'),'_recordScanDebugSafe','scanDetectionEngine must capture the scan-debug trace');
h(rd('src/App.jsx'),'installScanDebugGlobal','App.jsx must boot-install __scanDebug');

// (1) Create Task gated on trust gate (plant unknown → no task)
const UI='src/components/scan/IntelligentScanResult.jsx';
if(!x(UI))E.push('missing: '+UI);else{const s=rd(UI);
  if(!/_trust\s*&&\s*_trust\.allowTaskCreation\s*\?/.test(s))E.push('INVARIANT 1: Create Task must be gated on _trust.allowTaskCreation (plant unknown → no task)');
  if(!/_trust\s*&&\s*_trust\.allowPlantCreation\s*\?/.test(s))E.push('INVARIANT 1: Save Plant must be gated on _trust.allowPlantCreation');
  // (2) scan unclear → explanation rendered (the coach card on block)
  h(s,'scan-photo-coach-card','INVARIANT 2: a failure explanation (coach card) must render when blocked');
  h(s,'_trustBlocked','INVARIANT 2: must branch on _trustBlocked to show the explanation');
}
// The composer's "Scan unclear" is only reachable with empty candidates —
// assert the honest fallback still carries limitations (an explanation).
// The composer's "Scan unclear" floor is the internal non-empty plant
// token (also asserted by check-scan-mythos / no-dead-ends / the server
// envelope). The FARMER-facing fix is structural: no Create Task for an
// unidentified scan + the unidentified explanation block. Assert the
// composer floor still carries limitations (an explanation), so the
// fallback is never a bare label.
const C='src/runtime/scanMythos/ScanDecisionComposer.ts';
if(x(C)){const s=rd(C);
  if(s.includes("plant: 'Scan unclear'") && !s.includes('limitations:'))E.push('INVARIANT 2: unidentified fallback must carry limitations (explanation)');
}

if(E.length){console.error('[check:scan-unclear-safety] FAIL — '+E.length+' issue(s):');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:scan-unclear-safety] PASS — __scanDebug wired; plant-unknown→no-task; scan-unclear→explanation rendered.');
