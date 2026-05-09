// Idempotent splicer for the My Farm gap-fix i18n keys
// (May 2026 spec §5 + §10 — sheet + opportunities).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── My Farm gap-fix spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the my-farm gap-fix block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Manage-farm sheet sub-labels + opportunities card copy.',
  "  'farm.manage.editSub':       { en: 'Update name, location, crop or stage.',  fr: 'Mettez à jour le nom, le lieu, la culture ou l\\u2019étape.', sw: 'Sasisha jina, eneo, zao au hatua.', ha: 'Sabunta suna, wuri, amfanin gona ko mataki.', tw: 'Sesa edin, beae, afuom afi anaa anammɔn.', hi: '\\u0928\\u093E\\u092E, \\u0938\\u094D\\u0925\\u093E\\u0928, \\u092B\\u0938\\u0932 \\u092F\\u093E \\u091A\\u0930\\u0923 \\u0905\\u092A\\u0921\\u0947\\u091F \\u0915\\u0930\\u0947\\u0902\\u0964' },",
  "  'farm.manage.photoSub':      { en: 'Add a real photo of your farm.',         fr: 'Ajoutez une vraie photo de votre ferme.',                      sw: 'Ongeza picha halisi ya shamba lako.', ha: 'Ƙara hoto na gaske na gonarka.',          tw: 'Fa wo afuom mfoni\\u025B paa to so.',         hi: '\\u0905\\u092A\\u0928\\u0947 \\u0916\\u0947\\u0924 \\u0915\\u0940 \\u0905\\u0938\\u0932\\u0940 \\u092B\\u093C\\u094B\\u091F\\u094B \\u091C\\u094B\\u0921\\u093C\\u0947\\u0902\\u0964' },",
  "  'farm.manage.switch':        { en: 'Switch farm',                            fr: 'Changer de ferme',                                            sw: 'Badilisha shamba',                  ha: 'Canza gona',                              tw: 'Sesa afuom',                                  hi: '\\u0916\\u0947\\u0924 \\u092C\\u0926\\u0932\\u0947\\u0902' },",
  "  'farm.manage.switchSub':     { en: 'Choose a different farm to view.',       fr: 'Choisissez une autre ferme à afficher.',                     sw: 'Chagua shamba lingine la kutazama.', ha: 'Zaɓi wata gona don dubawa.',             tw: 'Yi afuom foforɔ a w\\u025Bb\\u025Bhw\\u025B.', hi: '\\u0926\\u0947\\u0916\\u0928\\u0947 \\u0915\\u0947 \\u0932\\u093F\\u090F \\u0915\\u094B\\u0908 \\u0926\\u0942\\u0938\\u0930\\u093E \\u0916\\u0947\\u0924 \\u091A\\u0941\\u0928\\u0947\\u0902\\u0964' },",
  "  'farm.manage.addSub':        { en: 'Set up another growing space.',          fr: 'Configurer un autre espace de culture.',                      sw: 'Anzisha eneo lingine la kupanda.',  ha: 'Saita wani fili na shuka.',               tw: 'Yiyi afuom foforɔ.',                          hi: '\\u090F\\u0915 \\u0914\\u0930 \\u0909\\u0917\\u093E\\u0928\\u0947 \\u0915\\u0940 \\u091C\\u0917\\u0939 \\u0938\\u0947\\u091F \\u0915\\u0930\\u0947\\u0902\\u0964' },",
  '',
  '  // Farm opportunities card.',
  "  'farm.opportunities.title':   { en: 'Farm opportunities',     fr: 'Opportunités pour la ferme',                  sw: 'Fursa za shamba',              ha: 'Damar gona',                       tw: 'Afuom mu akwannya',                                hi: '\\u0916\\u0947\\u0924 \\u0915\\u0947 \\u0905\\u0935\\u0938\\u0930' },",
  "  'farm.opportunities.funding': { en: 'Funding',                fr: 'Financement',                                  sw: 'Ufadhili',                     ha: 'Tallafi',                          tw: 'Sika afotuo',                                       hi: '\\u092B\\u0902\\u0921\\u093F\\u0902\\u0917' },",
  "  'farm.opportunities.fundingSub': { en: 'See programs in your region.', fr: 'Voir les programmes de votre région.',         sw: 'Tazama programu katika eneo lako.', ha: 'Duba shirye-shirye a yankinka.', tw: 'Hw\\u025B nhyehy\\u025B\\u025B w\\u0254 wo mantam.',                hi: '\\u0905\\u092A\\u0928\\u0947 \\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u092E\\u0947\\u0902 \\u0915\\u093E\\u0930\\u094D\\u092F\\u0915\\u094D\\u0930\\u092E \\u0926\\u0947\\u0916\\u0947\\u0902\\u0964' },",
  "  'farm.opportunities.sell':    { en: 'Sell produce',                fr: 'Vendre les produits',                          sw: 'Uza mazao',                    ha: 'Sayar da amfanin gona',           tw: 'T\\u0254n afuom afi',                              hi: '\\u0909\\u092A\\u091C \\u092C\\u0947\\u091A\\u0947\\u0902' },",
  "  'farm.opportunities.sellSub': { en: 'Reach buyers when your harvest is ready.', fr: 'Touchez les acheteurs quand votre récolte est prête.', sw: 'Fikia wanunuzi mavuno yako yakiwa tayari.', ha: 'Isa ga masu siye lokacin da girbinka ya shirya.', tw: 'B\\u025Bn at\\u0254ftofo\\u0254 ber\\u025B a wo otwabere asi.', hi: '\\u0915\\u091F\\u093E\\u0908 \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u094B\\u0928\\u0947 \\u092A\\u0930 \\u0916\\u0930\\u0940\\u0926\\u093E\\u0930\\u094B\\u0902 \\u0924\\u0915 \\u092A\\u0939\\u0941\\u0902\\u091A\\u0947\\u0902\\u0964' },",
  '',
  '  // Common actions.',
  "  'common.close':               { en: 'Close',                  fr: 'Fermer',                                       sw: 'Funga',                        ha: 'Rufe',                            tw: 'To mu',                                            hi: '\\u092C\\u0902\\u0926 \\u0915\\u0930\\u0947\\u0902' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
