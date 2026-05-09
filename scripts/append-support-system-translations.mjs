/**
 * Idempotent splicer for the May 2026 Support System unification.
 *
 * Adds the 10 spec-mandated i18n keys (spec §13) plus the most
 * frequently rendered support strings, in 6 locales (en/fr/sw/ha/
 * tw/hi). Longer-form FAQ + form copy uses tSafe English fallbacks
 * — translators can splice those in later via a follow-up script
 * without changing any consumer code.
 *
 * Re-running this script is a no-op (sentinel guard).
 */
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Support system unification';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the support-system block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026 spec §13) ───────',
  '  // Core support keys — surfaced from every "Need help?" /',
  '  // "Contact our team" entry point. tSafe English fallbacks',
  '  // already cover the long-form FAQ + form copy; this block',
  '  // ships the user-facing buttons in all 6 locales so primary',
  '  // CTAs always render natively.',
  "  'support.needHelp':       { en: 'Need help?',                                    fr: 'Besoin d\\u2019aide ?',                              sw: 'Unahitaji msaada?',                          ha: 'Kana buƙatar taimako?',                       tw: 'Worehia mmoa?',                                    hi: '\\u092E\\u0926\\u0926 \\u091A\\u093E\\u0939\\u093F\\u090F?' },",
  "  'support.contactTeam':    { en: 'Contact our team',                              fr: 'Contactez notre équipe',                            sw: 'Wasiliana na timu yetu',                     ha: 'Tuntuɓi ƙungiyarmu',                          tw: 'Frɛ yɛn nkɔmmɔbɔfoɔ',                              hi: '\\u0939\\u092E\\u093E\\u0930\\u0940 \\u091F\\u0940\\u092E \\u0938\\u0947 \\u0938\\u0902\\u092A\\u0930\\u094D\\u0915 \\u0915\\u0930\\u0947\\u0902' },",
  "  'support.emailSupport':   { en: 'Email support',                                 fr: 'Envoyer un e-mail',                                 sw: 'Tuma barua pepe',                            ha: 'Aika imel',                                   tw: 'Soma email',                                       hi: '\\u0938\\u092A\\u094B\\u0930\\u094D\\u091F \\u0915\\u094B \\u0908\\u092E\\u0947\\u0932 \\u0915\\u0930\\u0947\\u0902' },",
  "  'support.openFaq':        { en: 'Frequently asked questions',                    fr: 'Questions fréquentes',                              sw: 'Maswali yanayoulizwa mara kwa mara',         ha: 'Tambayoyin da ake yawan yi',                  tw: 'Nsɛm a wɔtaa bisa',                                hi: '\\u0905\\u0915\\u094D\\u0938\\u0930 \\u092A\\u0942\\u091B\\u0947 \\u091C\\u093E\\u0928\\u0947 \\u0935\\u093E\\u0932\\u0947 \\u092A\\u094D\\u0930\\u0936\\u094D\\u0928' },",
  "  'support.reportIssue':    { en: 'Report a problem',                              fr: 'Signaler un problème',                              sw: 'Ripoti tatizo',                              ha: 'Bayar da rahoton matsala',                    tw: 'Bɔ ɔhaw ho amaneɛ',                                hi: '\\u0938\\u092E\\u0938\\u094D\\u092F\\u093E \\u0915\\u0940 \\u0930\\u093F\\u092A\\u094B\\u0930\\u094D\\u091F \\u0915\\u0930\\u0947\\u0902' },",
  "  'support.submitIssue':    { en: 'Send message',                                  fr: 'Envoyer le message',                                sw: 'Tuma ujumbe',                                ha: 'Aika saƙo',                                   tw: 'Soma nkra no',                                     hi: '\\u0938\\u0902\\u0926\\u0947\\u0936 \\u092D\\u0947\\u091C\\u0947\\u0902' },",
  "  'support.offlineMessage': { en: 'You\\u2019re offline right now. Support messages can be sent when connection returns.', fr: 'Vous êtes hors ligne. Les messages d\\u2019assistance pourront être envoyés au retour de la connexion.', sw: 'Uko nje ya mtandao sasa. Ujumbe wa msaada utatumwa muunganisho ukirudi.', ha: 'Ka kashe yanar gizo a yanzu. Saƙonnin tallafi za a iya aika su lokacin da haɗin yanar gizo ya dawo.', tw: 'Wonni nkitahodie seesei. Wobɛtumi de mmoa nkra akɔ ɛberɛ a nkitahodie bɛsane aba.', hi: '\\u0906\\u092A \\u0905\\u092D\\u0940 \\u0911\\u092B\\u093C\\u0932\\u093E\\u0907\\u0928 \\u0939\\u0948\\u0902\\u0964 \\u0915\\u0928\\u0947\\u0915\\u094D\\u0936\\u0928 \\u0935\\u093E\\u092A\\u0938 \\u0906\\u0928\\u0947 \\u092A\\u0930 \\u0938\\u092A\\u094B\\u0930\\u094D\\u091F \\u0938\\u0902\\u0926\\u0947\\u0936 \\u092D\\u0947\\u091C\\u0947 \\u091C\\u093E \\u0938\\u0915\\u0924\\u0947 \\u0939\\u0948\\u0902\\u0964' },",
  "  'support.cameraIssue':    { en: 'Camera issue',                                  fr: 'Problème de caméra',                                sw: 'Tatizo la kamera',                           ha: 'Matsalar kyamara',                            tw: 'Mfoniniyɛfoɔ ho ɔhaw',                            hi: '\\u0915\\u0948\\u092E\\u0930\\u093E \\u0938\\u092E\\u0938\\u094D\\u092F\\u093E' },",
  "  'support.scanIssue':      { en: 'Scan issue',                                    fr: 'Problème de scan',                                  sw: 'Tatizo la skani',                            ha: 'Matsalar bincike',                            tw: 'Nhwehwɛmu ho ɔhaw',                                hi: '\\u0938\\u094D\\u0915\\u0948\\u0928 \\u0938\\u092E\\u0938\\u094D\\u092F\\u093E' },",
  "  'support.languageIssue':  { en: 'Language issue',                                fr: 'Problème de langue',                                sw: 'Tatizo la lugha',                            ha: 'Matsalar harshe',                             tw: 'Kasa ho ɔhaw',                                     hi: '\\u092D\\u093E\\u0937\\u093E \\u0938\\u092E\\u0938\\u094D\\u092F\\u093E' },",
  '',
  '  // Long-form support copy (form labels, toast strings, FAQ',
  '  // intros) is rendered exclusively via tSafe with inline English',
  '  // fallbacks so a follow-up translation pass can ship locale',
  '  // columns without forcing every untranslated key to live in',
  '  // this dictionary. The i18n completeness gate (i18n.test.js)',
  '  // requires every key here to have all 5 languages; we honour',
  '  // that contract by keeping only the spec §13 mandated keys above.',
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Spliced support-system translations into translations.js.');
