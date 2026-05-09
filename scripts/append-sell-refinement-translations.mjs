// Idempotent splicer for the Sell-refinement i18n keys
// (May 2026 spec §17).
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Sell refinement spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the sell-refinement block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Premium hero + region intelligence + market insight copy.',
  "  'sell.title':              { en: 'Sell your produce',                                  fr: 'Vendez vos produits',                                          sw: 'Uza mazao yako',                                ha: 'Sayar da amfanin gonarka',                       tw: 'T\\u0254n wo afuom afi',                                  hi: '\\u0905\\u092A\\u0928\\u0940 \\u0909\\u092A\\u091C \\u092C\\u0947\\u091A\\u0947\\u0902' },",
  "  'sell.subtitle':           { en: 'Let nearby buyers know when your crop is ready.',     fr: 'Faites savoir aux acheteurs voisins quand votre culture est prête.', sw: 'Waambie wanunuzi wa karibu wakati zao lako liko tayari.', ha: 'Sanar da masu siye da ke kusa lokacin da amfanin gonarka ya shirya.', tw: 'Ma at\\u0254ftofo\\u0254 a w\\u025Bb\\u025Bn nhu s\\u025B wo afuom asi.', hi: '\\u0928\\u091C\\u0926\\u0940\\u0915\\u0940 \\u0916\\u0930\\u0940\\u0926\\u093E\\u0930\\u094B\\u0902 \\u0915\\u094B \\u092C\\u0924\\u093E\\u090F\\u0902 \\u0915\\u093F \\u0906\\u092A\\u0915\\u0940 \\u092B\\u0938\\u0932 \\u0924\\u0948\\u092F\\u093E\\u0930 \\u0939\\u0948\\u0964' },",
  "  'sell.regionNotSet':       { en: 'Region not set',                                       fr: 'Région non définie',                                            sw: 'Eneo halijawekwa',                              ha: 'Yanki ba a saita ba',                            tw: 'Mantam nh\\u0254',                                            hi: '\\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u0938\\u0947\\u091F \\u0928\\u0939\\u0940\\u0902 \\u0939\\u0948' },",
  "  'sell.setRegion':          { en: 'Set region',                                           fr: 'Définir la région',                                             sw: 'Weka eneo',                                     ha: 'Saita yanki',                                    tw: 'Hyɛ mantam',                                                  hi: '\\u0915\\u094D\\u0937\\u0947\\u0924\\u094D\\u0930 \\u0938\\u0947\\u091F \\u0915\\u0930\\u0947\\u0902' },",
  "  'sell.marketInsight':      { en: 'Listings with a recent photo and clear ready date attract more buyer interest.', fr: 'Les annonces avec une photo récente et une date claire attirent plus d\\u2019acheteurs.', sw: 'Matangazo yenye picha ya hivi karibuni na tarehe wazi huvutia wanunuzi zaidi.', ha: 'Tallace-tallace masu hoto na kwanan nan da ranar shirya bayyananne suna jan hankalin masu siye.', tw: 'Nhwehw\\u025Bmu a \\u025Bw\\u0254 mfoni\\u025B foforɔ ne kwan asi mu y\\u025B at\\u0254ftofo\\u0254 anigye.', hi: '\\u0939\\u093E\\u0932 \\u0915\\u0940 \\u092B\\u093C\\u094B\\u091F\\u094B \\u0914\\u0930 \\u0938\\u094D\\u092A\\u0937\\u094D\\u091F \\u0924\\u0948\\u092F\\u093E\\u0930\\u0940 \\u0915\\u0940 \\u0924\\u093E\\u0930\\u0940\\u0916 \\u0935\\u093E\\u0932\\u0940 \\u0938\\u0942\\u091A\\u0940\\u092F\\u093E\\u0902 \\u0905\\u0927\\u093F\\u0915 \\u0916\\u0930\\u0940\\u0926\\u093E\\u0930\\u094B\\u0902 \\u0915\\u094B \\u0906\\u0915\\u0930\\u094D\\u0937\\u093F\\u0924 \\u0915\\u0930\\u0924\\u0940 \\u0939\\u0948\\u0902\\u0964' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
