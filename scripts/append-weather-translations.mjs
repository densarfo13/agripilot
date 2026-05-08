// One-shot helper to splice the WeatherHeroActionCard i18n keys
// into translations.js without fighting the file's literal
// \u-escape encoding via the Edit tool. Idempotent — re-running
// does nothing because we anchor on a sentinel comment.
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Home spacing + WeatherHeroActionCard spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the weather block; skipping.');
  process.exit(0);
}

// Detect line ending used by the file so we don't mix CRLF + LF.
const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Headlines surfaced by WeatherHeroActionCard. Each maps to one',
  '  // weather "type" (rain/heat/dry/wind/cloudy/sunny/unknown). Copy',
  '  // is short, low-literacy, action-first.',
  "  'weather.todayWeather':       { en: 'Today\\u2019s Weather',          fr: 'M\\u00e9t\\u00e9o du jour',                 sw: 'Hali ya hewa leo',               ha: 'Yanayin yau',                       tw: 'Nn\\u025B wim tebea',                  hi: '\\u0906\\u091C \\u0915\\u093E \\u092E\\u094C\\u0938\\u092E' },",
  "  'weather.unavailable':        { en: 'Weather unavailable',           fr: 'M\\u00e9t\\u00e9o indisponible',            sw: 'Hali ya hewa haipatikani',       ha: 'Yanayi ba ya samuwa',               tw: 'Yenya wim tebea ho amane\\u025B',      hi: '\\u092E\\u094C\\u0938\\u092E \\u0909\\u092A\\u0932\\u092C\\u094D\\u0927 \\u0928\\u0939\\u0940\\u0902 \\u0939\\u0948' },",
  "  'weather.yourArea':           { en: 'Your area',                     fr: 'Votre zone',                    sw: 'Eneo lako',                      ha: 'Yankinka',                          tw: 'Wo mantam',                          hi: '\\u0906\\u092A\\u0915\\u093E \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930' },",
  "  'weather.rain':               { en: 'Rain',                          fr: 'Pluie',                         sw: 'Mvua',                           ha: 'Ruwan sama',                        tw: 'Os\\u016B',                            hi: '\\u0935\\u0930\\u094D\\u0937\\u093E' },",
  "  'weather.wind':               { en: 'Wind',                          fr: 'Vent',                          sw: 'Upepo',                          ha: 'Iska',                              tw: 'Mframa',                              hi: '\\u0939\\u0935\\u093E' },",
  "  'weather.rainLater':          { en: 'Rain expected later',           fr: 'Pluie attendue plus tard',      sw: 'Mvua inatarajiwa baadaye',       ha: 'Ana sa ran ruwan sama daga baya',   tw: 'Os\\u016B b\\u025Bt\\u0254 akyiri yi',  hi: '\\u092C\\u093E\\u0926 \\u092E\\u0947\\u0902 \\u092C\\u093E\\u0930\\u093F\\u0936 \\u0915\\u0940 \\u0938\\u0902\\u092D\\u093E\\u0935\\u0928\\u093E' },",
  "  'weather.warmAfternoon':      { en: 'Warm afternoon expected',       fr: 'Apr\\u00e8s-midi chaud attendu',      sw: 'Mchana wa joto unatarajiwa',     ha: 'Ana sa ran rana mai zafi',          tw: 'Awia hyew b\\u025Bba',                 hi: '\\u0917\\u0930\\u094D\\u092E \\u0926\\u094B\\u092A\\u0939\\u0930 \\u0915\\u0940 \\u0938\\u0902\\u092D\\u093E\\u0935\\u0928\\u093E' },",
  "  'weather.dryToday':           { en: 'Dry conditions today',          fr: 'Conditions s\\u00e8ches aujourd\\u2019hui', sw: 'Hali ya ukame leo',           ha: 'Yanayi mai bushewa yau',            tw: 'Owia ne mfutuma nn\\u025B',            hi: '\\u0906\\u091C \\u0936\\u0941\\u0937\\u094D\\u0915 \\u092E\\u094C\\u0938\\u092E' },",
  "  'weather.windStress':         { en: 'Wind may stress plants',        fr: 'Le vent peut stresser les plantes', sw: 'Upepo unaweza kuathiri mimea', ha: 'Iska na iya damun shuke-shuke',     tw: 'Mframa b\\u025Btumi ahaw nnua',         hi: '\\u0939\\u0935\\u093E \\u0938\\u0947 \\u092A\\u094C\\u0927\\u094B\\u0902 \\u0915\\u094B \\u0924\\u0928\\u093E\\u0935 \\u0939\\u094B \\u0938\\u0915\\u0924\\u093E \\u0939\\u0948' },",
  "  'weather.goodQuickCheck':     { en: 'Good day for a quick check',    fr: 'Bonne journ\\u00e9e pour un contr\\u00f4le rapide', sw: 'Siku nzuri ya ukaguzi wa haraka', ha: 'Rana mai kyau don bincike na sauri', tw: 'Da pa ma nhwehw\\u025Bmu nt\\u025Bm',  hi: '\\u0924\\u094D\\u0935\\u0930\\u093F\\u0924 \\u091C\\u093E\\u0901\\u091A \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0905\\u091A\\u094D\\u091B\\u093E \\u0926\\u093F\\u0928' },",
  "  'weather.warmAndDry':         { en: 'Warm and dry',                  fr: 'Chaud et sec',                  sw: 'Joto na ukame',                  ha: 'Mai zafi da bushewa',               tw: 'Owia ne mfutuma',                     hi: '\\u0917\\u0930\\u094D\\u092E \\u0914\\u0930 \\u0936\\u0941\\u0937\\u094D\\u0915' },",
  '',
  '  // Action lines used by WeatherHeroActionCard. Farm copy lives in',
  '  // actions.* without a suffix; garden-flavoured variants use a',
  '  // descriptive name (protectPots / checkPotMoisture / etc.). Both',
  '  // forms ship in every locale.',
  "  'actions.checkDrainage':      { en: 'Check drainage around your crop', fr: 'V\\u00e9rifiez le drainage autour de votre culture', sw: 'Kagua mifereji kuzunguka mazao yako', ha: 'Duba magudanar ruwa kewaye da amfanin gonarka', tw: 'Hw\\u025B ns\\u016B agyenam w\\u0254 wo afuom', hi: '\\u0905\\u092A\\u0928\\u0940 \\u092B\\u0938\\u0932 \\u0915\\u0947 \\u0906\\u0938\\u092A\\u093E\\u0938 \\u091C\\u0932 \\u0928\\u093F\\u0915\\u093E\\u0938\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.protectPots':        { en: 'Move small pots away from heavy rain', fr: '\\u00c9loignez les petits pots de la forte pluie', sw: 'Hamishia vyungu vidogo mbali na mvua kubwa', ha: 'Matsar da \\u0199ananan kasko daga ruwan sama mai \\u0199arfi', tw: 'Yi nkuruwa nketewa firi os\\u016B k\\u025Bse ho', hi: '\\u092D\\u093E\\u0930\\u0940 \\u092C\\u093E\\u0930\\u093F\\u0936 \\u0938\\u0947 \\u091B\\u094B\\u091F\\u0947 \\u0917\\u092E\\u0932\\u0947 \\u0939\\u091F\\u093E\\u090F\\u0901' },",
  "  'actions.checkSoilMoisture':  { en: 'Check field moisture early',     fr: 'V\\u00e9rifiez l\\u2019humidit\\u00e9 du champ t\\u00f4t', sw: 'Kagua unyevu wa shamba mapema', ha: 'Duba danshin gona da wuri',          tw: 'Hw\\u025B afuom n\\u016B wim ans\\u0101',         hi: '\\u091C\\u0932\\u094D\\u0926\\u0940 \\u0916\\u0947\\u0924 \\u0915\\u0940 \\u0928\\u092E\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.checkPotMoisture':   { en: 'Small pots may dry quickly today', fr: 'Les petits pots peuvent s\\u00e9cher vite aujourd\\u2019hui', sw: 'Vyungu vidogo vinaweza kukauka haraka leo', ha: '\\u0199ananan kasko za su iya bushewa da sauri yau', tw: 'Nkuruwa nketewa b\\u025Btumi awo nt\\u025Bm nn\\u025B', hi: '\\u0906\\u091C \\u091B\\u094B\\u091F\\u0947 \\u0917\\u092E\\u0932\\u0947 \\u091C\\u0932\\u094D\\u0926\\u0940 \\u0938\\u0942\\u0916 \\u0938\\u0915\\u0924\\u0947 \\u0939\\u0948\\u0902' },",
  "  'actions.waterIfDry':         { en: 'Water only if soil feels dry',   fr: 'Arrosez uniquement si le sol semble sec', sw: 'Mwagilia maji tu kama udongo umekauka', ha: 'Ba da ruwa kawai idan kasa ta bushe', tw: 'Gugu ns\\u016B s\\u025B mfutuma awo nko ara', hi: '\\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u0938\\u0942\\u0916\\u0940 \\u0932\\u0917\\u0947 \\u0924\\u094B \\u0939\\u0940 \\u092A\\u093E\\u0928\\u0940 \\u0926\\u0947\\u0902' },",
  "  'actions.waterPotsIfDry':     { en: 'Water pots only if the soil feels dry', fr: 'Arrosez les pots uniquement si le sol est sec', sw: 'Mwagilia vyungu tu kama udongo umekauka', ha: 'Ba da ruwa ga kasko idan \\u0199asa ta bushe ne kawai', tw: 'Gugu nkuruwa ns\\u016B s\\u025B mfutuma awo nko ara', hi: '\\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u0938\\u0942\\u0916\\u0940 \\u0939\\u094B \\u0924\\u092D\\u0940 \\u0917\\u092E\\u0932\\u094B\\u0902 \\u092E\\u0947\\u0902 \\u092A\\u093E\\u0928\\u0940 \\u0926\\u0947\\u0902' },",
  "  'actions.supportWeakPlants':  { en: 'Support weak stems in the field', fr: 'Soutenez les tiges faibles dans le champ', sw: 'Saidia mashina dhaifu shambani', ha: 'Tallafa wa raunin sanduna a gona', tw: 'B\\u0254a nnua nketewa a w\\u0254y\\u025B mmer\\u025B', hi: '\\u0916\\u0947\\u0924 \\u092E\\u0947\\u0902 \\u0915\\u092E\\u091C\\u094B\\u0930 \\u0924\\u0928\\u094B\\u0902 \\u0915\\u094B \\u0938\\u0939\\u093E\\u0930\\u093E \\u0926\\u0947\\u0902' },",
  "  'actions.supportContainers':  { en: 'Support weak stems or containers', fr: 'Soutenez les tiges faibles ou les contenants', sw: 'Saidia mashina dhaifu au vyombo', ha: 'Tallafa wa raunin sanduna ko kasko', tw: 'B\\u0254a mmer\\u025B nnua anaa nkuruwa', hi: '\\u0915\\u092E\\u091C\\u094B\\u0930 \\u0924\\u0928\\u094B\\u0902 \\u092F\\u093E \\u0915\\u0902\\u091F\\u0947\\u0928\\u0930\\u094B\\u0902 \\u0915\\u094B \\u0938\\u0939\\u093E\\u0930\\u093E \\u0926\\u0947\\u0902' },",
  "  'actions.inspectLeaves':      { en: 'Inspect leaves and soil moisture', fr: 'Inspectez les feuilles et l\\u2019humidit\\u00e9 du sol', sw: 'Kagua majani na unyevu wa udongo', ha: 'Duba ganye da danshin kasa', tw: 'Hw\\u025B nhaban ne mfutuma n\\u016B', hi: '\\u092A\\u0924\\u094D\\u0924\\u093F\\u092F\\u093E\\u0901 \\u0914\\u0930 \\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u0915\\u0940 \\u0928\\u092E\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.inspectLeavesGarden':{ en: 'Inspect leaves and soil in your pots', fr: 'Inspectez les feuilles et la terre de vos pots', sw: 'Kagua majani na udongo wa vyungu vyako', ha: 'Duba ganye da kasa a kasko', tw: 'Hw\\u025B nhaban ne mfutuma w\\u0254 wo nkuruwa mu', hi: '\\u0905\\u092A\\u0928\\u0947 \\u0917\\u092E\\u0932\\u094B\\u0902 \\u0915\\u0940 \\u092A\\u0924\\u094D\\u0924\\u093F\\u092F\\u093E\\u0901 \\u0914\\u0930 \\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.scanCrop':           { en: 'Scan crop',                     fr: 'Scanner la culture',             sw: 'Skani zao',                      ha: 'Bincika amfanin gona',              tw: 'Hwehw\\u025B afuom afi',                  hi: '\\u092B\\u0938\\u0932 \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'actions.scanPlant':          { en: 'Scan plant',                    fr: 'Scanner la plante',              sw: 'Skani mmea',                     ha: 'Bincika tsiro',                     tw: 'Hwehw\\u025B dua',                        hi: '\\u092A\\u094C\\u0927\\u093E \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'actions.startCheck':         { en: 'Start check',                   fr: 'Commencer le contr\\u00f4le',          sw: 'Anza ukaguzi',                   ha: 'Fara bincike',                      tw: 'Fi nhwehw\\u025Bmu ase',                  hi: '\\u091C\\u093E\\u0901\\u091A \\u0936\\u0941\\u0930\\u0942 \\u0915\\u0930\\u0947\\u0902' },",
  "  'actions.checkSoil':          { en: 'Check soil',                    fr: 'V\\u00e9rifier le sol',                sw: 'Kagua udongo',                   ha: 'Duba \\u0199asa',                       tw: 'Hw\\u025B mfutuma',                       hi: '\\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.checkPlants':        { en: 'Check plants',                  fr: 'V\\u00e9rifier les plantes',           sw: 'Kagua mimea',                    ha: 'Duba shuke-shuke',                  tw: 'Hw\\u025B nnua',                          hi: '\\u092A\\u094C\\u0927\\u0947 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  '',
  '  // Done-state copy used on Home + WeatherHeroActionCard.',
  "  'home.onTrackToday':          { en: 'You\\u2019re on track today \\u2713', fr: 'Vous \\u00eates sur la bonne voie aujourd\\u2019hui \\u2713', sw: 'Uko sawa leo \\u2713', ha: 'Kana kan hanya yau \\u2713', tw: 'Wow\\u0254 \\u0254kwan pa so nn\\u025B \\u2713', hi: '\\u0906\\u091C \\u0906\\u092A \\u0938\\u0939\\u0940 \\u0926\\u093F\\u0936\\u093E \\u092E\\u0947\\u0902 \\u0939\\u0948\\u0902 \\u2713' },",
  "  'home.checkTomorrow':         { en: 'Check again tomorrow morning.', fr: 'Revenez demain matin.',          sw: 'Angalia tena kesho asubuhi.',     ha: 'Sake duba gobe da safe.',           tw: 'San hw\\u025B \\u0254kyena an\\u0254pa.',          hi: '\\u0915\\u0932 \\u0938\\u0941\\u092C\\u0939 \\u092B\\u093F\\u0930 \\u0926\\u0947\\u0916\\u0947\\u0902\\u0964' },",
  "  'home.allSetForNow':          { en: 'All set for now \\u2713',         fr: 'Tout est en ordre pour l\\u2019instant \\u2713', sw: 'Kila kitu sawa kwa sasa \\u2713', ha: 'Komai a shirye yanzu \\u2713', tw: 'Biribiara y\\u025B krado mpr\\u025Bmpr\\u025Bm \\u2713', hi: '\\u0905\\u092D\\u0940 \\u0938\\u092C \\u0915\\u0941\\u091B \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u0948 \\u2713' },",
  "  'home.optionalScanCrop':      { en: 'Optional: Scan crop',           fr: 'Optionnel : scanner la culture', sw: 'Hiari: Skani zao',               ha: 'Na za\\u0253i: Bincika amfanin gona',  tw: 'S\\u025B wop\\u025B a: Hwehw\\u025B afuom afi',         hi: '\\u0935\\u0948\\u0915\\u0932\\u094D\\u092A\\u093F\\u0915: \\u092B\\u0938\\u0932 \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'home.optionalScanPlant':     { en: 'Optional: Scan plant',          fr: 'Optionnel : scanner la plante',  sw: 'Hiari: Skani mmea',              ha: 'Na za\\u0253i: Bincika tsiro',         tw: 'S\\u025B wop\\u025B a: Hwehw\\u025B dua',               hi: '\\u0935\\u0948\\u0915\\u0932\\u094D\\u092A\\u093F\\u0915: \\u092A\\u094C\\u0927\\u093E \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'home.optionalReviewProgress':{ en: 'Optional: Review progress',     fr: 'Optionnel : examiner les progr\\u00e8s', sw: 'Hiari: Pitia maendeleo',       ha: 'Na za\\u0253i: Duba ci gaba',          tw: 'S\\u025B wop\\u025B a: Hw\\u025B nk\\u0254so',                hi: '\\u0935\\u0948\\u0915\\u0932\\u094D\\u092A\\u093F\\u0915: \\u092A\\u094D\\u0930\\u0917\\u0924\\u093F \\u0926\\u0947\\u0916\\u0947\\u0902' },",
].join(eol);

// Splice block before the final '};' that closes the T object. We
// match the LAST occurrence of '\n};\n' to keep the insertion at
// the bottom of the dictionary.
const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
