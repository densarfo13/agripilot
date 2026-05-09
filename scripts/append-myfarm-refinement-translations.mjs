// Idempotent splicer for the My Farm refinement i18n keys
// (May 2026 spec §15).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── My Farm refinement spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the my-farm-refinement block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // FarmSnapshotCard + soft empty-state copy. Each row ships',
  '  // with a defensive English fallback.',
  "  'farm.farmSnapshot':       { en: 'Farm snapshot',                 fr: 'Aperçu de la ferme',                  sw: 'Muhtasari wa shamba',           ha: 'Bayanin gona',                     tw: 'Afuom mu nsɛm',                                       hi: '\\u0916\\u0947\\u0924 \\u0915\\u093E \\u0938\\u093E\\u0930\\u093E\\u0902\\u0936' },",
  "  'farm.manageFarm':         { en: 'Manage farm',                   fr: 'Gérer la ferme',                       sw: 'Simamia shamba',                ha: 'Sarrafa gona',                     tw: 'Hw\\u025B afuom so',                                  hi: '\\u0916\\u0947\\u0924 \\u092A\\u094D\\u0930\\u092C\\u0902\\u0927\\u093F\\u0924 \\u0915\\u0930\\u0947\\u0902' },",
  "  'farm.chooseCrop':         { en: 'Choose your main crop',         fr: 'Choisissez votre culture principale',  sw: 'Chagua zao lako kuu',           ha: 'Zaɓi babban amfanin gonarka',      tw: 'Yi w\\u2019afuom afi titiriw',                          hi: '\\u0905\\u092A\\u0928\\u0940 \\u092E\\u0941\\u0916\\u094D\\u092F \\u092B\\u0938\\u0932 \\u091A\\u0941\\u0928\\u0947\\u0902' },",
  "  'farm.addFirstCrop':       { en: 'Add your first crop',           fr: 'Ajoutez votre première culture',       sw: 'Ongeza zao lako la kwanza',     ha: 'Ƙara amfanin gonarka na farko',    tw: 'Fa wo afuom afi a edi kan no si h\\u0254',              hi: '\\u0905\\u092A\\u0928\\u0940 \\u092A\\u0939\\u0932\\u0940 \\u092B\\u0938\\u0932 \\u091C\\u094B\\u0921\\u093C\\u0947\\u0902' },",
  "  'farm.recommendedChecks':  { en: '{count} recommended checks today',     fr: '{count} contrôles recommandés aujourd\\u2019hui', sw: 'Ukaguzi {count} unaopendekezwa leo',     ha: 'Bincike {count} da aka ba da shawara yau', tw: 'Nhwehw\\u025Bmu {count} a y\\u025Bde ma nnɛ',                hi: '\\u0906\\u091C {count} \\u0905\\u0928\\u0941\\u0936\\u0902\\u0938\\u093F\\u0924 \\u091C\\u093E\\u0902\\u091A\\u0947\\u0902' },",
  "  'farm.importantChecks':    { en: 'A few important checks remain today.',  fr: 'Quelques contrôles importants restent à faire aujourd\\u2019hui.', sw: 'Bado kuna ukaguzi muhimu leo.', ha: 'Akwai bincike mai muhimmanci da suka rage yau.', tw: 'Nhwehw\\u025Bmu titiriw kakra aka nnɛ.',                hi: '\\u0906\\u091C \\u0915\\u0941\\u091B \\u092E\\u0939\\u0924\\u094D\\u0935\\u092A\\u0942\\u0930\\u094D\\u0923 \\u091C\\u093E\\u0902\\u091A\\u0947\\u0902 \\u092C\\u093E\\u0915\\u0940 \\u0939\\u0948\\u0902\\u0964' },",
  "  'farm.needHelp':           { en: 'Need help?',                    fr: 'Besoin d\\u2019aide ?',                  sw: 'Unahitaji msaada?',             ha: 'Kana bukatar taimako?',            tw: 'Wohia mmoa?',                                          hi: '\\u092E\\u0926\\u0926 \\u091A\\u093E\\u0939\\u093F\\u090F?' },",
  "  'farm.contactSupport':     { en: 'Contact our team',              fr: 'Contactez notre équipe',               sw: 'Wasiliana na timu yetu',         ha: 'Tuntuɓi tawagar mu',               tw: 'Frɛ y\\u025Bn dwumaden',                                hi: '\\u0939\\u092E\\u093E\\u0930\\u0940 \\u091F\\u0940\\u092E \\u0938\\u0947 \\u0938\\u0902\\u092A\\u0930\\u094D\\u0915 \\u0915\\u0930\\u0947\\u0902' },",
  "  'farm.weatherInsight':     { en: 'Rain improved moisture this week.',  fr: 'La pluie a amélioré l\\u2019humidité cette semaine.', sw: 'Mvua iliboresha unyevu wiki hii.', ha: 'Ruwan sama ya inganta danshi a wannan mako.', tw: 'Os\\u016B ma nū ay\\u025B yiye nnaw\\u0254tw\\u025B yi.',     hi: '\\u0907\\u0938 \\u0938\\u092A\\u094D\\u0924\\u093E\\u0939 \\u092C\\u093E\\u0930\\u093F\\u0936 \\u0938\\u0947 \\u0928\\u092E\\u0940 \\u092C\\u0922\\u093C\\u0940\\u0964' },",
  "  'farm.memoryMoment':       { en: 'Recent tasks improved field readiness.', fr: 'Les tâches récentes ont amélioré la préparation du champ.',  sw: 'Kazi za hivi karibuni ziliboresha utayari wa shamba.',  ha: 'Ayyukan na baya-bayan nan sun inganta shirye-shiryen gona.', tw: 'Adwuma a y\\u025Bay\\u025B nnɛ no boa afuom siesie.',         hi: '\\u0939\\u093E\\u0932 \\u0915\\u0947 \\u0915\\u093E\\u0930\\u094D\\u092F\\u094B\\u0902 \\u0928\\u0947 \\u0916\\u0947\\u0924 \\u0915\\u0940 \\u0924\\u0948\\u092F\\u093E\\u0930\\u0940 \\u092C\\u0922\\u093C\\u093E\\u0908\\u0964' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
