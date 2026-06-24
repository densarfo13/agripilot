/**
 * check-farm-os.mjs — sprint #216 §14. Locks the 5 Farm OS composites.
 */
import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
// §1 lifecycle — 11 states + no-state-no-rec
const L='src/runtime/farm/FarmLifecycleEngine.ts';
if(!x(L))E.push('missing: '+L);else{const s=rd(L);h(s,'export function resolveFarmState','must export resolveFarmState');h(s,'export function canRecommend','§1: must export canRecommend (no state → no recommendation)');h(s,'noStateNoRecommendation','must assert noStateNoRecommendation');for(const st of ['CREATED','ONBOARDED','CROP_SELECTED','PLANTED','ACTIVE_GROWTH','FLOWERING','FRUITING','HARVEST_READY','HARVESTED','POST_HARVEST','INACTIVE'])h(s,"'"+st+"'",'lifecycle state missing: '+st);}
// §2 orchestrator — one action today
const O='src/runtime/tasks/TaskOrchestrator.ts';
if(!x(O))E.push('missing: '+O);else{const s=rd(O);h(s,'export function orchestrateTasks','must export orchestrateTasks');h(s,'oneActionToday','§2: must guarantee one action today');h(s,'neverShowsAllTasks','§2: must not show all tasks');}
// §8 trust score — satellite excluded
const T='src/runtime/trust/RecommendationTrustScore.ts';
if(!x(T))E.push('missing: '+T);else{const s=rd(T);h(s,'export function buildRecommendationTrustScore','must export buildRecommendationTrustScore');h(s,'satelliteExcluded','§8: satellite must be excluded');h(s,'satelliteConfidence: null','§8: satelliteConfidence must be null (frozen, never a number)');}
// §9 grower memory
const G='src/runtime/grower/GrowerMemoryEngine.ts';
if(!x(G))E.push('missing: '+G);else{const s=rd(G);h(s,'export function buildGrowerMemory','must export buildGrowerMemory');h(s,'noPII','§9: must assert noPII');}
// §7 expert review — over the #214 queue
const Ex='src/runtime/scanReview/ExpertReviewEngine.ts';
if(!x(Ex))E.push('missing: '+Ex);else{const s=rd(Ex);for(const a of ['assignReview','commentReview','approveReview','rejectReview','promoteToPlant'])h(s,'export function '+a,'§7: must export '+a);}
// boot installs
const A=rd('src/App.jsx');
for(const g of ['installFarmLifecycleHealthGlobal','installTaskOrchestratorHealthGlobal','installRecommendationTrustHealthGlobal','installGrowerMemoryHealthGlobal','installExpertReviewHealthGlobal'])h(A,g,'App.jsx must boot-install '+g);
// §6 satellite stays the UNCONFIGURED stub (NOT activated)
const sat=rd('src/runtime/farmBrain/SatelliteCorrelationEngine.ts');
if(sat && !sat.includes('UNCONFIGURED'))E.push('§6: satellite must remain UNCONFIGURED (frozen; not activated)');
if(E.length){console.error('[check:farm-os] FAIL — '+E.length+' issue(s):');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:farm-os] PASS — lifecycle(11) + orchestrator(1-today) + trust(no-satellite) + grower-memory + expert-review; satellite still UNCONFIGURED.');
