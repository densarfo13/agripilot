#!/usr/bin/env node
/**
 * backfill-hindi.mjs — surgical Hindi backfill for the highest-
 * traffic farmer-facing keys.
 *
 * Translations are produced with working Hindi proficiency. Quality
 * is "reasonable approximation" — short, action-first, farmer-
 * friendly. Better than English bleed; not a substitute for a
 * native-speaker translator pass.
 *
 * The transform is line-based so {n}-style interpolation placeholders
 * inside values don't trip a brace-counting regex (lesson learned
 * from a previous failed attempt).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FILE = path.join(ROOT, 'src/i18n/translations.js');

const HI = {
  // offline.*
  'offline.showingCached':            'ऑफ़लाइन — आपके सहेजे गए कार्य दिख रहे हैं',
  'offline.syncOnReconnect':          'दोबारा कनेक्ट होने पर बदलाव सिंक होंगे',
  'offline.rightNow':                 'आप अभी ऑफ़लाइन हैं',
  'offline.stillOffline':             'आप अब भी ऑफ़लाइन हैं',
  'offline.stillOfflineShort':        'ऑफ़लाइन',
  'offline.tryAgain':                 'फिर से कोशिश करें',
  'offline.retrying':                 'फिर से कोशिश की जा रही है…',
  'offline.lastSaved':                'अंतिम सहेजे गए कार्य',
  'offline.fallback.title':           'आज अपना खेत देखें',
  'offline.fallback.why':             'हम नवीनतम कार्य लोड नहीं कर सके',
  'offline.fallback.next':            'मार्गदर्शन अपडेट करने के लिए दोबारा कनेक्ट करें',
  'offline.connection':               'कनेक्शन',
  'offline.lastSavedOnline':          'अंतिम बार ऑनलाइन सहेजा गया',
  'offline.notYet':                   'अभी नहीं',
  'offline.fallback.land_rest.title': 'आराम करें और अगली फसल की योजना बनाएँ',
  'offline.fallback.land_rest.why':   'आपकी ज़मीन आराम पर है — यही योजना का समय है',
  'offline.fallback.land_rest.next':  'चुनें कि अगला क्या और कब बोना है',
  'offline.fallback.land_prep.title': 'रोपण के लिए ज़मीन तैयार करें',
  'offline.fallback.land_prep.why':   'अच्छी मिट्टी की तैयारी मज़बूत मौसम बनाती है',
  'offline.fallback.land_prep.next':  'मलबा हटाएँ और मिट्टी की नमी जाँचें',
  'offline.fallback.maize_scout.title':'अपने मक्के के खेत की जाँच करें',
  'offline.fallback.maize_scout.why':  'मुख्य उगाने का समय — कीट तेज़ी से फैलते हैं',
  'offline.fallback.maize_scout.next': 'पंक्तियों में चलें, पत्तियों को देखें',
  'offline.fallback.rice_water.title': 'धान के पानी का स्तर जाँचें',
  'offline.fallback.rice_water.why':   'मानसून के दौरान पानी प्रबंधन सबसे ज़रूरी है',
  'offline.fallback.rice_water.next':  'बढ़ने के दौरान मिट्टी से 2–5 सेमी ऊपर पानी रखें',
  'offline.fallback.root_weed.title':  'जड़ वाली फसलों के पास निराई करें',
  'offline.fallback.root_weed.why':    'खरपतवार पूरे साल कंद से पोषक तत्व चुराते हैं',
  'offline.fallback.root_weed.next':   'खरपतवार साफ़ करें, जड़ के पास मिट्टी ढीली करें',
  'offline.savedLocally':             'ऑफ़लाइन — आपका काम स्थानीय रूप से सहेजा गया है',
  'offline.pendingSync':              '{count} सिंक के लिए लंबित बदलाव',
  'offline.willSync':                 'दोबारा कनेक्ट होने पर बदलाव अपने आप सिंक होंगे',
  'offline.syncing':                  'सिंक हो रहा है…',
  'offline.synced':                   'सभी बदलाव सिंक हो गए',
  'offline.failed':                   'सिंक विफल। आपका डेटा स्थानीय रूप से सुरक्षित है।',
  'offline.banner.offline':           'ऑफ़लाइन — बदलाव कतार में हैं',
  'offline.banner.syncing':           'सिंक हो रहा है…',
  'offline.banner.synced':            'सब सिंक हो गया',
  'offline.banner.failed':            'कुछ सिंक विफल — फिर से करने के लिए टैप करें',
  'offline.banner.retry':             'फिर से करें',

  // status.*
  'status.online':              'ऑनलाइन',
  'status.offline':             'ऑफ़लाइन',
  'status.profile':             'प्रोफ़ाइल',
  'status.cropStage':           'फसल का चरण',
  'status.tasks':               'कार्य',
  'status.activity':            'गतिविधि',
  'status.goodDesc':            'सब कुछ सही दिशा में है।',
  'status.onTrack':             'सही रास्ते पर',
  'status.onTrackDesc':         'लगभग सब कुछ अद्यतन है।',
  'status.almostReady':         'लगभग तैयार',
  'status.almostReadyDesc':     'कुछ चीज़ों पर ध्यान देने की ज़रूरत है।',
  'status.needsWork':           'ध्यान चाहिए',
  'status.needsWorkDesc':       'कई वस्तुओं को अद्यतन करने की ज़रूरत है।',

  // mode.*
  'mode.simple':                'आसान',
  'mode.full':                  'पूर्ण',
  'mode.basic':                 'सरल',
  'mode.standard':              'मानक',
  'mode.advanced':              'उन्नत',
  'mode.switchToBasic':         'सरल दृश्य पर जाएँ',
  'mode.switchToStandard':      'मानक दृश्य पर जाएँ',

  // stage.*
  'stage.planting':             'रोपण',
  'stage.flowering':            'फूल आना',
  'stage.growing':              'बढ़ रहा है',
  'stage.harvest':              'कटाई',
  'stage.harvesting':           'कटाई हो रही है',
  'stage.prePlanting':          'रोपण-पूर्व',
  'stage.vegetative':           'वानस्पतिक',
  'stage.postHarvest':          'कटाई के बाद',
  'stage.seedling':             'अंकुर',
  'stage.fruiting':             'फल आना',
  'stage.maturity':             'परिपक्वता',

  // location.*
  'location.detecting':         'स्थान का पता लगाया जा रहा है…',
  'location.farmLocation':      'खेत का स्थान',
  'location.captured':          'स्थान कैप्चर हो गया',
  'location.capturedCheck':     'स्थान सहेज लिया गया ✅',

  // farmerId.*
  'farmerId.copied':            'नकल कर ली गई',

  // common.*
  'common.stepN':               'चरण {n}',
};

const dry = process.argv.includes('--dry');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
let added = 0;
let skipped = 0;
const missing = [];

function findKeyLine(key) {
  // Match `  'key': {` exactly (with optional whitespace).
  const target = `'${key}':`;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(target)) return i;
  }
  return -1;
}

function patchLine(line, hiValue) {
  // If the line already has `hi:`, leave it.
  if (/\bhi\s*:/.test(line)) return null;
  // Insert `hi: '<value>',` before the closing `}` on this line.
  // Single-line entries match `... },` or `... }`.
  const safe = hiValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const insertion = ` hi: '${safe}',`;
  // Try to insert before `}` keeping prior comma if present.
  const m = line.match(/^(.*?)(\s*\},?\s*)$/);
  if (!m) return null;
  // Ensure the existing content ends with a comma before our addition.
  let head = m[1];
  if (!/,\s*$/.test(head)) head = head.replace(/\s*$/, ',');
  return head + insertion + m[2];
}

function patchMultilineValueLine(line, hiValue) {
  if (/\bhi\s*:/.test(line)) return null;
  const safe = hiValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // Build the new field. Always emit a comma between existing
  // content and the new field, and always end with a comma so the
  // next translator can append further keys cleanly.
  const m = line.match(/^(.*?)(,?\s*)$/);
  const head = m ? m[1] : line;
  return head + `, hi: '${safe}',`;
}

for (const [key, hi] of Object.entries(HI)) {
  const idx = findKeyLine(key);
  if (idx === -1) { missing.push(key); continue; }
  const line = lines[idx];
  // Single-line entry: `'key': { en: 'X', fr: 'Y', ... },`
  if (line.includes('}')) {
    const next = patchLine(line, hi);
    if (next == null) { skipped += 1; continue; }
    lines[idx] = next;
    added += 1;
    continue;
  }
  // Multi-line entry: `'key': {` then values on idx+1 then `},` on idx+2
  // (or further). The values line is the next line that contains `:`
  // and ends with `,` (or before the `}` closer).
  let valIdx = idx + 1;
  while (valIdx < lines.length && !/\}/.test(lines[valIdx])) {
    if (/:/.test(lines[valIdx])) break;
    valIdx += 1;
  }
  if (valIdx >= lines.length) { skipped += 1; continue; }
  if (/\bhi\s*:/.test(lines[valIdx])) { skipped += 1; continue; }
  const next = patchMultilineValueLine(lines[valIdx], hi);
  if (next == null) { skipped += 1; continue; }
  lines[valIdx] = next;
  added += 1;
}

if (!dry) fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log(`backfill-hindi: ${dry ? 'DRY-RUN' : 'APPLIED'}`);
console.log(`  added: ${added}, already-had-hi or skipped: ${skipped}, key-not-found: ${missing.length}`);
if (missing.length) {
  console.log('\n  Keys not located in translations.js (skipped):');
  for (const k of missing) console.log(`    ${k}`);
}
