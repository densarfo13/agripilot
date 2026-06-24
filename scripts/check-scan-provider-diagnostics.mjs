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
  h(s,'export async function pingScanProvider','must export pingScanProvider (real provider health check)');
  h(s,'providerConfigured','diagnostics must report providerConfigured');
  h(s,'keyLength','diagnostics must report keyLength (presence, not value)');
  h(s,'serviceUnavailable','must surface serviceUnavailable (configured-but-failing != unknown)');
  h(s,'[scan.provider]','must log outbound/inbound Plant.id calls');
  // #221b — the root cause was an env-var NAME mismatch; both accepted
  // names must be read (alias) AND reported separately so it can't recur.
  h(s,'process.env.PLANT_API_KEY','must accept PLANT_API_KEY as an alias for PLANT_ID_API_KEY');
  h(s,'plantIdApiKeyLength','diagnostics must report plantIdApiKeyLength (canonical name)');
  h(s,'plantApiKeyLength','diagnostics must report plantApiKeyLength (alias name)');
  h(s,'envVarUsed','diagnostics must report which env var name resolved');
  h(s,'keyFingerprint','diagnostics must report a 6-char key fingerprint (compare vs Kindwise)');
  h(s,'usage_info','pingScanProvider must validate the key without consuming identification credits');
  // NEVER log/return the key VALUE. Fingerprint slice(0, 6) is allowed.
  if(/keyValue|fullKey|apiKey:\s*key\b/.test(s))E.push('diagnostics must not return the raw key value');
  if(!/slice\(0,\s*6\)/.test(s))E.push('fingerprint must be the first 6 chars only (slice(0, 6))');
}
const A='server/src/app.js';
if(!x(A))E.push('missing: '+A);else{const s=rd(A);
  h(s,"'/api/scan/diagnostics'",'must mount GET /api/scan/diagnostics');
  h(s,'getScanProviderDiagnostics','diagnostics route must call getScanProviderDiagnostics');
  h(s,'pingScanProvider','diagnostics route must wire the live provider ping (?live=1)');
  h(s,'keyFingerprint','diagnostics route must surface keyFingerprint');
}
if(E.length){console.error('[check:scan-provider-diagnostics] FAIL — '+E.length+' issue(s):');for(const e of E)console.error('  - '+e);process.exit(1)}
console.log('[check:scan-provider-diagnostics] PASS — provider diagnostics + /api/scan/diagnostics wired; req/resp logged; key value never exposed.');
