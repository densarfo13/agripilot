/**
 * briefingScanTranslations.js — translation overlay for the
 * Morning Briefing Card + Scan upgrade (Plantix-style + treatment
 * guidance + agronomy escalation).
 *
 * Every key here is consumed via tSafe / tStrict with an English
 * fallback so the UI never breaks if a locale is missing a row.
 *
 * Structure: flat key → { en, fr, sw, ha, tw, hi }.
 * Coverage: all six locales registered in SUPPORTED_LANGUAGES.
 *
 * Where the project already had entries for a key (rare), this
 * file does NOT override them — the translation merger picks the
 * highest-priority overlay; this module is intentionally additive.
 */

export const BRIEFING_SCAN_TRANSLATIONS = Object.freeze({
  // ── Morning Briefing Card ──────────────────────────────

  'briefing.greeting.morning': {
    en: 'Good morning',
    fr: 'Bonjour',
    sw: 'Habari za asubuhi',
    ha: 'Ina kwana',
    tw: 'Maakye',
    hi: 'सुप्रभात',
  },
  'briefing.greeting.afternoon': {
    en: 'Good afternoon',
    fr: 'Bon après-midi',
    sw: 'Habari za mchana',
    ha: 'Ina wuni',
    tw: 'Maaha',
    hi: 'शुभ दोपहर',
  },
  'briefing.greeting.evening': {
    en: 'Good evening',
    fr: 'Bonsoir',
    sw: 'Habari za jioni',
    ha: 'Ina yamma',
    tw: 'Maadwo',
    hi: 'शुभ संध्या',
  },

  // Weather summary lines (one per weatherType)
  'briefing.weather.rain':    {
    en: 'Rain expected today',
    fr: 'Pluie attendue aujourd’hui',
    sw: 'Mvua inatarajiwa leo',
    ha: 'Ana sa ran ruwa yau',
    tw: 'Nsuo bɛtɔ ɛnnɛ',
    hi: 'आज बारिश की संभावना',
  },
  'briefing.weather.heat':    {
    en: 'Hot weather expected today',
    fr: 'Chaleur attendue aujourd’hui',
    sw: 'Hali ya joto inatarajiwa leo',
    ha: 'Ana sa ran zafi yau',
    tw: 'Ahohuru bɛba ɛnnɛ',
    hi: 'आज गर्म मौसम की संभावना',
  },
  'briefing.weather.dry':     {
    en: 'Dry conditions today',
    fr: 'Conditions sèches aujourd’hui',
    sw: 'Hali ya ukame leo',
    ha: 'Yanayin bushewa yau',
    tw: 'Mmerɛ a awo ɛnnɛ',
    hi: 'आज शुष्क मौसम',
  },
  'briefing.weather.sunny':   {
    en: 'Sunny and clear today',
    fr: 'Ensoleillé et clair aujourd’hui',
    sw: 'Jua na anga safi leo',
    ha: 'Rana da sararin sama yau',
    tw: 'Owia bɛbɔ ɛnnɛ',
    hi: 'आज धूप और साफ़ मौसम',
  },
  'briefing.weather.cloudy':  {
    en: 'Cloudy and mild today',
    fr: 'Nuageux et doux aujourd’hui',
    sw: 'Mawingu na hali ya wastani leo',
    ha: 'Gajimare da yanayi mai sauƙi yau',
    tw: 'Ɛmu yɛ kusuo ɛnnɛ',
    hi: 'आज बादल और हल्का मौसम',
  },
  'briefing.weather.wind':    {
    en: 'Strong wind today',
    fr: 'Vent fort aujourd’hui',
    sw: 'Upepo mkali leo',
    ha: 'Iska mai ƙarfi yau',
    tw: 'Mframa kɛse bi bɔ ɛnnɛ',
    hi: 'आज तेज़ हवा',
  },
  'briefing.weather.unknown': {
    en: 'Steady weather today',
    fr: 'Temps stable aujourd’hui',
    sw: 'Hali ya hewa nzuri leo',
    ha: 'Yanayi mai daidaito yau',
    tw: 'Wim tebea pa ɛnnɛ',
    hi: 'आज सामान्य मौसम',
  },

  // Estimated time bands
  'briefing.time.2': { en: '2 mins', fr: '2 min', sw: 'Dakika 2', ha: 'Mintuna 2', tw: 'Simma 2',  hi: '2 मिनट' },
  'briefing.time.5': { en: '5 mins', fr: '5 min', sw: 'Dakika 5', ha: 'Mintuna 5', tw: 'Simma 5',  hi: '5 मिनट' },
  'briefing.time.10':{ en: '10 mins', fr: '10 min', sw: 'Dakika 10', ha: 'Mintuna 10', tw: 'Simma 10', hi: '10 मिनट' },

  // Fallback briefing copy
  'briefing.fallback.task': {
    en: 'Check your crops today and monitor soil moisture.',
    fr: 'Vérifiez vos cultures aujourd’hui et surveillez l’humidité du sol.',
    sw: 'Kagua mazao yako leo na uangalie unyevu wa udongo.',
    ha: 'Duba amfanin gonarka yau kuma lura da danshin ƙasa.',
    tw: 'Hwɛ wo nnɔbae ɛnnɛ na hwɛ asaase mu nsuo.',
    hi: 'आज अपनी फसलों की जाँच करें और मिट्टी की नमी पर ध्यान दें।',
  },
  'briefing.fallback.reason': {
    en: 'A short walk-around helps you spot problems early.',
    fr: 'Une courte tournée aide à repérer les problèmes tôt.',
    sw: 'Kuzunguka kidogo kunakusaidia kugundua matatizo mapema.',
    ha: 'Yawo kaɗan zai taimaka maka ganin matsaloli da wuri.',
    tw: 'Sɛ wonante hwɛ wo nnɔbae mu kakra a ɛboa wo na woahu nsɛm a aba ntɛm.',
    hi: 'थोड़ी देर घूमने से आप समस्याओं को जल्दी पहचान सकते हैं।',
  },

  // ── Scan — section labels ──────────────────────────────

  'scan.section.noticed':   {
    en: 'What we noticed',
    fr: 'Ce que nous avons remarqué',
    sw: 'Tulichoona',
    ha: 'Abin da muka lura',
    tw: 'Deɛ yɛahunu',
    hi: 'हमने क्या देखा',
  },
  'scan.section.checkNext': {
    en: 'What to check next',
    fr: 'À vérifier ensuite',
    sw: 'Ya kuangalia baadaye',
    ha: 'Abin da za a duba na gaba',
    tw: 'Deɛ ɛsɛ sɛ wohwɛ',
    hi: 'आगे क्या जाँचें',
  },
  'scan.section.recommendation': {
    en: 'Recommended action',
    fr: 'Action recommandée',
    sw: 'Hatua iliyopendekezwa',
    ha: 'Aikin da aka shawarta',
    tw: 'Adwuma a yɛkamfo kyerɛ',
    hi: 'अनुशंसित कार्रवाई',
  },
  'scan.section.treatments': {
    en: 'Suggested treatment approaches',
    fr: 'Approches de traitement suggérées',
    sw: 'Mbinu za matibabu zilizopendekezwa',
    ha: 'Hanyoyin magani da aka shawarta',
    tw: 'Ayaresa kwan a yɛkyerɛ',
    hi: 'सुझाए गए उपचार विकल्प',
  },
  'scan.section.task':       {
    en: 'Suggested task',
    fr: 'Tâche suggérée',
    sw: 'Kazi iliyopendekezwa',
    ha: 'Aikin da aka shawarta',
    tw: 'Adwuma a yɛkyerɛ',
    hi: 'सुझाया गया कार्य',
  },

  // ── Premium Scan Experience (May 2026) ──────────────────
  // Analyzing-step copy. Each step holds ~700 ms; total cycle
  // covers a ~2-3 second analysis window. Wording is calm,
  // observational, never overpromising.
  'scan.analyzing.step1': {
    en: 'Analyzing plant image…',
    fr: 'Analyse de l’image…',
    sw: 'Inachambua picha ya mmea…',
    ha: 'Ana nazarin hoton tsiro…',
    tw: 'Yɛrehwɛ afifideɛ mfoni no mu…',
    hi: 'पौधे की तस्वीर का विश्लेषण…',
  },
  'scan.analyzing.step2': {
    en: 'Checking visible leaf patterns…',
    fr: 'Vérification des motifs visibles…',
    sw: 'Inakagua mifumo ya majani inayoonekana…',
    ha: 'Ana duba alamomin ganye da ake gani…',
    tw: 'Yɛrehwɛ aba so nsɛm a ɛda adi…',
    hi: 'दिखाई देने वाले पत्ती पैटर्न जाँच रहे हैं…',
  },
  'scan.analyzing.step3': {
    en: 'Looking for common stress signals…',
    fr: 'Recherche de signaux de stress…',
    sw: 'Inatafuta dalili za kawaida za mfadhaiko…',
    ha: 'Ana neman alamomin damuwa…',
    tw: 'Yɛrehwɛ haw nsɛnkyerɛnneɛ…',
    hi: 'सामान्य तनाव संकेतों की तलाश…',
  },
  'scan.analyzing.step4': {
    en: 'Preparing guidance…',
    fr: 'Préparation des conseils…',
    sw: 'Inatayarisha mwongozo…',
    ha: 'Ana shirya jagora…',
    tw: 'Yɛresiesie akwankyerɛ…',
    hi: 'मार्गदर्शन तैयार कर रहे हैं…',
  },
  'scan.analyzing.taking': {
    en: 'This is taking a moment. Hang on…',
    fr: 'Cela prend un moment. Patience…',
    sw: 'Hii inachukua muda kidogo. Subiri kidogo…',
    ha: 'Ana ɗan ɗauka. Jira kaɗan…',
    tw: 'Ɛregye bere kakra. Twɛn kakra…',
    hi: 'थोड़ा समय लग रहा है। प्रतीक्षा करें…',
  },
  'scan.analyzing.note': {
    en: 'Your photo stays on this device.',
    fr: 'Votre photo reste sur cet appareil.',
    sw: 'Picha yako inabaki kwenye kifaa hiki.',
    ha: 'Hotonka yana nan a kan na’urar.',
    tw: 'Wo mfoni no tena saa afidie yi so.',
    hi: 'आपकी तस्वीर इस डिवाइस पर रहती है।',
  },
  'scan.preview.alt': {
    en: 'Plant photo',
    fr: 'Photo de plante',
    sw: 'Picha ya mmea',
    ha: 'Hoton tsiro',
    tw: 'Afifideɛ mfoni',
    hi: 'पौधे की तस्वीर',
  },

  // Mode-aware button labels (spec §6 — Garden warm, Farm operational).
  'scan.button.addCareTask': {
    en: 'Add care task',
    fr: 'Ajouter une tâche de soin',
    sw: 'Ongeza kazi ya utunzaji',
    ha: 'Ƙara aikin kulawa',
    tw: 'Fa ɔhwɛ adwuma ka ho',
    hi: 'देखभाल कार्य जोड़ें',
  },
  'scan.button.addFieldTask': {
    en: 'Add field task',
    fr: 'Ajouter une tâche de champ',
    sw: 'Ongeza kazi ya shamba',
    ha: 'Ƙara aikin gona',
    tw: 'Fa afuo adwuma ka ho',
    hi: 'खेत कार्य जोड़ें',
  },
  'scan.button.retakePlant': {
    en: '📷 Retake plant photo',
    fr: '📷 Reprendre la photo de la plante',
    sw: '📷 Piga picha ya mmea tena',
    ha: '📷 Sake ɗaukar hoton tsiro',
    tw: '📷 Twa afifideɛ mfoni no bio',
    hi: '📷 पौधे की फ़ोटो फिर लें',
  },
  'scan.button.retakeCrop': {
    en: '📷 Retake crop photo',
    fr: '📷 Reprendre la photo de la culture',
    sw: '📷 Piga picha ya zao tena',
    ha: '📷 Sake ɗaukar hoton amfani',
    tw: '📷 Twa nnɔbae mfoni no bio',
    hi: '📷 फसल की फ़ोटो फिर लें',
  },

  // Scan comparison surface.
  'scan.compare.title': {
    en: 'Compare with last scan',
    fr: 'Comparer avec le dernier scan',
    sw: 'Linganisha na skana iliyopita',
    ha: 'Kwatanta da sikan na ƙarshe',
    tw: 'Toa scan a ɛtwaam no ho',
    hi: 'पिछले स्कैन से तुलना करें',
  },
  'scan.compare.before': {
    en: 'Before', fr: 'Avant', sw: 'Kabla', ha: 'Kafin', tw: 'Kane', hi: 'पहले',
  },
  'scan.compare.after': {
    en: 'After', fr: 'Après', sw: 'Baada', ha: 'Bayan', tw: 'Akyi', hi: 'बाद',
  },
  'scan.compare.empty': {
    en: 'Two scans are needed to show progress. Take another photo to compare.',
    fr: 'Deux scans sont nécessaires pour comparer. Prenez une autre photo.',
    sw: 'Skana mbili zinahitajika kuonyesha maendeleo. Piga picha nyingine kulinganisha.',
    ha: 'Ana buƙatar sikan biyu don nuna ci gaba. Ɗauki wani hoto don kwatantawa.',
    tw: 'Yɛhia scan mmienu na yɛatumi akyerɛ nkɔso. Twa mfoni foforɔ na yɛatoa ho.',
    hi: 'प्रगति दिखाने के लिए दो स्कैन चाहिए। तुलना के लिए फिर तस्वीर लें।',
  },
  'scan.compare.note.improvedToHealthy': {
    en: 'Looking healthier than the previous scan. Steady care may be helping.',
    fr: 'Aspect plus sain qu’au scan précédent. Les soins constants peuvent aider.',
    sw: 'Inaonekana yenye afya kuliko ya awali. Utunzaji thabiti unaweza kusaidia.',
    ha: 'Tana kama mai lafiya fiye da ta baya. Kulawa akai-akai na iya taimakawa.',
    tw: 'Ɛsi pi sen scan a ɛtwaam no. Daa ɔhwɛ betumi aboa.',
    hi: 'पिछले स्कैन से ज़्यादा स्वस्थ दिख रहा। नियमित देखभाल मदद कर सकती है।',
  },
  'scan.compare.note.steady': {
    en: 'Condition looks similar to the previous scan. Keep monitoring.',
    fr: 'État similaire au scan précédent. Continuez à surveiller.',
    sw: 'Hali inaonekana sawa na ya awali. Endelea kufuatilia.',
    ha: 'Yanayin yana kama na baya. Ci gaba da lura.',
    tw: 'Tebea no te sɛ scan a ɛtwaam no ara. Kɔ so hwɛ.',
    hi: 'स्थिति पिछले स्कैन जैसी दिखती है। निगरानी जारी रखें।',
  },
  'scan.compare.note.unclear': {
    en: 'Latest scan needs a clearer photo. Try natural light.',
    fr: 'Le dernier scan nécessite une photo plus claire. Essayez la lumière naturelle.',
    sw: 'Skana ya hivi karibuni inahitaji picha wazi zaidi. Jaribu mwanga wa asili.',
    ha: 'Sikan na ƙarshe yana buƙatar hoto mai haske. Gwada hasken halitta.',
    tw: 'Scan a ɛda akyi no hia mfoni a ɛda hɔ pefee. Sɔ owia hann hwɛ.',
    hi: 'नवीनतम स्कैन को साफ़ फ़ोटो चाहिए। प्राकृतिक रोशनी आज़माएँ।',
  },
  'scan.compare.note.healthy': {
    en: 'Latest scan looks healthy. Keep the daily check-ins.',
    fr: 'Le dernier scan semble sain. Continuez les vérifications quotidiennes.',
    sw: 'Skana ya hivi karibuni inaonekana yenye afya. Endelea na ukaguzi wa kila siku.',
    ha: 'Sikan na ƙarshe yana da lafiya. Ci gaba da duban kullum.',
    tw: 'Scan a ɛda akyi no apɔw. Kɔ so hwɛ daa.',
    hi: 'नवीनतम स्कैन स्वस्थ दिखता है। रोज़ की जाँच जारी रखें।',
  },
  'scan.compare.note.changed': {
    en: 'Some things look different. Inspect leaves and continue monitoring.',
    fr: 'Certaines choses semblent différentes. Inspectez les feuilles et continuez à surveiller.',
    sw: 'Vitu vingine vinaonekana tofauti. Kagua majani na endelea kufuatilia.',
    ha: 'Wasu abubuwa sun bambanta. Duba ganyaye kuma ci gaba da lura.',
    tw: 'Nneɛma bi yɛ soronko. Hwɛ aba na kɔ so hwɛ.',
    hi: 'कुछ चीज़ें अलग दिख रही हैं। पत्तियाँ जाँचें और निगरानी जारी रखें।',
  },
  'scan.compare.disclaimer': {
    en: 'A comparison shows what changed visually — it doesn’t confirm a diagnosis.',
    fr: 'Une comparaison montre ce qui a changé visuellement — elle ne confirme pas un diagnostic.',
    sw: 'Ulinganisho unaonyesha kilichobadilika — hauthibitishi utambuzi.',
    ha: 'Kwatance yana nuna abin da ya canza ga ido — ba ya tabbatar da ganewar asali ba.',
    tw: 'Toa ho kyerɛ nea asakra anim — ɛnkyerɛ sɛ yahu deɛ ɛyɛ no.',
    hi: 'तुलना दिखाती है कि क्या बदला — यह निदान की पुष्टि नहीं करती।',
  },

  // Scan buttons + toasts
  'scan.button.addTask':     {
    en: 'Add follow-up task',
    fr: 'Ajouter une tâche de suivi',
    sw: 'Ongeza kazi ya ufuatiliaji',
    ha: 'Ƙara aikin bibiya',
    tw: 'Fa adwuma a edi hɔ ka ho',
    hi: 'अनुवर्ती कार्य जोड़ें',
  },
  'scan.toast.taskAdded':    {
    en: '✅ Task added',
    fr: '✅ Tâche ajoutée',
    sw: '✅ Kazi imeongezwa',
    ha: '✅ An ƙara aikin',
    tw: '✅ Wode adwuma no aka ho',
    hi: '✅ कार्य जोड़ा गया',
  },
  'scan.button.retake':      {
    en: '📷 Retake photo',
    fr: '📷 Reprendre la photo',
    sw: '📷 Piga picha tena',
    ha: '📷 Sake ɗaukar hoto',
    tw: '📷 Twa mfoni no bio',
    hi: '📷 फिर से फ़ोटो लें',
  },
  'scan.button.agronomy':    {
    en: '🌾 Get local agronomy advice',
    fr: '🌾 Obtenir des conseils d’agronomie locaux',
    sw: '🌾 Pata ushauri wa kilimo wa eneo',
    ha: '🌾 Sami shawarar noma na gida',
    tw: '🌾 Nya kuayɛ ho afotuo wɔ wʼadi',
    hi: '🌾 स्थानीय कृषि सलाह प्राप्त करें',
  },
  'scan.toast.agronomySent': {
    en: '✅ Request saved. We’ll route this to a local agronomy contact when one is available.',
    fr: '✅ Demande enregistrée. Nous la transmettrons à un contact agronomique local dès que possible.',
    sw: '✅ Ombi limehifadhiwa. Tutaipeleka kwa mtaalamu wa kilimo wa eneo ikiwa atapatikana.',
    ha: '✅ An adana buƙatar. Za mu turo ta zuwa ga masanin noma na gida idan akwai.',
    tw: '✅ Yɛakora abisadeɛ no. Sɛ obi a ɔnim kuayɛ ba a, yɛbɛsoma no ma no.',
    hi: '✅ अनुरोध सहेजा गया। उपलब्ध होने पर हम इसे स्थानीय कृषि संपर्क को भेजेंगे।',
  },

  // Spec-exact safety disclaimer (always shown)
  'scan.disclaimer.safe': {
    en: 'Results are guidance only. Local agronomy advice may help confirm treatment options.',
    fr: 'Les résultats sont uniquement à titre indicatif. Des conseils agronomiques locaux peuvent aider à confirmer les options de traitement.',
    sw: 'Matokeo ni mwongozo tu. Ushauri wa kilimo wa eneo unaweza kusaidia kuthibitisha chaguzi za matibabu.',
    ha: 'Sakamakon shiriya ne kawai. Shawarar masanin noma na gida na iya taimakawa wajen tabbatar da zaɓuɓɓukan magani.',
    tw: 'Saa nsɛm yi yɛ akwankyerɛ kwa. Kuayɛ ho afotuo a wonya wɔ wʼadi bɛboa wo ma woahunu ayaresa a ɛfata.',
    hi: 'परिणाम केवल मार्गदर्शन हैं। उपचार विकल्पों की पुष्टि के लिए स्थानीय कृषि सलाह सहायक हो सकती है।',
  },

  // Confidence labels
  'scan.confidence.label':   { en: 'Confidence', fr: 'Confiance', sw: 'Imani',     ha: 'Tabbas',  tw: 'Gyidie',     hi: 'विश्वास' },
  'scan.confidence.low':     { en: 'Low',        fr: 'Faible',    sw: 'Ya chini',  ha: 'Ƙasa',    tw: 'Ketewa',     hi: 'कम' },
  'scan.confidence.medium':  { en: 'Medium',     fr: 'Moyen',     sw: 'Wastani',   ha: 'Matsakaici', tw: 'Mfinimfini', hi: 'मध्यम' },
  'scan.confidence.high':    { en: 'High',       fr: 'Élevé',     sw: 'Juu',       ha: 'Babba',   tw: 'Kɛseɛ',      hi: 'उच्च' },
});

export default BRIEFING_SCAN_TRANSLATIONS;
