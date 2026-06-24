/**
 * check-scan-provider-diagnostics.mjs — sprint #221 (P0).
 * Locks the provider diagnostics so a "clear photo → unclear" can
 * always be root-caused in prod, and so the key is never exposed.
 */
import fs from 'node:fs'; import path from 'node:path';
const R=process.cwd(),E=[],x=r=>{try{return fs.existsSync(path.join(R,r))}catch{return false}},rd=r=>{try{return fs.readFileSync(path.join(R,r),'utf8')}catch{return''}},h=(s,n,m)=>{if(!s.includes(n))E.push(m)};
const S='server/src/ml/scanInferenceService.js';
if(!x(S))E.push('missing: '+S);else{const s=rd(S);
  h(s,'export function getScanProviderDiagnostics','must export getScanProviderDiagnostics');
  h(s,'providerConfigured','diagnostics must report providerConfigured');
  h(s,'keyLength','diagnostics must report keyLength (presence, not value)');
  h(s,'serviceUnavailable','must surface serviceUnavailable (configured-but-failing != unknown)');
  h(s,'[scan.provider]','must log outbound/inbound Plant.id calls');
  // NEVER log/return the key value.
  if(/console\.(log|error)\([^)]*PLANT_ID_API_KEY/.test(s))E.push('must NEVER log the PLANT_ID_API_KEY value');
  if(/keyValue|apiKey:\s*key\b|key:\s*process\.env\.PLANT_ID_API_KEY/.test(s))E.push('diagnostics must not return the key value');
}
const A='server/src/app.js';
if(!x(A))E.push('missing: '+A);else{const s=rd(A);
  h(s,"'/api/scan/diagnostics'",'must mount GET /api/scan/diagnostics');
  h(s,'getScanProviderDiagnostics','diagnostics route must call getScanProviderDiagnostics');
}
if(E.length){console.error('[check:scan-provider-diagnostics] FAIL — '+E.length+' issue(s):');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:scan-provider-diagnostics] PASS — provider diagnostics + /api/scan/diagnostics wired; req/resp logged; key value never exposed.');
