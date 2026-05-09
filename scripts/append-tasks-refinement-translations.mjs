// Idempotent splicer for the Tasks-refinement i18n keys
// (May 2026 spec §14).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Tasks refinement spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the tasks-refinement block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Calm completion + tomorrow-outlook copy. Each row ships',
  '  // with a defensive English fallback.',
  "  'tasks.completedTodayN':           { en: '{count} tasks completed today',                fr: '{count} tâches terminées aujourd\\u2019hui',          sw: 'Kazi {count} zimekamilika leo',                 ha: 'Ayyuka {count} an gama yau',                   tw: 'Adwuma {count} ay\\u025B nnɛ',                                     hi: '\\u0906\\u091C {count} \\u0915\\u093E\\u092E \\u092A\\u0942\\u0930\\u0947 \\u0939\\u0941\\u090F' },",
  "  'tasks.completedTodayOne':         { en: '1 task completed today',                       fr: '1 tâche terminée aujourd\\u2019hui',                  sw: 'Kazi 1 imekamilika leo',                        ha: 'Aiki 1 an gama yau',                           tw: 'Adwuma baako ay\\u025B nnɛ',                                          hi: '\\u0906\\u091C 1 \\u0915\\u093E\\u092E \\u092A\\u0942\\u0930\\u093E \\u0939\\u0941\\u0906' },",
  "  'tasks.allCaughtUpFarm':           { en: 'You\\u2019re all caught up.',                  fr: 'Tout est à jour.',                                    sw: 'Umekamilisha yote.',                            ha: 'Ka kammala duka.',                             tw: 'Woawie nyinaa.',                                                  hi: '\\u0906\\u092A \\u0938\\u092C \\u092A\\u0942\\u0930\\u093E \\u0915\\u0930 \\u091A\\u0941\\u0915\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  "  'tasks.allCaughtUpGarden':         { en: 'You\\u2019re all caught up.',                  fr: 'Tout est à jour.',                                    sw: 'Umekamilisha yote.',                            ha: 'Ka kammala duka.',                             tw: 'Woawie nyinaa.',                                                  hi: '\\u0906\\u092A \\u0938\\u092C \\u092A\\u0942\\u0930\\u093E \\u0915\\u0930 \\u091A\\u0941\\u0915\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  '',
  '  // Weather-aware reassurance lines (one shows at a time).',
  "  'tasks.weatherPreparedRainFarm':   { en: 'Your crops are prepared for tonight\\u2019s rain.',  fr: 'Vos cultures sont prêtes pour la pluie de ce soir.',  sw: 'Mazao yako yamejiandaa kwa mvua ya usiku.',     ha: 'Amfanin gonarka ya shirya don ruwan sama na yamma.', tw: 'Wo afuom asiesie ne ho ama anadwo os\\u016B.',                       hi: '\\u0906\\u092A\\u0915\\u0940 \\u092B\\u0938\\u0932\\u0947\\u0902 \\u0906\\u091C \\u0930\\u093E\\u0924 \\u0915\\u0940 \\u092C\\u093E\\u0930\\u093F\\u0936 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u0948\\u0902\\u0964' },",
  "  'tasks.weatherPreparedRainGarden': { en: 'Your plants are prepared for tonight\\u2019s rain.', fr: 'Vos plantes sont prêtes pour la pluie de ce soir.',   sw: 'Mimea yako imejiandaa kwa mvua ya usiku.',      ha: 'Tsire-tsirenka sun shirya don ruwan sama na yamma.',  tw: 'Wo nnua asiesie ne ho ama anadwo os\\u016B.',                          hi: '\\u0906\\u092A\\u0915\\u0947 \\u092A\\u094C\\u0927\\u0947 \\u0906\\u091C \\u0930\\u093E\\u0924 \\u0915\\u0940 \\u092C\\u093E\\u0930\\u093F\\u0936 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u0948\\u0902\\u0964' },",
  "  'tasks.weatherPreparedHeatFarm':   { en: 'Field checks done before midday heat.',             fr: 'Contrôles du champ effectués avant la chaleur de midi.', sw: 'Ukaguzi wa shamba umefanyika kabla ya joto la mchana.', ha: 'An gama bincike na gona kafin zafi na tsakar rana.',  tw: 'Y\\u025Bawie afuom nhwehw\\u025Bmu ans\\u0101 awia ahyew.',         hi: '\\u0926\\u094B\\u092A\\u0939\\u0930 \\u0915\\u0940 \\u0917\\u0930\\u094D\\u092E\\u0940 \\u0938\\u0947 \\u092A\\u0939\\u0932\\u0947 \\u0916\\u0947\\u0924 \\u0915\\u0940 \\u091C\\u093E\\u0901\\u091A \\u0939\\u094B \\u0917\\u0908\\u0964' },",
  "  'tasks.weatherPreparedHeatGarden': { en: 'Watering completed before peak heat.',              fr: 'Arrosage terminé avant la chaleur intense.',          sw: 'Umwagiliaji umekamilika kabla ya joto kali.',   ha: 'An gama ban ruwa kafin zafi mafi yawa.',           tw: 'Y\\u025Bawie nsu gugu ans\\u0101 ahyew aboro so.',                       hi: '\\u0905\\u0927\\u093F\\u0915 \\u0917\\u0930\\u094D\\u092E\\u0940 \\u0938\\u0947 \\u092A\\u0939\\u0932\\u0947 \\u092A\\u093E\\u0928\\u0940 \\u0926\\u0947\\u0928\\u093E \\u092A\\u0942\\u0930\\u093E \\u0939\\u094B \\u0917\\u092F\\u093E\\u0964' },",
  "  'tasks.readyForTomorrow':          { en: 'Your fields are ready for tomorrow.',                fr: 'Vos champs sont prêts pour demain.',                  sw: 'Mashamba yako yako tayari kwa kesho.',          ha: 'Gonakinka sun shirya don gobe.',                 tw: 'Wo afuom siesiee ho ma \\u0254kyena.',                                   hi: '\\u0906\\u092A\\u0915\\u0947 \\u0916\\u0947\\u0924 \\u0915\\u0932 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u0948\\u0902\\u0964' },",
  "  'tasks.everythingLooksGood':       { en: 'Your plants are doing well today.',                  fr: 'Vos plantes vont bien aujourd\\u2019hui.',             sw: 'Mimea yako inaendelea vizuri leo.',             ha: 'Tsire-tsirenka suna lafiya yau.',                tw: 'Wo nnua reye yiye nnɛ.',                                              hi: '\\u0906\\u092A\\u0915\\u0947 \\u092A\\u094C\\u0927\\u0947 \\u0906\\u091C \\u0905\\u091A\\u094D\\u091B\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  '',
  '  // Tomorrow preview + CTA.',
  "  'tasks.tomorrow':                  { en: 'Tomorrow',                                           fr: 'Demain',                                              sw: 'Kesho',                                          ha: 'Gobe',                                            tw: '\\u0254kyena',                                                          hi: '\\u0915\\u0932' },",
  "  'tasks.quickCheckTomorrow':        { en: 'Quick moisture check recommended in the morning.',   fr: 'Contrôle rapide de l\\u2019humidité recommandé le matin.', sw: 'Ukaguzi mfupi wa unyevu unapendekezwa asubuhi.',  ha: 'An ba da shawarar bincike na danshi da safe.',     tw: 'Y\\u025Bde nsu nū nhwehw\\u025Bmu tiawa ma anɔpa.',                       hi: '\\u0938\\u0941\\u092C\\u0939 \\u0928\\u092E\\u0940 \\u0915\\u0940 \\u0924\\u094D\\u0935\\u0930\\u093F\\u0924 \\u091C\\u093E\\u0901\\u091A \\u0915\\u0940 \\u0938\\u093F\\u092B\\u093E\\u0930\\u093F\\u0936 \\u0939\\u0948\\u0964' },",
  "  'tasks.quickCheckTomorrowGarden':  { en: 'Quick care check recommended in the morning.',       fr: 'Contrôle rapide des soins recommandé le matin.',      sw: 'Ukaguzi mfupi wa utunzaji unapendekezwa asubuhi.', ha: 'An ba da shawarar bincike na kulawa da safe.',     tw: 'Y\\u025Bde ahw\\u025B nhwehw\\u025Bmu tiawa ma anɔpa.',                  hi: '\\u0938\\u0941\\u092C\\u0939 \\u0926\\u0947\\u0916\\u092D\\u093E\\u0932 \\u0915\\u0940 \\u0924\\u094D\\u0935\\u0930\\u093F\\u0924 \\u091C\\u093E\\u0901\\u091A \\u0915\\u0940 \\u0938\\u093F\\u092B\\u093E\\u0930\\u093F\\u0936 \\u0939\\u0948\\u0964' },",
  "  'tasks.tomorrowOutlook':           { en: 'See tomorrow\\u2019s outlook',                       fr: 'Voir les prévisions de demain',                       sw: 'Tazama mtazamo wa kesho',                       ha: 'Duba hangen nesa na gobe',                       tw: 'Hw\\u025B \\u0254kyena nsɛm',                                            hi: '\\u0915\\u0932 \\u0915\\u093E \\u0926\\u0943\\u0937\\u094D\\u091F\\u093F\\u0915\\u094B\\u0923 \\u0926\\u0947\\u0916\\u0947\\u0902' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
