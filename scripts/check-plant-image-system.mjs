#!/usr/bin/env node
/**
 * check-plant-image-system.mjs — Real Plant Image System gate.
 *
 *   node scripts/check-plant-image-system.mjs
 *
 * Verifies the Real Plant Image System is complete:
 *   1. PlantImageRegistry.ts + PlantImageService.ts exist
 *   2. Required exports on each
 *   3. 4-tier fallback constants (verified / plant_library /
 *      scan / placeholder)
 *   4. ManagedPlant interface declares the 3 image fields
 *      (imageUrl, thumbnailUrl, galleryImages)
 *   5. PlantImage.jsx component exists with `loading="lazy"`
 *      + `decoding="async"` + responsive srcSet
 *   6. The 4 spec'd consumer surfaces import PlantImage:
 *      MyPlants, PlantProfile, AddPlantConfirmationCard,
 *      PlantIntelligenceCard
 *   7. Production-mode cartoon block is enforced
 *   8. Barrel re-exports image registry + service
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:plant-image-system]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

const FILES = {
  registry:     'src/runtime/plants/images/PlantImageRegistry.ts',
  service:      'src/runtime/plants/images/PlantImageService.ts',
  component:    'src/components/plants/PlantImage.jsx',
  runtime:      'src/runtime/plants/PlantRuntime.ts',
  barrel:       'src/runtime/plants/index.ts',
  myPlants:     'src/pages/MyPlants.jsx',
  plantProfile: 'src/pages/PlantProfile.jsx',
  confirmCard:  'src/components/plants/AddPlantConfirmationCard.jsx',
  intelCard:    'src/components/plants/PlantIntelligenceCard.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'registry', sym: 'resolvePlantImage' },
  { src: 'registry', sym: 'registerVerifiedImage' },
  { src: 'registry', sym: 'clearVerifiedImage' },
  { src: 'registry', sym: 'listVerifiedPlants' },
  { src: 'registry', sym: 'IMAGE_SOURCE' },
  { src: 'registry', sym: 'PLACEHOLDER_DATA_URI' },
  { src: 'registry', sym: 'PLANT_IMAGE_REGISTRY_VERSION' },
  { src: 'service',  sym: 'buildResponsiveSet' },
  { src: 'service',  sym: 'optimizeForWidth' },
  { src: 'service',  sym: 'thumbnailUrl' },
  { src: 'service',  sym: 'blockedInProduction' },
  { src: 'service',  sym: 'RESPONSIVE_WIDTHS' },
  { src: 'service',  sym: 'DEFAULT_SIZES' },
  { src: 'service',  sym: 'PLANT_IMAGE_SERVICE_VERSION' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// IMAGE_SOURCE — 4 spec'd tiers
const TIERS = ['VERIFIED', 'PLANT_LIBRARY', 'SCAN', 'PLACEHOLDER'];
for (const t of TIERS) {
  if (!new RegExp(t + '\\s*:').test(sources.registry)) {
    fail('IMAGE_SOURCE missing tier: ' + t);
  }
}

// ManagedPlant interface — 3 spec'd image fields
const IMG_FIELDS = ['imageUrl', 'thumbnailUrl', 'galleryImages'];
for (const f of IMG_FIELDS) {
  if (!new RegExp('\\b' + f + '\\?:').test(sources.runtime)) {
    fail('ManagedPlant interface missing image field: ' + f);
  }
}

// PlantImage component contract
if (!/loading="lazy"|loading:\s*'lazy'/.test(sources.component)) {
  fail('PlantImage.jsx must declare loading="lazy"');
}
if (!/decoding="async"|decoding:\s*'async'/.test(sources.component)) {
  fail('PlantImage.jsx must declare decoding="async"');
}
if (sources.component.indexOf('srcSet') === -1) {
  fail('PlantImage.jsx must use responsive srcSet');
}
if (sources.component.indexOf('PLACEHOLDER_DATA_URI') === -1) {
  fail('PlantImage.jsx must fall through to PLACEHOLDER_DATA_URI');
}
if (sources.component.indexOf('blockedInProduction') === -1
    && sources.component.indexOf('set.blocked') === -1) {
  fail('PlantImage.jsx must enforce the production-mode block');
}

// Production-mode cartoon block enforcement in the service
const CARTOON_KEYWORDS = ['cartoon', 'illustration', 'sketch'];
for (const k of CARTOON_KEYWORDS) {
  if (sources.service.indexOf(k) === -1) {
    fail('PlantImageService.ts must block "' + k
      + '" in production mode');
  }
}
if (!/process\.env\.NODE_ENV\s*===?\s*['"]production['"]/.test(sources.service)) {
  fail('PlantImageService.ts must check NODE_ENV === "production"');
}

// 4 consumer surfaces must import PlantImage
const CONSUMERS = [
  { src: 'myPlants',     name: 'MyPlants' },
  { src: 'plantProfile', name: 'PlantProfile' },
  { src: 'confirmCard',  name: 'AddPlantConfirmationCard' },
  { src: 'intelCard',    name: 'PlantIntelligenceCard' },
];
for (const c of CONSUMERS) {
  if (!/import\s+PlantImage\s+from/.test(sources[c.src])) {
    fail(c.name + ' must import PlantImage');
  }
  if (sources[c.src].indexOf('<PlantImage') === -1) {
    fail(c.name + ' must render <PlantImage>');
  }
}

// Barrel re-exports
if (sources.barrel.indexOf('PlantImageRegistry') === -1
    || sources.barrel.indexOf('PlantImageService') === -1) {
  fail('runtime/plants barrel must re-export image registry + service');
}

console.log(HEADER, 'PASS — Real Plant Image System complete.');
console.log('  Registry + Service + Component + ManagedPlant fields wired.');
console.log('  4-tier fallback (verified/library/scan/placeholder) · '
  + 'responsive srcSet · lazy-loading · async decoding · '
  + 'production-mode cartoon block enforced.');
console.log('  4 consumer surfaces (MyPlants · PlantProfile · '
  + 'AddPlantConfirmationCard · PlantIntelligenceCard) all render '
  + '<PlantImage>.');
process.exit(0);
