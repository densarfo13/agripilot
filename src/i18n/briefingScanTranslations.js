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
