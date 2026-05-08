// Idempotent splicer for the Home-mockup i18n keys (May 2026
// premium mockup spec). Mirrors append-weather-translations.mjs.
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Home premium mockup spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the home-mockup block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Profile card + adaptive metric labels + bonus headlines.',
  '  // Every key ships with a defensive English fallback so a',
  '  // missing locale row never blanks the card.',
  "  'home.greatJob':            { en: 'Great job staying ahead.', fr: 'Bravo pour votre avance.', sw: 'Hongera kwa kuwa mbele.', ha: 'Madalla da ka kasance gaba.', tw: 'Aboa pa, woadi anim.', hi: '\\u0906\\u0917\\u0947 \\u0930\\u0939\\u0928\\u0947 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0936\\u093E\\u092C\\u093E\\u0936\\u0964' },",
  "  'home.todaysPriority':      { en: 'Today\\u2019s priority',     fr: 'Priorit\\u00e9 du jour',          sw: 'Kipaumbele cha leo',     ha: 'Fifiko na yau',          tw: 'Nn\\u025B adwuma titiriw',     hi: '\\u0906\\u091C \\u0915\\u0940 \\u092A\\u094D\\u0930\\u093E\\u0925\\u092E\\u093F\\u0915\\u0924\\u093E' },",
  "  'home.markDone':            { en: 'Mark done',                fr: 'Marquer fait',                  sw: 'Weka alama imekamilika', ha: 'Yi alama gama',          tw: 'Hyɛ s\\u025B y\\u025B\\u025B no awie',          hi: '\\u092A\\u0942\\u0930\\u094D\\u0923 \\u091A\\u093F\\u0939\\u094D\\u0928\\u093F\\u0924 \\u0915\\u0930\\u0947\\u0902' },",
  "  'home.scanCrop':            { en: 'Scan crop',                fr: 'Scanner la culture',             sw: 'Skani zao',              ha: 'Bincika amfanin gona',   tw: 'Hwehw\\u025B afuom afi',       hi: '\\u092B\\u0938\\u0932 \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'home.scanPlant':           { en: 'Scan plant',               fr: 'Scanner la plante',              sw: 'Skani mmea',             ha: 'Bincika tsiro',          tw: 'Hwehw\\u025B dua',             hi: '\\u092A\\u094C\\u0927\\u093E \\u0938\\u094D\\u0915\\u0948\\u0928 \\u0915\\u0930\\u0947\\u0902' },",
  "  'home.checkCropHealth':     { en: 'Check your crop health',   fr: 'V\\u00e9rifiez la sant\\u00e9 de votre culture', sw: 'Kagua afya ya mazao yako', ha: 'Duba lafiyar amfanin gonarka', tw: 'Hw\\u025B w\\u0254 afuom apɔw', hi: '\\u0905\\u092A\\u0928\\u0940 \\u092B\\u0938\\u0932 \\u0915\\u0940 \\u0938\\u0947\\u0939\\u0924 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'home.checkPlantHealth':    { en: 'Check your plant health',  fr: 'V\\u00e9rifiez la sant\\u00e9 de votre plante', sw: 'Kagua afya ya mmea wako', ha: 'Duba lafiyar tsironka', tw: 'Hw\\u025B w\\u0254 dua apɔw', hi: '\\u0905\\u092A\\u0928\\u0947 \\u092A\\u094C\\u0927\\u0947 \\u0915\\u0940 \\u0938\\u0947\\u0939\\u0924 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  '',
  '  // FarmGardenProfileCard subtitle defaults + count chips.',
  "  'home.profile.defaultFarm':   { en: 'My New Farm',              fr: 'Ma nouvelle ferme',          sw: 'Shamba langu jipya',        ha: 'Sabuwar gonar',            tw: 'Me afuom foforɔ',                hi: '\\u092E\\u0947\\u0930\\u093E \\u0928\\u092F\\u093E \\u0916\\u0947\\u0924' },",
  "  'home.profile.defaultGarden': { en: 'My Grow',                  fr: 'Ma plantation',              sw: 'Bustani langu',             ha: 'Lambun gida',              tw: 'M\\u2019adua',                       hi: '\\u092E\\u0947\\u0930\\u0940 \\u092C\\u0917\\u0940\\u091A\\u0940' },",
  "  'home.profile.farmSubtitle':  { en: 'Default farm',             fr: 'Ferme par d\\u00e9faut',         sw: 'Shamba la kawaida',         ha: 'Gonar tsoho',              tw: 'Afuom titiriw',                  hi: '\\u0921\\u093F\\u092B\\u093C\\u0949\\u0932\\u094D\\u091F \\u0916\\u0947\\u0924' },",
  "  'home.profile.gardenSubtitle':{ en: 'Active garden',            fr: 'Jardin actif',                sw: 'Bustani inayotumika',       ha: 'Lambun ke aiki',           tw: 'Adua a wodi ho dwuma',           hi: '\\u0938\\u0915\\u094D\\u0930\\u093F\\u092F \\u092C\\u0917\\u0940\\u091A\\u093E' },",
  "  'home.profile.oneFarm':       { en: '1 farm',                   fr: '1 ferme',                     sw: 'Shamba 1',                  ha: 'Gona 1',                    tw: 'Afuom 1',                         hi: '1 \\u0916\\u0947\\u0924' },",
  "  'home.profile.nFarms':        { en: '{count} farms',            fr: '{count} fermes',              sw: 'Mashamba {count}',          ha: 'Gonaki {count}',           tw: 'Mfuom {count}',                  hi: '{count} \\u0916\\u0947\\u0924' },",
  "  'home.profile.onePlant':      { en: '1 plant',                  fr: '1 plante',                    sw: 'Mmea 1',                    ha: 'Tsiro 1',                  tw: 'Dua 1',                          hi: '1 \\u092A\\u094C\\u0927\\u093E' },",
  "  'home.profile.nPlants':       { en: '{count} plants',           fr: '{count} plantes',             sw: 'Mimea {count}',             ha: 'Tsire-tsire {count}',      tw: 'Nnua {count}',                   hi: '{count} \\u092A\\u094C\\u0927\\u0947' },",
  '',
  '  // Weather hero adaptive labels.',
  "  'weather.rainLaterToday':       { en: 'Rain later today',          fr: 'Pluie plus tard aujourd\\u2019hui', sw: 'Mvua baadaye leo',           ha: 'Ruwan sama daga baya yau',   tw: 'Os\\u016B b\\u025Bt\\u0254 nn\\u025B akyiri yi',  hi: '\\u0906\\u091C \\u092C\\u093E\\u0926 \\u092E\\u0947\\u0902 \\u092C\\u093E\\u0930\\u093F\\u0936' },",
  "  'weather.warmAfternoonExpected':{ en: 'Warm afternoon expected',   fr: 'Apr\\u00e8s-midi chaud attendu',     sw: 'Mchana wa joto unatarajiwa', ha: 'Ana sa ran rana mai zafi',   tw: 'Awia hyew b\\u025Bba',                          hi: '\\u0917\\u0930\\u094D\\u092E \\u0926\\u094B\\u092A\\u0939\\u0930 \\u0915\\u0940 \\u0938\\u0902\\u092D\\u093E\\u0935\\u0928\\u093E' },",
  "  'weather.partlyCloudy':         { en: 'Partly cloudy',             fr: 'Partiellement nuageux',         sw: 'Mawingu kidogo',             ha: 'Gajimare kaɗan',             tw: 'Omununkum kakra',                              hi: '\\u0906\\u0902\\u0936\\u093F\\u0915 \\u0930\\u0942\\u092A \\u0938\\u0947 \\u092C\\u093E\\u0926\\u0932' },",
  "  'weather.feelsLike':            { en: 'Feels like',                fr: 'Ressenti',                       sw: 'Inahisi kama',               ha: 'Yana ji kamar',              tw: 'Te s\\u025B',                                       hi: '\\u092E\\u0939\\u0938\\u0942\\u0938 \\u0939\\u094B\\u0924\\u093E \\u0939\\u0948' },",
  "  'weather.accurateAsOf':         { en: 'Accurate as of',            fr: 'Exact \\u00e0',                       sw: 'Sahihi tangu',               ha: 'Daidai tun',                 tw: 'Y\\u025B nokware fi',                              hi: '\\u0908\\u0938 \\u0938\\u092E\\u092F \\u0938\\u0939\\u0940' },",
  "  'weather.rainChance':           { en: 'rain chance',               fr: 'risque de pluie',                sw: 'uwezekano wa mvua',          ha: 'damar ruwan sama',           tw: 'os\\u016B akwanya',                              hi: '\\u092C\\u093E\\u0930\\u093F\\u0936 \\u0915\\u0940 \\u0938\\u0902\\u092D\\u093E\\u0935\\u0928\\u093E' },",
  "  'weather.windSpeed':            { en: 'wind',                      fr: 'vent',                          sw: 'upepo',                      ha: 'iska',                       tw: 'mframa',                                       hi: '\\u0939\\u0935\\u093E' },",
  "  'weather.humidityHint':         { en: 'soil hint',                 fr: 'indice sol',                    sw: 'dokezo la udongo',           ha: 'alamar \\u0199asa',                tw: 'mfutuma agyinatumi',                           hi: '\\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u0938\\u0902\\u0915\\u0947\\u0924' },",
  "  'weather.bestCheckMorning':     { en: 'Best before 10 AM',         fr: 'Mieux avant 10 h',              sw: 'Bora kabla ya saa 10 asubuhi', ha: 'Mafi kyau kafin karfe 10 na safe', tw: 'Eye papa ans\\u0101 10 AM',           hi: '\\u0938\\u0941\\u092C\\u0939 10 \\u092C\\u091C\\u0947 \\u0938\\u0947 \\u092A\\u0939\\u0932\\u0947 \\u092C\\u0947\\u0939\\u0924\\u0930' },",
  "  'weather.bestCheckMidday':      { en: 'Best around midday',        fr: 'Mieux vers midi',               sw: 'Bora karibu na adhuhuri',    ha: 'Mafi kyau kusan tsakar rana',tw: 'Eye papa b\\u025Bn awia',                            hi: '\\u0926\\u094B\\u092A\\u0939\\u0930 \\u0915\\u0947 \\u0906\\u0938\\u092A\\u093E\\u0938 \\u092C\\u0947\\u0939\\u0924\\u0930' },",
  "  'weather.bestCheckAfternoon':   { en: 'Best late afternoon',       fr: 'Mieux en fin d\\u2019apr\\u00e8s-midi', sw: 'Bora alasiri',               ha: 'Mafi kyau marece',           tw: 'Eye papa anwummer\\u025B',                       hi: '\\u0926\\u0947\\u0930 \\u0926\\u094B\\u092A\\u0939\\u0930 \\u092C\\u0947\\u0939\\u0924\\u0930' },",
  '',
  '  // Adaptive action labels (extra branches the helper resolves).',
  "  'actions.checkSoilBeforeNoon':  { en: 'Check soil before noon',    fr: 'V\\u00e9rifiez le sol avant midi', sw: 'Kagua udongo kabla ya adhuhuri', ha: 'Duba \\u0199asa kafin rana', tw: 'Hw\\u025B mfutuma ans\\u0101 awia',  hi: '\\u0926\\u094B\\u092A\\u0939\\u0930 \\u0938\\u0947 \\u092A\\u0939\\u0932\\u0947 \\u092E\\u093F\\u091F\\u094D\\u091F\\u0940 \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'actions.checkPlant':           { en: 'Check plant',               fr: 'V\\u00e9rifier la plante',         sw: 'Kagua mmea',                ha: 'Duba tsiro',                 tw: 'Hw\\u025B dua',                                hi: '\\u092A\\u094C\\u0927\\u093E \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  '',
  '  // Misc.',
  "  'common.min':                   { en: 'min',                       fr: 'min',                           sw: 'dakika',                    ha: 'min',                        tw: 'sima',                                          hi: '\\u092E\\u093F\\u0928\\u091F' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
