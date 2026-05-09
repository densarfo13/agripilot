// Idempotent splicer for the Progress-refinement i18n keys
// (May 2026 spec §15).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Progress refinement spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the progress-refinement block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Growth-journey timeline labels + supportive insight copy.',
  "  'progress.stage.seeded':         { en: 'Seeded',                      fr: 'Semé',                       sw: 'Imepandwa',                   ha: 'An shuka',                     tw: 'Y\\u025Bd\\u0254',                                   hi: '\\u092C\\u094B\\u090F \\u0917\\u090F' },",
  "  'progress.earlyGrowth':          { en: 'Early growth',                fr: 'Début de croissance',         sw: 'Ukuaji wa mapema',            ha: 'Ci gaba na farko',             tw: 'Mfis\\u025B nyini\\u025B',                                hi: '\\u092A\\u094D\\u0930\\u093E\\u0930\\u0902\\u092D\\u093F\\u0915 \\u0935\\u093F\\u0915\\u093E\\u0938' },",
  "  'progress.strongProgress':       { en: 'Strong progress',             fr: 'Bonne progression',           sw: 'Maendeleo madhubuti',         ha: 'Ci gaba mai \\u0199arfi',         tw: 'Nk\\u0254so a \\u025By\\u025B den',                              hi: '\\u092E\\u091C\\u092C\\u0942\\u0924 \\u092A\\u094D\\u0930\\u0917\\u0924\\u093F' },",
  "  'progress.floweringStage':       { en: 'Flowering',                   fr: 'Floraison',                   sw: 'Kuchanua',                    ha: 'Yana fure',                    tw: 'Reb\\u025B nhwiren',                                   hi: '\\u092B\\u0942\\u0932\\u0928 \\u091A\\u0930\\u0923' },",
  "  'progress.harvestApproaching':   { en: 'Harvest ready',               fr: 'Récolte proche',              sw: 'Mavuno yanakaribia',          ha: 'Girbi yana gabatowa',          tw: 'Otwabere',                                          hi: '\\u0915\\u091F\\u093E\\u0908 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0924\\u0948\\u092F\\u093E\\u0930' },",
  "  'progress.tasksCompletedToday':  { en: '{count} tasks completed today', fr: '{count} tâches terminées aujourd\\u2019hui', sw: 'Kazi {count} zimekamilika leo', ha: 'Ayyuka {count} an gama yau',  tw: 'Adwuma {count} ay\\u025B nnɛ',                                  hi: '\\u0906\\u091C {count} \\u0915\\u093E\\u092E \\u092A\\u0942\\u0930\\u0947 \\u0939\\u0941\\u090F' },",
  "  'progress.oneTaskCompletedToday':{ en: '1 task completed today',       fr: '1 tâche terminée aujourd\\u2019hui',          sw: 'Kazi 1 imekamilika leo',     ha: 'Aiki 1 an gama yau',          tw: 'Adwuma baako ay\\u025B nnɛ',                                   hi: '\\u0906\\u091C 1 \\u0915\\u093E\\u092E \\u092A\\u0942\\u0930\\u093E \\u0939\\u0941\\u0906' },",
  "  'progress.updatedThisMorning':   { en: 'Updated this morning',         fr: 'Mis à jour ce matin',         sw: 'Imesasishwa asubuhi hii',     ha: 'An sabunta safiyar nan',       tw: 'Y\\u025Bsesa anɔpa yi',                                       hi: '\\u0907\\u0938 \\u0938\\u0941\\u092C\\u0939 \\u0905\\u092A\\u0921\\u0947\\u091F \\u0915\\u093F\\u092F\\u093E \\u0917\\u092F\\u093E' },",
  "  'progress.checkedRecently':      { en: 'Checked recently',             fr: 'Vérifié récemment',           sw: 'Ilikaguliwa hivi karibuni',    ha: 'An duba kwanan nan',           tw: 'Y\\u025Bhw\\u025B\\u025B no nn\\u025B koro',                                hi: '\\u0939\\u093E\\u0932 \\u0939\\u0940 \\u092E\\u0947\\u0902 \\u091C\\u093E\\u0901\\u091A\\u093E \\u0917\\u092F\\u093E' },",
  "  'progress.farmInsight':          { en: 'Your farm is building steady momentum.', fr: 'Votre ferme prend un rythme régulier.',     sw: 'Shamba lako linajenga kasi thabiti.',  ha: 'Gonarka tana samun ci gaba mai \\u0199arfi.', tw: 'Wo afuom rey\\u025B nk\\u0254so daa.',                              hi: '\\u0906\\u092A\\u0915\\u093E \\u0916\\u0947\\u0924 \\u0938\\u094D\\u0925\\u093F\\u0930 \\u0917\\u0924\\u093F \\u092C\\u0928\\u093E \\u0930\\u0939\\u093E \\u0939\\u0948\\u0964' },",
  "  'progress.gardenInsight':        { en: 'Your plants are responding well.',       fr: 'Vos plantes réagissent bien.',                sw: 'Mimea yako inajibu vizuri.',          ha: 'Tsire-tsirenka suna amsa da kyau.',  tw: 'Wo nnua reye yiye.',                                  hi: '\\u0906\\u092A\\u0915\\u0947 \\u092A\\u094C\\u0927\\u0947 \\u0905\\u091A\\u094D\\u091B\\u0940 \\u0924\\u0930\\u0939 \\u092A\\u094D\\u0930\\u0924\\u093F\\u0915\\u094D\\u0930\\u093F\\u092F\\u093E \\u0926\\u0947 \\u0930\\u0939\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  "  'progress.nextRecommendedCheck': { en: 'Next recommended check',                 fr: 'Prochain contrôle recommandé',                sw: 'Ukaguzi unaopendekezwa unaofuata',   ha: 'Bincike na gaba da aka ba da shawara', tw: 'Nhwehw\\u025Bmu a edi h\\u0254 a y\\u025Bde ma',                       hi: '\\u0905\\u0917\\u0932\\u0940 \\u0905\\u0928\\u0941\\u0936\\u0902\\u0938\\u093F\\u0924 \\u091C\\u093E\\u0901\\u091A' },",
  "  'progress.startCheck':           { en: 'Start check',                            fr: 'Commencer la vérification',                   sw: 'Anza ukaguzi',                       ha: 'Fara bincike',                       tw: 'Fi nhwehw\\u025Bmu ase',                                  hi: '\\u091C\\u093E\\u0901\\u091A \\u0936\\u0941\\u0930\\u0942 \\u0915\\u0930\\u0947\\u0902' },",
  "  'progress.timelineAria':         { en: 'Growth journey',                         fr: 'Parcours de croissance',                      sw: 'Safari ya ukuaji',                   ha: 'Tafiyar girma',                       tw: 'Nyini\\u025B akwantuo',                                    hi: '\\u0935\\u093F\\u0915\\u093E\\u0938 \\u092F\\u093E\\u0924\\u094D\\u0930\\u093E' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
