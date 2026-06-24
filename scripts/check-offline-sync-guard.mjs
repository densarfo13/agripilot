import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const F='src/runtime/offline/OfflineSyncGuardian.ts';
if(!x(F))E.push('missing: '+F);else{const s=rd(F);h(s,'export function makeIdempotencyKey','must export makeIdempotencyKey');h(s,'export function isDuplicateSync','must export isDuplicateSync');h(s,'__offlineSyncHealth','must pin __offlineSyncHealth');}
if(E.length){console.error('[check:offline-sync-guard] FAIL');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:offline-sync-guard] PASS — idempotency guardian present.');
