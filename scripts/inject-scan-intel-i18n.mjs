/**
 * inject-scan-intel-i18n.mjs — sprint #222 (one-off).
 * Registers the 46 scan.intel.* + scanCommand.* keys that the PRODUCTION
 * scan cards (IntelligentScanResult, ScanCommandCard) call via tSafe() but
 * which were never registered in ANY column — so they rendered hardcoded
 * English in every locale, including Twi (the pilot language). Invisible to
 * check:translations because the gate only checks keys that exist in T-en.
 * Injects each key after the stable "scan.retake" anchor line in all 6
 * columns with real translations (tw/fr/sw/ha at 100%; hi to hold ratchet).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ANCHOR = '"scan.retake":';

// [key, en, tw, fr, sw, ha, hi]
const ROWS = [
  // ── scanCommand.* (ScanCommandCard) ──
  ['scanCommand.eyebrow','Scan Command Center','Nhwehwɛmu Adwumayɛbea','Centre de diagnostic','Kituo cha Uchunguzi','Cibiyar Bincike','स्कैन केंद्र'],
  ['scanCommand.footnote','Decision support, not a guarantee.','Ɛyɛ akwankyerɛ, ɛnyɛ awardeɛ.','Aide à la décision, pas une garantie.','Msaada wa maamuzi, si dhamana.','Taimakon yanke shawara, ba tabbaci ba.','निर्णय में सहायता, गारंटी नहीं।'],
  ['scanCommand.row.plant','Plant','Afifideɛ','Plante','Mmea','Shuka','पौधा'],
  ['scanCommand.row.disease','Disease','Yadeɛ','Maladie','Ugonjwa','Cuta','रोग'],
  ['scanCommand.row.pest','Pest','Mmoawa','Ravageur','Wadudu','Kwari','कीट'],
  ['scanCommand.row.soil','Soil','Dɔteɛ','Sol','Udongo','Ƙasa','मिट्टी'],
  ['scanCommand.row.market','Market','Dwa','Marché','Soko','Kasuwa','बाज़ार'],
  ['scanCommand.row.region','Region','Mpɔtam','Région','Eneo','Yanki','क्षेत्र'],
  ['scanCommand.row.satellite','Satellite','Satɛlaet','Satellite','Setilaiti','Tauraron dan adam','उपग्रह'],
  ['scanCommand.row.growth','Stage','Nyiniɛ','Stade','Hatua','Matakin girma','अवस्था'],
  // ── scan.intel.* (IntelligentScanResult) ──
  ['scan.intel.voice.label','Voice','Nne','Voix','Sauti','Murya','आवाज़'],
  ['scan.intel.voice.listen','Listen','Tie','Écouter','Sikiliza','Saurara','सुनें'],
  ['scan.intel.voice.stop','Stop','Gyae','Arrêter','Simamisha','Tsaya','रोकें'],
  ['scan.intel.voice.severity','Severity','Emu den','Gravité','Ukali','Tsananin','गंभीरता'],
  ['scan.intel.voice.tryAction','Suggested action','Deɛ wobɛyɛ','Action suggérée','Hatua iliyopendekezwa','Shawarar aiki','सुझाई गई क्रिया'],
  ['scan.intel.voice.identified','This looks like','Ɛte sɛ','Cela ressemble à','Hii inaonekana kama','Wannan yana kama da','यह दिखता है'],
  ['scan.intel.plant.title','Plant identification','Afifideɛ a wɔahu','Identification de la plante','Utambuzi wa mmea','Gane shuka','पौधे की पहचान'],
  ['scan.intel.plant.confidence','sure','gyidie','sûr','uhakika','tabbaci','निश्चित'],
  ['scan.intel.flower.title','Flower details','Nhwiren ho nsɛm','Détails de la fleur','Maelezo ya ua','Bayanin furen','फूल का विवरण'],
  ['scan.intel.flower.type','Type','Suban','Type','Aina','Iri','प्रकार'],
  ['scan.intel.flower.growingTips','Growing tips','Dua ho afotuo','Conseils de culture','Vidokezo vya kilimo','Shawarwarin noma','उगाने के सुझाव'],
  ['scan.intel.health.title','Crop health','Afifideɛ apɔmuden','Santé de la culture','Afya ya zao','Lafiyar shuka','फसल स्वास्थ्य'],
  ['scan.intel.health.severityLabel','Severity','Emu den','Gravité','Ukali','Tsananin','गंभीरता'],
  ['scan.intel.health.affected','Affected area','Baabi a aka','Zone touchée','Eneo lililoathiriwa','Wurin da abin ya shafa','प्रभावित क्षेत्र'],
  ['scan.intel.treatment.title','Treatment','Ayaresa','Traitement','Matibabu','Magani','उपचार'],
  ['scan.intel.treatment.recovery','Expected recovery time','Berɛ a ayaresa bɛfa','Temps de rétablissement prévu','Muda wa kupona unaotarajiwa','Lokacin warkewa da ake tsammani','अपेक्षित स्वस्थ होने का समय'],
  ['scan.intel.region.title','Region intelligence','Mpɔtam nimdeɛ','Renseignements régionaux','Taarifa za eneo','Bayanan yanki','क्षेत्रीय जानकारी'],
  ['scan.intel.soil.title','Soil intelligence','Dɔteɛ nimdeɛ','Renseignements sur le sol','Taarifa za udongo','Bayanan ƙasa','मिट्टी की जानकारी'],
  ['scan.intel.soil.type','Type','Suban','Type','Aina','Iri','प्रकार'],
  ['scan.intel.soil.ph','pH','pH','pH','pH','pH','pH'],
  ['scan.intel.soil.drainage','Drainage','Nsuo twa','Drainage','Mfereji wa maji','Magudanar ruwa','जल निकासी'],
  ['scan.intel.soil.organic','Organic matter','Afɔdeɛ','Matière organique','Mboji','Takin gargajiya','जैविक पदार्थ'],
  ['scan.intel.soil.suitability','Suitability','Mfaso','Adéquation','Ufaafu','Dacewa','उपयुक्तता'],
  ['scan.intel.satellite.title','Field view','Afuom hwɛ','Vue du champ','Mwonekano wa shamba','Kallon gona','खेत का दृश्य'],
  ['scan.intel.satellite.veg','Vegetation health','Nnɔbae apɔmuden','Santé de la végétation','Afya ya mimea','Lafiyar tsiro','वनस्पति स्वास्थ्य'],
  ['scan.intel.satellite.moisture','Moisture risk','Fɔkyee asiane','Risque d\'humidité','Hatari ya unyevu','Hatsarin danshi','नमी जोखिम'],
  ['scan.intel.satellite.heat','Heat stress','Ɔhyew asiane','Stress thermique','Mkazo wa joto','Damuwar zafi','गर्मी तनाव'],
  ['scan.intel.satellite.trend','Growth trend','Nyiniɛ kwan','Tendance de croissance','Mwelekeo wa ukuaji','Yanayin girma','वृद्धि प्रवृत्ति'],
  ['scan.intel.topMatches.title','Top matches','Nea ɛhyia paa','Meilleures correspondances','Vinavyolingana zaidi','Mafi dacewa','शीर्ष मिलान'],
  ['scan.intel.noticed.title','What we noticed','Deɛ yehunuiɛ','Ce que nous avons remarqué','Tuliyoyaona','Abin da muka lura','हमने क्या देखा'],
  ['scan.intel.next.title','Do this next','Deɛ ɛdi soɔ','À faire ensuite','Fanya hili sasa','Yi wannan na gaba','आगे यह करें'],
  ['scan.intel.quality.title','Photo guidance','Mfonini ho akwankyerɛ','Conseils photo','Mwongozo wa picha','Jagorar hoto','फोटो मार्गदर्शन'],
  ['scan.intel.type.label','Type','Suban','Type','Aina','Iri','प्रकार'],
  ['scan.intel.action.savePlant','Save plant','Kora afifideɛ','Enregistrer la plante','Hifadhi mmea','Ajiye shuka','पौधा सहेजें'],
  ['scan.intel.action.task','Create task','Bɔ dwumadie','Créer une tâche','Tengeneza kazi','Ƙirƙiri aiki','कार्य बनाएं'],
  ['scan.intel.action.review','Save for review','Kora ma nhwehwɛmu','Enregistrer pour révision','Hifadhi kwa ukaguzi','Ajiye don dubawa','समीक्षा के लिए सहेजें'],
  ['scan.intel.action.again','Scan again','San hwehwɛ mu','Scanner à nouveau','Changanua tena','Sake bincike','फिर से स्कैन करें'],
  // ── legacy result cards (UsefulResultCard / ScanResultCard) — latent
  //    unregistered keys surfaced by check:scan-i18n-registered ──
  ['scan.button.addCareTask','Add care task','Fa ɔhwɛ adwuma ka ho','Ajouter une tâche de soin','Ongeza kazi ya utunzaji','Ƙara aikin kulawa','देखभाल कार्य जोड़ें'],
  ['scan.button.addFieldTask','Add field task','Fa afuom adwuma ka ho','Ajouter une tâche de champ','Ongeza kazi ya shambani','Ƙara aikin gona','खेत कार्य जोड़ें'],
  ['scan.button.addTask','Add follow-up task','Fa akyiri adwuma ka ho','Ajouter une tâche de suivi','Ongeza kazi ya ufuatiliaji','Ƙara aikin biyo baya','अनुवर्ती कार्य जोड़ें'],
  ['scan.button.agronomy','🌾 Get local agronomy advice','🌾 Nya mpɔtam kuayɛ afotuo','🌾 Obtenir des conseils agronomiques locaux','🌾 Pata ushauri wa kilimo wa eneo','🌾 Sami shawarar noma na gida','🌾 स्थानीय कृषि सलाह लें'],
  ['scan.button.retake','Retake photo','San twa mfonini','Reprendre la photo','Piga picha tena','Sake ɗaukar hoto','फिर से फोटो लें'],
  ['scan.button.retakeCrop','Retake crop photo','San twa afifideɛ mfonini','Reprendre la photo de la culture','Piga picha ya zao tena','Sake ɗaukar hoton shuka','फिर से फसल फोटो लें'],
  ['scan.button.retakePlant','Retake plant photo','San twa afifideɛ mfonini','Reprendre la photo de la plante','Piga picha ya mmea tena','Sake ɗaukar hoton tsiro','फिर से पौधे की फोटो लें'],
  ['scan.confidence.label','Confidence','Gyidie','Confiance','Uhakika','Tabbaci','विश्वास'],
  ['scan.disclaimer.safe','Results are guidance only. Local agronomy advice may help confirm treatment options.','Nsɛm yi yɛ akwankyerɛ nko ara. Mpɔtam kuayɛ afotuo bɛtumi aboa ama woahu ayaresa akwan.','Les résultats sont indicatifs. Un conseil agronomique local peut aider à confirmer les options de traitement.','Matokeo ni mwongozo tu. Ushauri wa kilimo wa eneo unaweza kusaidia kuthibitisha njia za matibabu.','Sakamakon shawara ne kawai. Shawarar noma ta gida na iya taimakawa wajen tabbatar da hanyoyin magani.','परिणाम केवल मार्गदर्शन हैं। स्थानीय कृषि सलाह उपचार विकल्पों की पुष्टि में मदद कर सकती है।'],
  ['scan.recovery.body','Please choose the photo again.','Yɛsrɛ wo paw mfonini no bio.','Veuillez choisir à nouveau la photo.','Tafadhali chagua picha tena.','Da fatan za a sake zaɓar hoton.','कृपया फिर से फोटो चुनें।'],
  ['scan.recovery.title','Photo could not be loaded.','Yɛantumi amfa mfonini no.','Impossible de charger la photo.','Picha haikuweza kupakiwa.','Ba a iya loda hoton ba.','फोटो लोड नहीं हो सकी।'],
  ['scan.section.checkNext','What to check next','Deɛ wobɛhwɛ akyire','À vérifier ensuite','Cha kuangalia baadaye','Abin da za a duba na gaba','आगे क्या जांचें'],
  ['scan.section.noticed','What we noticed','Deɛ yehunuiɛ','Ce que nous avons remarqué','Tuliyoyaona','Abin da muka lura','हमने क्या देखा'],
  ['scan.section.recommendation','Recommended action','Deɛ yɛkamfo kyerɛ','Action recommandée','Hatua inayopendekezwa','Aikin da aka ba da shawara','अनुशंसित क्रिया'],
  ['scan.section.task','Suggested task','Adwuma a yɛkyerɛ','Tâche suggérée','Kazi iliyopendekezwa','Aikin da aka ba da shawara','सुझाया गया कार्य'],
  ['scan.section.treatments','Suggested treatment approaches','Ayaresa akwan a yɛkyerɛ','Approches de traitement suggérées','Mbinu za matibabu zilizopendekezwa','Hanyoyin magani da aka ba da shawara','सुझाए गए उपचार तरीके'],
  ['scan.toast.agronomySent','Request saved. We\'ll route this to a local agronomy contact when one is available.','Yɛakora wʼabisadeɛ. Yɛde bɛkɔ mpɔtam kuayɛ nipa hɔ sɛ obi wɔ hɔ a.','Demande enregistrée. Nous la transmettrons à un contact agronomique local dès que possible.','Ombi limehifadhiwa. Tutalipeleka kwa mtaalam wa kilimo wa eneo atakapopatikana.','An ajiye buƙatar. Za mu tura wa mai ba da shawarar noma na gida idan akwai.','अनुरोध सहेजा गया। उपलब्ध होने पर हम इसे स्थानीय कृषि संपर्क को भेजेंगे।'],
  ['scan.toast.taskAdded','Task added','Wɔde adwuma aka ho','Tâche ajoutée','Kazi imeongezwa','An ƙara aiki','कार्य जोड़ा गया'],
];

const LANGS = { en: 1, tw: 2, fr: 3, sw: 4, ha: 5, hi: 6 };

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

let report = [];
for (const [lang, idx] of Object.entries(LANGS)) {
  const rel = `src/i18n/columns/T-${lang}.js`;
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  // Skip keys already present (idempotent re-run).
  const lines = ROWS
    .filter(r => !src.includes(`"${r[0]}":`))
    .map(r => `  "${r[0]}": "${esc(r[idx])}",`);
  if (lines.length === 0) { report.push(`${lang}: already present`); continue; }
  const anchorLine = src.split('\n').find(l => l.includes(ANCHOR));
  if (!anchorLine) { report.push(`${lang}: ANCHOR MISSING — skipped`); continue; }
  src = src.replace(anchorLine, anchorLine + '\n' + lines.join('\n'));
  fs.writeFileSync(file, src);
  report.push(`${lang}: +${lines.length} keys`);
}
console.log('[inject-scan-intel-i18n] ' + report.join(' | '));
