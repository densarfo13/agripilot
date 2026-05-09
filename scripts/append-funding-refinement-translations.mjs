// Idempotent splicer for the funding-refinement i18n keys
// (May 2026 spec §14).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Funding refinement spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the funding-refinement block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Premium hero copy — visual opportunity guidance, not a',
  '  // grant database. Each row ships with a defensive English',
  '  // fallback so the hero never blanks.',
  "  'funding.title':              { en: 'Funding & Support',                 fr: 'Financement et soutien',                  sw: 'Ufadhili na msaada',                ha: 'Tallafi da goyon baya',              tw: 'Sika afotuo ne mmoa',                          hi: '\\u092B\\u0902\\u0921\\u093F\\u0902\\u0917 \\u0914\\u0930 \\u0938\\u0939\\u093E\\u092F\\u0924\\u093E' },",
  "  'funding.subtitle':           { en: 'Opportunities that may help your farm grow.', fr: 'Des opportunités qui peuvent aider votre ferme à grandir.', sw: 'Fursa zinazoweza kusaidia shamba lako kukua.', ha: 'Damar da za su iya taimaka wa gonarka girma.', tw: 'Akwannya a \\u025Bb\\u025Btumi aboa wo afuom anyini.', hi: '\\u0905\\u0935\\u0938\\u0930 \\u091C\\u094B \\u0906\\u092A\\u0915\\u0947 \\u0916\\u0947\\u0924 \\u0915\\u094B \\u092C\\u0922\\u093C\\u0928\\u0947 \\u092E\\u0947\\u0902 \\u092E\\u0926\\u0926 \\u0915\\u0930 \\u0938\\u0915\\u0924\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  "  'funding.verifiedPrograms':   { en: 'Verified programs',                  fr: 'Programmes vérifiés',                     sw: 'Programu zilizothibitishwa',         ha: 'Shirye-shiryen da aka tabbatar',     tw: 'Nhyehy\\u025B\\u025B a y\\u025Be hu',                    hi: '\\u0938\\u0924\\u094D\\u092F\\u093E\\u092A\\u093F\\u0924 \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E' },",
  "  'funding.relevantRegion':     { en: 'Relevant to your region',           fr: 'Pertinent pour votre région',             sw: 'Inahusiana na eneo lako',            ha: 'Da ya dace da yankinka',             tw: 'Ɛfata wo mantam',                              hi: '\\u0906\\u092A\\u0915\\u0947 \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u0938\\u0947 \\u0938\\u0902\\u092C\\u0902\\u0927\\u093F\\u0924' },",
  "  'funding.sustainableGrowth':  { en: 'Supports sustainable growth',       fr: 'Soutient une croissance durable',         sw: 'Inasaidia ukuaji endelevu',          ha: 'Tana goyan bayan ci gaba mai dorewa', tw: 'Boa nyini\\u025B a \\u025Bda nkw\\u016B mu',          hi: '\\u0938\\u094D\\u0925\\u093E\\u092F\\u0940 \\u0935\\u093F\\u0915\\u093E\\u0938 \\u0915\\u094B \\u0938\\u092E\\u0930\\u094D\\u0925\\u0928 \\u0915\\u0930\\u0924\\u093E \\u0939\\u0948' },",
  '',
  '  // Recommended-section title + subtitle.',
  "  'funding.recommendedForYou':  { en: 'Recommended for you',                fr: 'Recommandé pour vous',                    sw: 'Imependekezwa kwako',                ha: 'An ba da shawarar a gare ka',        tw: 'Y\\u025Bde ma wo',                               hi: '\\u0906\\u092A\\u0915\\u0947 \\u0932\\u093F\\u090F \\u0905\\u0928\\u0941\\u0936\\u0902\\u0938\\u093F\\u0924' },",
  "  'funding.basedOnProfile':     { en: 'Based on your region, crops, and farm profile.', fr: 'D\\u2019après votre région, vos cultures et votre profil de ferme.', sw: 'Kulingana na eneo lako, mazao, na wasifu wa shamba.', ha: 'Bisa ga yankinka, amfanin gona, da bayanin gona.', tw: 'Egyina wo mantam, afuom afi, ne afuom nsem so.',  hi: '\\u0906\\u092A\\u0915\\u0947 \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930, \\u092B\\u0938\\u0932\\u094B\\u0902 \\u0914\\u0930 \\u0916\\u0947\\u0924 \\u092A\\u094D\\u0930\\u094B\\u092B\\u093E\\u0907\\u0932 \\u0915\\u0947 \\u0906\\u0927\\u093E\\u0930 \\u092A\\u0930\\u0964' },",
  '',
  '  // Region intelligence bar.',
  "  'funding.programsActiveIn':   { en: 'Programs active in',                 fr: 'Programmes actifs en',                    sw: 'Programu zinazoendelea',             ha: 'Shirye-shirye da ke aiki a',         tw: 'Nhyehy\\u025B\\u025B a wodi dwuma w\\u0254',          hi: '\\u0907\\u0928 \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930\\u094B\\u0902 \\u092E\\u0947\\u0902 \\u0938\\u0915\\u094D\\u0930\\u093F\\u092F \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E' },",
  "  'funding.regionUnknown':      { en: 'Programs matched to your region',    fr: 'Programmes adaptés à votre région',       sw: 'Programu zilizolinganishwa na eneo lako', ha: 'Shirye-shiryen da suka dace da yankinka', tw: 'Nhyehy\\u025B\\u025B a \\u025Bne wo mantam hyia',  hi: '\\u0906\\u092A\\u0915\\u0947 \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u0938\\u0947 \\u092E\\u0947\\u0932 \\u0916\\u093E\\u0924\\u0947 \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E' },",
  "  'funding.changeRegion':       { en: 'Change',                              fr: 'Changer',                                  sw: 'Badilisha',                          ha: 'Canza',                              tw: 'Sesa',                                          hi: '\\u092C\\u0926\\u0932\\u0947\\u0902' },",
  "  'funding.setRegion':          { en: 'Set region',                          fr: 'Définir la région',                        sw: 'Weka eneo',                          ha: 'Saita yanki',                        tw: 'Hyɛ mantam',                                  hi: '\\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u0938\\u0947\\u091F \\u0915\\u0930\\u0947\\u0902' },",
  '',
  '  // Funding card — softened labels.',
  "  'funding.card.recommendedBecause': { en: 'Recommended because', fr: 'Recommandé parce que',  sw: 'Imependekezwa kwa sababu',  ha: 'An ba da shawara saboda', tw: 'Y\\u025Bde ma efis\\u025B',  hi: '\\u0905\\u0928\\u0941\\u0936\\u0902\\u0938\\u093F\\u0924 \\u0915\\u094D\\u092F\\u094B\\u0902\\u0915\\u093F' },",
  "  'funding.card.supports':           { en: 'Supports',           fr: 'Soutient',              sw: 'Inasaidia',                  ha: 'Yana goyan baya',         tw: 'Boa',                          hi: '\\u0938\\u092E\\u0930\\u094D\\u0925\\u0928 \\u0915\\u0930\\u0924\\u093E \\u0939\\u0948' },",
  "  'funding.checkEligibility':       { en: 'Check eligibility',  fr: 'Vérifier l\\u2019éligibilité',  sw: 'Kagua ustahiki',                  ha: 'Duba cancantar',           tw: 'Hw\\u025B s\\u025B w\\u0254y\\u025B',          hi: '\\u092A\\u093E\\u0924\\u094D\\u0930\\u0924\\u093E \\u091C\\u093E\\u0901\\u091A\\u0947\\u0902' },",
  "  'funding.learnMore':              { en: 'Learn more',          fr: 'En savoir plus',         sw: 'Jifunze zaidi',                   ha: 'Koyi ƙari',                tw: 'Sua bi nim',                    hi: '\\u0905\\u0927\\u093F\\u0915 \\u091C\\u093E\\u0928\\u0947\\u0902' },",
  '',
  '  // Empty + trust note.',
  "  'funding.noMatches':         { en: 'No matching programs yet',                          fr: 'Aucun programme correspondant pour l\\u2019instant',           sw: 'Hakuna programu zinazolingana bado',                ha: 'Babu shirye-shiryen da suka dace tukuna',     tw: 'Nhyehy\\u025B\\u025B biara nhyia mfi\\u0254 ho',         hi: '\\u0905\\u092D\\u0940 \\u0924\\u0915 \\u0915\\u094B\\u0908 \\u092E\\u0947\\u0932 \\u0916\\u093E\\u0924\\u093E \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E \\u0928\\u0939\\u0940\\u0902' },",
  "  'funding.verifyOfficial':    { en: 'Always verify details with the official program before applying.', fr: 'Vérifiez toujours les détails auprès du programme officiel avant de postuler.', sw: 'Daima thibitisha maelezo na programu rasmi kabla ya kuomba.', ha: 'Ka tabbatar da bayanai daga shirin hukuma kafin ka nemi.', tw: 'Bere biara hw\\u025B nokware no fi nhyehy\\u025B\\u025B ankasa hɔ ans\\u0101 woaby\\u025B obi.', hi: '\\u0906\\u0935\\u0947\\u0926\\u0928 \\u0915\\u0930\\u0928\\u0947 \\u0938\\u0947 \\u092A\\u0939\\u0932\\u0947 \\u0939\\u092E\\u0947\\u0936\\u093E \\u0906\\u0927\\u093F\\u0915\\u093E\\u0930\\u093F\\u0915 \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E \\u0915\\u0947 \\u0938\\u093E\\u0925 \\u0935\\u093F\\u0935\\u0930\\u0923 \\u0938\\u0924\\u094D\\u092F\\u093E\\u092A\\u093F\\u0924 \\u0915\\u0930\\u0947\\u0902\\u0964' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
