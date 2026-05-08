// Idempotent splicer for the premium-page i18n keys (May 2026
// premium-pages spec). Mirrors the prior splicers.
import fs from 'node:fs';

const FILE = 'src/i18n/translations.js';
const SENTINEL = '// ─── Premium pages spec';

const src = fs.readFileSync(FILE, 'utf8');
if (src.includes(SENTINEL)) {
  console.log('translations.js already contains the premium-pages block; skipping.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

const block = [
  '',
  '  ' + SENTINEL + ' (May 2026) ───────',
  '  // Eyebrows + hero titles + hero subtitles for the seven',
  '  // pages that adopt PremiumPageHero. Defensive English',
  '  // fallbacks ship with each row so a missing locale never',
  '  // blanks the hero band.',
  "  'premium.eyebrow.myFarm':    { en: 'My Farm',         fr: 'Ma ferme',          sw: 'Shamba langu',     ha: 'Gonata',                 tw: 'M\\u2019afuom',                 hi: '\\u092E\\u0947\\u0930\\u093E \\u0916\\u0947\\u0924' },",
  "  'premium.eyebrow.myGrow':    { en: 'My Grow',         fr: 'Ma plantation',      sw: 'Bustani langu',    ha: 'Lambun gida',           tw: 'M\\u2019adua',                  hi: '\\u092E\\u0947\\u0930\\u0940 \\u092C\\u0917\\u0940\\u091A\\u0940' },",
  "  'premium.eyebrow.progress': { en: 'Growth journey',   fr: 'Parcours de croissance', sw: 'Safari ya ukuaji',  ha: 'Tafiyar girma',          tw: 'Nyini\\u025B akwantuo',     hi: '\\u0935\\u093F\\u0915\\u093E\\u0938 \\u092F\\u093E\\u0924\\u094D\\u0930\\u093E' },",
  "  'premium.eyebrow.tasks':    { en: 'Today',            fr: 'Aujourd\\u2019hui',     sw: 'Leo',              ha: 'Yau',                    tw: 'Nn\\u025B',                     hi: '\\u0906\\u091C' },",
  "  'premium.eyebrow.scan':     { en: 'Scan',             fr: 'Scan',                sw: 'Skani',            ha: 'Bincike',                tw: 'Hwehw\\u025B',                 hi: '\\u0938\\u094D\\u0915\\u0948\\u0928' },",
  "  'premium.eyebrow.sell':     { en: 'Sell',             fr: 'Vendre',              sw: 'Uza',              ha: 'Sayar',                  tw: 'T\\u0254n',                       hi: '\\u092C\\u0947\\u091A\\u0947\\u0902' },",
  "  'premium.eyebrow.funding':  { en: 'Funding',          fr: 'Financement',         sw: 'Ufadhili',         ha: 'Tallafi',                tw: 'Sika afotuo',                hi: '\\u092B\\u0902\\u0921\\u093F\\u0902\\u0917' },",
  '',
  '  // Hero titles + subtitles. Short, calm, action-oriented.',
  "  'myFarm.hero.title':       { en: 'Your farm at a glance',     fr: 'Votre ferme en un coup d\\u2019\\u0153il', sw: 'Shamba lako kwa mtazamo',  ha: 'Gonarka cikin sauri',     tw: 'Wo afuom mu nsem ntiantia',         hi: '\\u090F\\u0915 \\u0928\\u091C\\u0930 \\u092E\\u0947\\u0902 \\u0906\\u092A\\u0915\\u0940 \\u0916\\u0947\\u0924\\u0940' },",
  "  'myFarm.hero.subtitle':    { en: 'Plan, monitor, and grow with confidence.', fr: 'Planifiez, surveillez et cultivez en toute confiance.', sw: 'Panga, fuatilia, na kuza kwa ujasiri.', ha: 'Tsara, sa ido, kuma noma da kwarin gwiwa.', tw: 'Yi nhyehy\\u025B\\u025B, hw\\u025B so, na yere y\\u025B\\u025B nyini\\u025B.', hi: '\\u092F\\u094B\\u091C\\u0928\\u093E \\u092C\\u0928\\u093E\\u090F\\u0902, \\u0928\\u093F\\u0917\\u0930\\u093E\\u0928\\u0940 \\u0915\\u0930\\u0947\\u0902, \\u0935\\u093F\\u0936\\u094D\\u0935\\u093E\\u0938 \\u0938\\u0947 \\u092C\\u0922\\u093C\\u0947\\u0902\\u0964' },",
  "  'myGrow.hero.title':       { en: 'Your living garden',         fr: 'Votre jardin vivant',                    sw: 'Bustani yako hai',         ha: 'Lambunka mai rai',         tw: 'Wo adua a etaa nkwa',                hi: '\\u0906\\u092A\\u0915\\u0940 \\u091C\\u0940\\u0935\\u0902\\u0924 \\u092C\\u0917\\u0940\\u091A\\u0940' },",
  "  'myGrow.hero.subtitle':    { en: 'Care for your plants, watch them grow.', fr: 'Prenez soin de vos plantes, regardez-les grandir.', sw: 'Tunza mimea yako, ukue.', ha: 'Kula da tsire-tsiren ka, ka kalle su girma.', tw: 'Hw\\u025B wo nnua so, hw\\u025B s\\u025Bdi\\u025B \\u025Bnyin.', hi: '\\u0905\\u092A\\u0928\\u0947 \\u092A\\u094C\\u0927\\u094B\\u0902 \\u0915\\u0940 \\u0926\\u0947\\u0916\\u092D\\u093E\\u0932 \\u0915\\u0930\\u0947\\u0902, \\u0909\\u0928\\u094D\\u0939\\u0947\\u0902 \\u092C\\u0922\\u093C\\u0924\\u0947 \\u0926\\u0947\\u0916\\u0947\\u0902\\u0964' },",
  "  'progress.hero.title':     { en: 'Your growth journey',        fr: 'Votre parcours de croissance',           sw: 'Safari yako ya ukuaji',    ha: 'Tafiyar girmanka',         tw: 'Wo nyini\\u025B akwantuo',                  hi: '\\u0906\\u092A\\u0915\\u0940 \\u0935\\u093F\\u0915\\u093E\\u0938 \\u092F\\u093E\\u0924\\u094D\\u0930\\u093E' },",
  "  'progress.hero.subtitle':  { en: 'Watch each stage build toward harvest.', fr: 'Voyez chaque \\u00e9tape mener \\u00e0 la r\\u00e9colte.', sw: 'Tazama kila hatua ikielekea mavuno.', ha: 'Duba kowane mataki yana kai ga girbi.', tw: 'Hw\\u025B s\\u025Bdi\\u025B kwan biara siw twa toa.',  hi: '\\u0939\\u0930 \\u091A\\u0930\\u0923 \\u0915\\u094B \\u0915\\u091F\\u093E\\u0908 \\u0915\\u0940 \\u0913\\u0930 \\u092C\\u0922\\u093C\\u0924\\u0947 \\u0939\\u0941\\u090F \\u0926\\u0947\\u0916\\u0947\\u0902\\u0964' },",
  "  'tasks.hero.subtitle':     { en: 'One clear task at a time \\u2014 pick the next one.', fr: 'Une t\\u00e2che claire \\u00e0 la fois, choisissez la suivante.', sw: 'Kazi moja wazi kwa wakati \\u2014 chagua inayofuata.', ha: 'Aiki \\u0257aya bayyananne a kowane lokaci \\u2014 ka zabi na gaba.', tw: 'Adwuma baako p\\u025B b\\u025Bba s\\u025B \\u2014 yi a edi hɔ.', hi: '\\u090F\\u0915 \\u0938\\u093E\\u0925 \\u090F\\u0915 \\u0938\\u094D\\u092A\\u0937\\u094D\\u091F \\u0915\\u093E\\u0930\\u094D\\u092F \\u2014 \\u0905\\u0917\\u0932\\u093E \\u091A\\u0941\\u0928\\u0947\\u0902\\u0964' },",
].join(eol);

const closing = src.lastIndexOf(eol + '};');
if (closing < 0) {
  console.error('Could not locate end of T dictionary; aborting.');
  process.exit(1);
}

const updated = src.slice(0, closing) + eol + block + src.slice(closing);
fs.writeFileSync(FILE, updated, 'utf8');
console.log('Inserted ' + block.split(eol).length + ' lines into translations.js.');
