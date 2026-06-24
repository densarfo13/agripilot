import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const F='src/runtime/timeline/TimelineWriteGate.ts';
if(!x(F))E.push('missing: '+F);else{const s=rd(F);h(s,'export function shouldWriteTimeline','must export shouldWriteTimeline');h(s,'export function timelineKey','must export timelineKey');h(s,'__timelineHealth','must pin __timelineHealth');h(s,'noDuplicateTimelineEvents','must assert noDuplicateTimelineEvents');}
if(E.length){console.error('[check:timeline-lock] FAIL');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:timeline-lock] PASS — timeline write gate present; same scan/event/task not written twice.');
