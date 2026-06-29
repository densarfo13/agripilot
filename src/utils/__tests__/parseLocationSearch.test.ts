/**
 * parseLocationSearch.test.ts — locks the Nominatim /search → suggestion mapper.
 * Self-running: `tsx parseLocationSearch.test.ts`. Prints PASS or exits 1.
 */
import { parseLocationSearch } from '../geolocation.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// A realistic "Fred" → Frederick response row.
const sample = [
  {
    display_name: 'Frederick, Frederick County, Maryland, United States',
    lat: '39.4143', lon: '-77.4105',
    address: { city: 'Frederick', county: 'Frederick County', state: 'Maryland', country: 'United States', country_code: 'us' },
  },
  {
    display_name: 'Frederick County, Maryland, United States',
    lat: '39.47', lon: '-77.40',
    address: { county: 'Frederick County', state: 'Maryland', country: 'United States', country_code: 'us' },
  },
];

const out = parseLocationSearch(sample);
ok(out.length === 2, 'maps both rows');
ok(out[0].label.startsWith('Frederick'), 'keeps the display label');
ok(out[0].lat === 39.4143 && out[0].lng === -77.4105, 'parses lat/lng as numbers');
ok(out[0].locality === 'Frederick', 'city → locality');
ok(out[0].region === 'Maryland', 'state → region');
ok(out[0].countryCode === 'US', 'country_code uppercased');
ok(out[1].locality === 'Frederick County', 'falls back to county for locality when no city/town');

// Robustness — bad input never throws, rows without coords are dropped.
ok(parseLocationSearch(null).length === 0, 'null → []');
ok(parseLocationSearch(undefined as any).length === 0, 'undefined → []');
ok(parseLocationSearch('nope' as any).length === 0, 'non-array → []');
ok(parseLocationSearch([{ display_name: 'no coords' }]).length === 0, 'row without lat/lon dropped');
ok(parseLocationSearch([{ lat: 'x', lon: 'y', display_name: 'bad' }]).length === 0, 'non-numeric coords dropped');
ok(parseLocationSearch([{ lat: '1', lon: '2' }])[0].country === null, 'missing address → null fields, still mapped');

console.log('[parseLocationSearch] PASS — ' + passed + ' assertions. Nominatim search rows map to '
  + '{label,lat,lng,country,region,locality}; coordless/bad rows dropped; never throws.');
