/**
 * geolocationHttpProvider.test.ts — locks the mixed-content fix in detectCountryByIP.
 * Self-running: `tsx geolocationHttpProvider.test.ts`. Prints PASS or exits 1.
 *
 * Bug: the free ip-api.com provider is HTTP-only, so on the HTTPS production origin the
 * fetch was blocked as mixed content and always failed. _httpProviderAllowed gates it to
 * http:// origins only, so HTTPS pages go straight to the HTTPS providers.
 */
import { _httpProviderAllowed } from '../geolocation.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// THE FIX: on an HTTPS page the HTTP provider must NOT be attempted (it can only fail).
ok(_httpProviderAllowed('https:') === false, "https: → HTTP provider BLOCKED (no mixed-content fetch on production)");
// Local dev over http:// may still use it.
ok(_httpProviderAllowed('http:') === true, "http: → HTTP provider allowed (local dev)");
// Unknown / non-browser context → never issue an insecure request.
ok(_httpProviderAllowed(undefined as any) === false, "undefined protocol → blocked");
ok(_httpProviderAllowed(null as any) === false, "null protocol → blocked");
ok(_httpProviderAllowed('') === false, "empty protocol → blocked");
ok(_httpProviderAllowed('file:') === false, "file: → blocked");
ok(_httpProviderAllowed('HTTP:' as any) === false, "case-sensitive: 'HTTP:' is not the http: protocol literal");

console.log('[geolocationHttpProvider] PASS — ' + passed + ' assertions. The HTTP-only ip-api provider is only '
  + 'attempted on http:// origins; an HTTPS page never issues the mixed-content-blocked request.');
