import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const s=rd('src/runtime/scanTrust/FarmBrainIngestionGuard.ts');
if(!s)E.push('missing FarmBrainIngestionGuard.ts');else{h(s,'memoryRejectedReason','§4: must record memoryRejectedReason');h(s,'MEMORY_QUALITY_FLOOR','§4: must enforce a quality floor');h(s,'quality_below_75','§4: must reject quality <75');}
const d=rd('src/runtime/pilot/PilotReadinessDashboard.ts');
if(!d)E.push('missing PilotReadinessDashboard.ts');else{for(const f of ['scanSuccess','farmBrainConfidence','taskCompletion','reviewQueueSize','localizationHealth','trustGateHealth'])h(d,f,'dashboard must expose: '+f);h(d,'__pilotReadinessDashboard','must pin __pilotReadinessDashboard');}
const lc=rd('src/runtime/i18n/LanguageSessionLock.ts');
if(!lc)E.push('missing LanguageSessionLock.ts');else h(lc,'resolveLanguageChange','must export resolveLanguageChange (locale freeze)');
const rl=rd('src/runtime/scanReview/ReviewLifecycleManager.ts');
if(!rl)E.push('missing ReviewLifecycleManager.ts');else{h(rl,'ARCHIVE_AFTER_DAYS','must define 30d archive');h(rl,'DELETE_AFTER_DAYS','must define 60d delete');}
if(E.length){console.error('[check:farmbrain-memory-quality] FAIL');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:farmbrain-memory-quality] PASS — memory quality floor + dashboard + locale lock + review lifecycle.');
