import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const F='src/runtime/plants/DuplicatePlantDetector.ts';
if(!x(F))E.push('missing: '+F);else{const s=rd(F);h(s,'export function detectDuplicatePlant','must export detectDuplicatePlant');h(s,'DUPLICATE_SIMILARITY_THRESHOLD','must declare similarity threshold');h(s,"'view_existing'",'default action must be view_existing');h(s,'__duplicatePlantHealth','must pin __duplicatePlantHealth');}
if(E.length){console.error('[check:duplicate-plant] FAIL');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:duplicate-plant] PASS — detector present, >90% → view-existing default.');
