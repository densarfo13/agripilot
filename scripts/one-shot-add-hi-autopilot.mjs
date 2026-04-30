#!/usr/bin/env node
/**
 * one-shot-add-hi-autopilot.mjs
 *
 * One-time fix: insert a `hi:` value into every why.* / risk.* /
 * timing.* entry in src/i18n/translations.js that currently lacks
 * Hindi. Pilot screenshots showed Hindi UI leaking English on
 * autopilot why/risk/timing lines because each of these 85 keys
 * had en/fr/sw/ha/tw values but no hi value.
 *
 * Run once, review the diff, delete this script.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', 'src', 'i18n', 'translations.js');

const HI = {
  // risk severity badges
  'risk.low':                          'कम जोखिम',
  'risk.moderate':                     'मध्यम',
  'risk.high':                         'उच्च जोखिम',
  'risk.urgent':                       'तत्काल',

  // why.*
  'why.drying.preventMold':            'फफूँदी से बचने के लिए अभी अनाज सुखाएँ।',
  'why.rain.avoidDamage':              'बारिश से पहले फसल की रक्षा करें।',
  'why.rain.protectBeforeDry':         'फसल ढक दें — बारिश हो रही है।',
  'why.water.reduceCropStress':        'फसल का तनाव कम करने के लिए आज पानी दें।',
  'why.water.supportGrowth':           'स्वस्थ विकास के लिए फसल को पानी दें।',
  'why.pest.catchEarly':               'फैलाव रोकने के लिए कीट जल्दी जाँचें।',
  'why.spray.protectCrop':             'अपनी फसल बचाने के लिए छिड़काव करें।',
  'why.fertilize.boostNutrients':      'पोषण बढ़ाने के लिए अभी खाद डालें।',
  'why.harvest.beforeRain':            'बारिश शुरू होने से पहले अभी कटाई करें।',
  'why.harvest.preserveQuality':       'गुणवत्ता बनाए रखने के लिए अभी कटाई करें।',
  'why.plant.rightTiming':             'सही समय पर अभी रोपण करें।',
  'why.landPrep.readySoil':            'रोपण के लिए मिट्टी तैयार करें।',
  'why.sort.betterPrice':              'बेहतर कीमत के लिए उपज छाँटें।',
  'why.store.preventLoss':             'नुकसान से बचने के लिए सही ढंग से भंडारण करें।',

  // risk.* generic
  'risk.drying.spoilageIfDelayed':     'जोखिम: नम रहने पर फसल खराब हो सकती है।',
  'risk.rain.uncoveredHarvest':        'जोखिम: बारिश खुले अनाज को नुकसान पहुँचा सकती है।',
  'risk.rain.dampHarvest':             'जोखिम: बारिश से फसल नम हो जाएगी।',
  'risk.water.yieldDropIfDry':         'जोखिम: सूखी रहने पर पैदावार घट सकती है।',
  'risk.water.stuntedGrowth':          'जोखिम: पानी के बिना विकास धीमा हो सकता है।',
  'risk.pest.spreadFast':              'जोखिम: कीट जल्दी फैल सकते हैं।',
  'risk.spray.driftInWind':            'जोखिम: हवा छिड़काव को बहा सकती है।',
  'risk.spray.damageSpread':           'जोखिम: उपचार के बिना नुकसान फैल सकता है।',
  'risk.fertilize.poorGrowth':         'जोखिम: पोषण के बिना विकास खराब होगा।',
  'risk.harvest.rainDamage':           'जोखिम: बारिश खेत में फसल को नुकसान पहुँचा सकती है।',
  'risk.harvest.overRipening':         'जोखिम: छोड़ने पर फसल अधिक पक सकती है।',
  'risk.plant.missWindow':             'जोखिम: रोपण का समय बंद हो सकता है।',
  'risk.landPrep.delayedPlanting':     'जोखिम: मिट्टी तैयार न होने पर रोपण में देरी होगी।',
  'risk.sort.qualityLoss':             'जोखिम: बिना छाँटी उपज मूल्य खो देती है।',
  'risk.store.postHarvestLoss':        'जोखिम: खराब भंडारण से नुकसान होता है।',

  // risk.* per-crop
  'risk.cassava.whitefly_mosaic':      'सफ़ेद मक्खी और कसावा मोज़ेक वायरस से सावधान रहें।',
  'risk.cassava.root_rot':             'जड़ सड़न जोखिम — खेतों में पानी न रुकने दें।',
  'risk.cassava.leaf_yellowing':       'पत्तियों का पीला पड़ना पोषण की कमी दर्शाता है।',
  'risk.maize.drought_tasseling':      'फूल आने पर सूखा पैदावार को सबसे ज़्यादा प्रभावित करता है।',
  'risk.maize.fall_armyworm':          'पत्तियों और अंदर फ़ॉल आर्मीवर्म की जाँच करें।',
  'risk.maize.heat_grainfill':         'दाना भरते समय गर्मी से दाने का वज़न घटता है।',
  'risk.rice.blast':                   'राइस ब्लास्ट जोखिम — हरे-धूसर धब्बों की निगरानी करें।',
  'risk.rice.stem_borer':              'तना छेदक की जाँच — मृत शीर्ष देखें।',
  'risk.rice.water_stress':            'पानी की कमी — मेंड़ बंद और भरी रखें।',
  'risk.tomato.late_blight':           'लेट ब्लाइट जोखिम — ऊपर से पानी न दें।',
  'risk.tomato.fruitworm':             'फलों में कीट छिद्र देखें।',
  'risk.tomato.blossom_end_rot':       'असमान पानी देने से ब्लॉसम-एंड रॉट हो सकता है।',
  'risk.onion.purple_blotch':          'नमी में बैंगनी धब्बा जोखिम।',
  'risk.onion.wet_bulking':            'कंद पकते समय अधिक पानी न दें।',
  'risk.okra.shoot_fruit_borer':       'टहनी और फल छेदक की जाँच करें।',
  'risk.okra.yellow_vein':             'पीली नस मोज़ेक — सफ़ेद मक्खी से फैलती है।',
  'risk.pepper.anthracnose':           'एन्थ्रेक्नोज़ — फलों पर गहरे धँसे धब्बे।',
  'risk.pepper.thrips':                'पत्तियों में थ्रिप्स नुकसान देखें।',
  'risk.potato.late_blight':           'लेट ब्लाइट निगरानी — पत्तियाँ साप्ताहिक जाँचें।',
  'risk.potato.aphids':                'नई बढ़त पर एफिड्स की निगरानी करें।',
  'risk.banana.black_sigatoka':        'ब्लैक सिगाटोका — मृत पत्तियाँ साप्ताहिक हटाएँ।',
  'risk.banana.weevil':                'तने में केला घुन के छिद्र देखें।',
  'risk.plantain.black_sigatoka':      'ब्लैक सिगाटोका — खेत साप्ताहिक साफ़ करें।',
  'risk.plantain.wind':                'फल लदे पौधे हवा में गिरते हैं — सहारा दें।',
  'risk.cocoa.black_pod':              'ब्लैक पॉड रॉट — रोगग्रस्त फली साप्ताहिक हटाएँ।',
  'risk.cocoa.mirids':                 'फलियों और टहनियों पर मिरिड क्षति की जाँच करें।',
  'risk.mango.powdery_mildew':         'फूलों पर भभूतिया रोग फल लगने को कम करता है।',
  'risk.mango.fruit_fly':              'फल मक्खी — पकते फल को थैले में रखें या जाल लगाएँ।',
  'risk.generic.dry_stress':           'सूखी स्थिति — सिंचाई की योजना बनाएँ।',
  'risk.generic.wet_disease':          'गीला मौसम पत्ती रोग का दबाव बढ़ाता है।',

  // timing.*
  'timing.whileConditionsDry':         'अच्छा समय — मौसम सूखा है।',
  'timing.beforeRainArrives':          'बारिश आने से पहले करें।',
  'timing.waitForDryWeather':          'सही सुखाने के लिए सूखे मौसम का इंतज़ार करें।',
  'timing.heatIsHighToday':            'आज गर्मी अधिक है — पानी देना ज़रूरी।',
  'timing.earlyThisWeek':              'इस सप्ताह जल्दी करें।',
  'timing.actNowBeforeSpread':         'फैलने से पहले अभी कार्य करें।',
  'timing.regularCheckProtects':       'नियमित जाँच फसल की रक्षा करती है।',
  'timing.waitForCalmWind':            'छिड़काव के लिए शांत हवा का इंतज़ार करें।',
  'timing.bestInCalmConditions':       'शांत स्थिति में करना सबसे अच्छा।',
  'timing.feedDuringGrowth':           'सक्रिय विकास के दौरान खाद देने का सबसे अच्छा समय।',
  'timing.beforePlantingWindow':       'रोपण समय बंद होने से पहले करें।',
  'timing.beforeRainTomorrow':         'कल की बारिश से पहले आज करना बेहतर।',
  'timing.harvestWhenReady':           'फसल तैयार होने पर कटाई करें।',
  'timing.soonAfterHarvest':           'कटाई के तुरंत बाद करना सबसे अच्छा।',
  'timing.beforeQualityDrops':         'गुणवत्ता घटने से पहले भंडारण करें।',
  'timing.doNow':                      'अभी करें।',
  'timing.doToday':                    'आज करें।',
  'timing.doThisWeek':                 'इस सप्ताह करें।',
  'timing.beforeRainOnDay':            '{day} की बारिश से पहले।',
  'timing.doBeforeRainOnDay':          '{day} की बारिश से पहले समाप्त करें।',
  'timing.dryStartsTomorrow':          'सूखा मौसम कल शुरू होगा।',
  'timing.dryStartsOnDay':             '{day} को सूखा मौसम लौटता है।',
};

const lines = fs.readFileSync(FILE, 'utf8').split('\n');
let updated = 0;
let alreadyHad = 0;
let skipped = 0;
const missing = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^(\s*)'([a-zA-Z][a-zA-Z0-9._]+)':\s*\{\s*(.+)\}\s*,\s*$/);
  if (!m) continue;
  const [, indent, key, body] = m;
  if (!HI[key]) continue;
  if (/\bhi:\s*'/.test(body)) {
    alreadyHad += 1;
    continue;
  }
  // Insert hi at the end of the body. Escape single quotes and
  // backslashes in the Hindi value (none expected, but be safe).
  const hi = HI[key].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const trimmedBody = body.replace(/,\s*$/, '');
  const next = `${indent}'${key}': { ${trimmedBody}, hi: '${hi}' },`;
  lines[i] = next;
  updated += 1;
}

for (const k of Object.keys(HI)) {
  // didn't see this key in the file at all → report
  const found = lines.some((l) => l.includes(`'${k}':`));
  if (!found) missing.push(k);
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');

console.log(`updated  ${updated}`);
console.log(`already  ${alreadyHad}`);
console.log(`unknown  ${missing.length}`);
if (missing.length) {
  for (const k of missing) console.log(`   - ${k}`);
}
