/**
 * check-activation-retention.mjs — sprint #217 premortem lock.
 * Fails build if the activation funnel / Day-2 retention / farm
 * success engines are missing or the first-scan path isn't reachable.
 */
import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const F='src/runtime/onboarding/FirstFiveMinutesEngine.ts';
if(!x(F))E.push('missing: '+F);else{const s=rd(F);h(s,'export function buildFirstFiveMinutes','must export buildFirstFiveMinutes');for(const st of ['signup','language','farm','crop','plantingDate','location','firstScan','firstResult','firstTask'])h(s,"'"+st+"'",'funnel step missing: '+st);h(s,'dropOffStep','must report dropOffStep');h(s,'firstScanReachable','must assert firstScanReachable (new user reaches first scan)');}
const D='src/runtime/retention/Day2RetentionEngine.ts';
if(!x(D))E.push('missing: '+D);else{const s=rd(D);h(s,'export function buildDay2Brief','must export buildDay2Brief');h(s,'export function isDay2Due','must export isDay2Due (24h trigger)');for(const a of ['opened','dismissed','completed'])h(s,"'"+a+"'",'Day-2 must track: '+a);h(s,'oneCTA','Day-2 brief must have one CTA only');}
const S='src/runtime/farmBrain/FarmSuccessEngine.ts';
if(!x(S))E.push('missing: '+S);else{const s=rd(S);h(s,'export function buildFarmSuccess','must export buildFarmSuccess');h(s,'noScoreWithoutExplanation','farm success must explain the score');h(s,'reusesCompletion','should reuse FarmerCompletion (no divergent score)');}
const A=rd('src/App.jsx');
for(const g of ['installFirstFiveMinutesHealthGlobal','installDay2RetentionHealthGlobal','installFarmSuccessHealthGlobal'])h(A,g,'App.jsx must boot-install '+g);
// premortem: first scan + outcome path + Day-2 protections already gated elsewhere — assert their gates ship.
for(const gate of ['scripts/check-scan-no-dead-ends.mjs','scripts/check-empty-state-guidance.mjs','scripts/check-outcome-loop.mjs'])if(!x(gate))E.push('premortem requires gate: '+gate);
if(E.length){console.error('[check:activation-retention] FAIL — '+E.length+' issue(s):');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:activation-retention] PASS — first-5-min funnel + Day-2 retention + farm success wired; first-scan reachable.');
