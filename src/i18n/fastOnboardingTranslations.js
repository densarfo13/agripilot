/**
 * fastOnboardingTranslations.js — i18n overlay for the
 * 60-second first-time flow. Full English + Hindi ship every
 * key; other locales ship the core subset with English fallback.
 *
 * Key families:
 *   fast_onboarding.intro.*
 *   fast_onboarding.setup.*
 *   fast_onboarding.farmer_type.*
 *   fast_onboarding.first_time.*
 *   fast_onboarding.recommendation.*
 *   fast_onboarding.transition.*
 *   fast_onboarding.task.*     — seeded first-task copy
 *   fast_onboarding.home.*     — first-time Home CTA
 */

export const FAST_ONBOARDING_TRANSLATIONS = Object.freeze({
  en: {
    // Intro (screen 0)
    'fast_onboarding.intro.title':    'Welcome to Farroway',
    'fast_onboarding.intro.subtitle': 'We\u2019ll guide you on what to do on your farm every day',
    'fast_onboarding.intro.cta':      'Continue',

    // Setup (screen 1)
    'fast_onboarding.setup.title':    'Set up Farroway',
    'fast_onboarding.setup.helper':   'Choose your language and location to get the best farming guidance',
    'fast_onboarding.setup.language': 'Language',
    'fast_onboarding.setup.country':  'Country',
    'fast_onboarding.setup.use_location': 'Use my location (fast & optional)',
    'fast_onboarding.setup.detecting': 'Detecting\u2026',
    'fast_onboarding.setup.trust':    'We only use this to suggest crops for your area',
    'fast_onboarding.setup.detect_failed': 'We couldn\u2019t detect your location \u2014 you can continue without it',
    'fast_onboarding.setup.err_permission_denied': 'Location permission was denied. Please allow access in your browser or phone settings.',
    'fast_onboarding.setup.err_timeout':           'The location request timed out. Try again with a stronger GPS or network signal.',
    'fast_onboarding.setup.err_position_unavailable': 'Your location is unavailable right now. Try moving to an open area.',
    'fast_onboarding.setup.err_insecure_context':  'Location only works on HTTPS or localhost.',
    'fast_onboarding.setup.err_unsupported':       'This device or browser does not support location access.',
    'fast_onboarding.setup.err_no_country':        'We found your location, but couldn\u2019t determine the country. Please select your country below or try again.',
    'fast_onboarding.setup.try_again':             'Try again',
    'fast_onboarding.setup.cta':      'Continue',

    // Farmer type (screen 2)
    'fast_onboarding.farmer_type.title':    'Have you farmed before?',
    'fast_onboarding.farmer_type.new':      'I\u2019m new to farming',
    'fast_onboarding.farmer_type.existing': 'I already farm',
    'fast_onboarding.farmer_type.helper':   'We\u2019ll tailor the first step to you',
    'fast_onboarding.farmer_type.cta':      'Continue',

    // First-time entry (screen 3)
    'fast_onboarding.first_time.title':    'Let\u2019s start your first farm',
    'fast_onboarding.first_time.subtitle': 'We\u2019ll guide you step by step',
    'fast_onboarding.first_time.cta':      'Find my best crop',

    // Recommendation (screen 4)
    'fast_onboarding.recommendation.title':    'Recommended for your area',
    'fast_onboarding.recommendation.subtitle': 'Based on your location and climate',
    'fast_onboarding.recommendation.subtitle_new': 'Here are crops that tend to do well where you are. Pick one to start \u2014 you can always change later.',
    'fast_onboarding.recommendation.empty':    'We\u2019re still learning about your region \u2014 here are common starter crops',
    'fast_onboarding.recommendation.general':  'Your country isn\u2019t fully mapped yet \u2014 these are general starter crops.',
    'fast_onboarding.recommendation.start_with': 'Start with {crop}',
    'fast_onboarding.recommendation.change_country': 'Change country',
    'fast_onboarding.recommendation.planting_window': 'Best planting',
    'fast_onboarding.recommendation.fit.high':   'Great fit',
    'fast_onboarding.recommendation.fit.medium': 'Good fit',
    'fast_onboarding.recommendation.fit.low':    'Worth trying',

    // Transition (screen 5)
    'fast_onboarding.transition.starting':   'Starting your farm\u2026',
    'fast_onboarding.transition.preparing':  'Preparing your first task\u2026',

    // Seeded tasks
    'fast_onboarding.task.prepare_land.title': 'Prepare your land',
    'fast_onboarding.task.prepare_land.why':   'Clear space for planting',
    'fast_onboarding.task.mark_rows.title':    'Mark your planting rows',
    'fast_onboarding.task.mark_rows.why':      'Plan spacing before seed',

    // First-time Home
    'fast_onboarding.home.welcome_name':    'Welcome, {name}',
    'fast_onboarding.home.lets_start':      'Let\u2019s start your farm',
    'fast_onboarding.home.today_task':      'TODAY\u2019S TASK',
    'fast_onboarding.home.mark_done':       'Mark as done',
    'fast_onboarding.home.start_your_farm': 'Start your farm',
    'fast_onboarding.home.no_farm_helper':  'Pick a crop and we\u2019ll guide you from day one',
  },

  hi: {
    'fast_onboarding.intro.title':    'Farroway में स्वागत है',
    'fast_onboarding.intro.subtitle': 'हम आपको हर दिन खेत पर क्या करना है, यह बताएँगे',
    'fast_onboarding.intro.cta':      'जारी रखें',
    'fast_onboarding.setup.title':    'Farroway सेट करें',
    'fast_onboarding.setup.helper':   'सबसे अच्छी सलाह पाने के लिए भाषा और स्थान चुनें',
    'fast_onboarding.setup.language': 'भाषा',
    'fast_onboarding.setup.country':  'देश',
    'fast_onboarding.setup.use_location': 'मेरा स्थान उपयोग करें (तेज़ व वैकल्पिक)',
    'fast_onboarding.setup.detecting': 'खोजा जा रहा है…',
    'fast_onboarding.setup.trust':    'हम इसे केवल आपके क्षेत्र की फ़सलें सुझाने के लिए उपयोग करते हैं',
    'fast_onboarding.setup.detect_failed': 'हम आपका स्थान नहीं खोज पाए — आप बिना इसके भी जारी रख सकते हैं',
    'fast_onboarding.setup.err_permission_denied': 'स्थान की अनुमति अस्वीकृत। कृपया ब्राउज़र या फ़ोन सेटिंग में अनुमति दें।',
    'fast_onboarding.setup.err_timeout':           'स्थान अनुरोध समय से पूरा नहीं हुआ। बेहतर GPS या नेटवर्क के साथ पुनः प्रयास करें।',
    'fast_onboarding.setup.err_position_unavailable': 'अभी आपका स्थान उपलब्ध नहीं है। खुले क्षेत्र में जाकर पुनः प्रयास करें।',
    'fast_onboarding.setup.err_insecure_context':  'स्थान केवल HTTPS या localhost पर काम करता है।',
    'fast_onboarding.setup.err_unsupported':       'यह डिवाइस या ब्राउज़र स्थान एक्सेस का समर्थन नहीं करता।',
    'fast_onboarding.setup.err_no_country':        'हमें आपका स्थान मिला, लेकिन देश तय नहीं हो सका। कृपया नीचे देश चुनें या पुनः प्रयास करें।',
    'fast_onboarding.setup.try_again':             'पुनः प्रयास करें',
    'fast_onboarding.setup.cta':      'जारी रखें',
    'fast_onboarding.farmer_type.title':    'क्या आपने पहले कभी खेती की है?',
    'fast_onboarding.farmer_type.new':      'मैं खेती में नया/नई हूँ',
    'fast_onboarding.farmer_type.existing': 'मैं पहले से खेती करता/करती हूँ',
    'fast_onboarding.farmer_type.helper':   'हम पहली सीढ़ी आपके अनुसार बनाएँगे',
    'fast_onboarding.farmer_type.cta':      'जारी रखें',
    'fast_onboarding.first_time.title':    'आओ, अपनी पहली खेती शुरू करें',
    'fast_onboarding.first_time.subtitle': 'हम चरण-दर-चरण मार्गदर्शन करेंगे',
    'fast_onboarding.first_time.cta':      'मेरी सबसे अच्छी फ़सल खोजें',
    'fast_onboarding.recommendation.title':    'आपके क्षेत्र के लिए सबसे अच्छी फ़सलें',
    'fast_onboarding.recommendation.subtitle': 'आपके स्थान और जलवायु के आधार पर',
    'fast_onboarding.recommendation.empty':    'हम अभी आपके क्षेत्र के बारे में सीख रहे हैं — कुछ सामान्य शुरुआती फ़सलें',
    'fast_onboarding.recommendation.subtitle_new': 'ये वे फ़सलें हैं जो आपके क्षेत्र में अच्छी तरह से उगती हैं। शुरू करने के लिए एक चुनें — आप इसे बाद में बदल सकते हैं।',
    'fast_onboarding.recommendation.general':  'अभी आपका देश पूरी तरह मैप नहीं हुआ — यहाँ सामान्य शुरुआती फ़सलें हैं।',
    'fast_onboarding.recommendation.start_with': '{crop} से शुरू करें',
    'fast_onboarding.recommendation.change_country': 'देश बदलें',
    'fast_onboarding.recommendation.planting_window': 'सर्वोत्तम बुवाई',
    'fast_onboarding.recommendation.fit.high':   'बेहतरीन',
    'fast_onboarding.recommendation.fit.medium': 'अच्छा',
    'fast_onboarding.recommendation.fit.low':    'कोशिश कर सकते हैं',
    'fast_onboarding.transition.starting':   'आपकी खेती शुरू हो रही है…',
    'fast_onboarding.transition.preparing':  'आपका पहला काम तैयार हो रहा है…',
    'fast_onboarding.task.prepare_land.title': 'अपनी ज़मीन तैयार करें',
    'fast_onboarding.task.prepare_land.why':   'बुवाई के लिए जगह बनाएँ',
    'fast_onboarding.task.mark_rows.title':    'अपनी पंक्तियाँ बनाएँ',
    'fast_onboarding.task.mark_rows.why':      'बीज से पहले दूरी की योजना बनाएँ',
    'fast_onboarding.home.welcome_name':    'स्वागत है, {name}',
    'fast_onboarding.home.lets_start':      'आओ, अपनी खेती शुरू करें',
    'fast_onboarding.home.today_task':      'आज का काम',
    'fast_onboarding.home.mark_done':       'पूरा करें',
    'fast_onboarding.home.start_your_farm': 'अपनी खेती शुरू करें',
    'fast_onboarding.home.no_farm_helper':  'एक फ़सल चुनें और हम पहले दिन से मार्गदर्शन करेंगे',
  },

  tw: core({
    'fast_onboarding.intro.title':    'Akwaaba ba Farroway',
    'fast_onboarding.intro.cta':      'Kɔ so',
    'fast_onboarding.setup.cta':      'Kɔ so',
    'fast_onboarding.farmer_type.new': 'Meda so yɛ foforɔ wɔ afuom adwuma mu',
    'fast_onboarding.farmer_type.existing': 'Meyɛ afuom adwuma dadaada',
    'fast_onboarding.first_time.cta': 'Hwehwɛ me afudeɛ a ɛyɛ',
    'fast_onboarding.recommendation.start_with': 'Fa {crop} hyɛ aseɛ',
    'fast_onboarding.task.prepare_land.title': 'Siesie w\u02BCasase',
    'fast_onboarding.home.mark_done': 'Wie no',
  }),
  es: core({
    'fast_onboarding.intro.title':    'Bienvenido a Farroway',
    'fast_onboarding.intro.subtitle': 'Te diremos qué hacer en tu granja cada día',
    'fast_onboarding.intro.cta':      'Continuar',
    'fast_onboarding.setup.use_location': 'Usar mi ubicación (rápido y opcional)',
    'fast_onboarding.setup.trust':    'Solo la usamos para sugerir cultivos para tu zona',
    'fast_onboarding.setup.cta':      'Continuar',
    'fast_onboarding.farmer_type.title':    '¿Has cultivado antes?',
    'fast_onboarding.farmer_type.new':      'Soy nuevo en la agricultura',
    'fast_onboarding.farmer_type.existing': 'Ya cultivo',
    'fast_onboarding.farmer_type.cta':      'Continuar',
    'fast_onboarding.first_time.title':    'Empecemos tu primera granja',
    'fast_onboarding.first_time.cta':      'Encontrar mi mejor cultivo',
    'fast_onboarding.recommendation.title':'Mejores cultivos para tu zona',
    'fast_onboarding.recommendation.start_with': 'Empezar con {crop}',
    'fast_onboarding.task.prepare_land.title': 'Prepara tu tierra',
    'fast_onboarding.task.prepare_land.why':   'Despeja el espacio para plantar',
    'fast_onboarding.home.welcome_name':    'Bienvenido, {name}',
    'fast_onboarding.home.mark_done':       'Marcar como hecho',
  }),
  pt: core({
    'fast_onboarding.intro.title':    'Bem-vindo ao Farroway',
    'fast_onboarding.intro.cta':      'Continuar',
    'fast_onboarding.farmer_type.title':    'Já plantou antes?',
    'fast_onboarding.farmer_type.new':      'Sou novo na agricultura',
    'fast_onboarding.farmer_type.existing': 'Já sou agricultor',
    'fast_onboarding.first_time.cta':      'Encontrar minha melhor cultura',
    'fast_onboarding.recommendation.title':'Melhores culturas para a sua zona',
    'fast_onboarding.recommendation.start_with': 'Começar com {crop}',
    'fast_onboarding.task.prepare_land.title': 'Prepare sua terra',
    'fast_onboarding.home.mark_done':       'Marcar como feito',
  }),
  fr: core({
    'fast_onboarding.intro.title':    'Bienvenue sur Farroway',
    'fast_onboarding.intro.cta':      'Continuer',
    'fast_onboarding.farmer_type.new':      'Je débute en agriculture',
    'fast_onboarding.farmer_type.existing': 'Je cultive déjà',
    'fast_onboarding.first_time.cta':      'Trouver ma meilleure culture',
    'fast_onboarding.recommendation.title':'Meilleures cultures pour votre zone',
    'fast_onboarding.recommendation.start_with': 'Commencer avec {crop}',
    'fast_onboarding.task.prepare_land.title': 'Préparez votre terrain',
    'fast_onboarding.home.mark_done':       'Marquer comme fait',
  }),
  ar: core({
    'fast_onboarding.intro.title':    'أهلاً بك في Farroway',
    'fast_onboarding.intro.cta':      'متابعة',
    'fast_onboarding.farmer_type.new':      'أنا جديد في الزراعة',
    'fast_onboarding.farmer_type.existing': 'أنا أزرع بالفعل',
    'fast_onboarding.first_time.cta':      'اعثر على أفضل محصول لي',
    'fast_onboarding.recommendation.title':'أفضل المحاصيل لمنطقتك',
    'fast_onboarding.recommendation.start_with': 'ابدأ بـ {crop}',
    'fast_onboarding.task.prepare_land.title': 'جهّز أرضك',
    'fast_onboarding.home.mark_done':       'اعتبره منجزاً',
  }),
  sw: core({
    'fast_onboarding.intro.title':    'Karibu Farroway',
    'fast_onboarding.intro.cta':      'Endelea',
    'fast_onboarding.farmer_type.new':      'Mimi ni mpya katika kilimo',
    'fast_onboarding.farmer_type.existing': 'Mimi tayari ni mkulima',
    'fast_onboarding.first_time.cta':      'Pata zao bora kwangu',
    'fast_onboarding.recommendation.title':'Mazao bora kwa eneo lako',
    'fast_onboarding.recommendation.start_with': 'Anza na {crop}',
    'fast_onboarding.task.prepare_land.title': 'Tayarisha ardhi yako',
    'fast_onboarding.home.mark_done':       'Maliza',
  }),
  id: core({
    'fast_onboarding.intro.title':    'Selamat datang di Farroway',
    'fast_onboarding.intro.cta':      'Lanjutkan',
    'fast_onboarding.farmer_type.new':      'Saya baru bertani',
    'fast_onboarding.farmer_type.existing': 'Saya sudah bertani',
    'fast_onboarding.first_time.cta':      'Temukan tanaman terbaik saya',
    'fast_onboarding.recommendation.title':'Tanaman terbaik untuk wilayah Anda',
    'fast_onboarding.recommendation.start_with': 'Mulai dengan {crop}',
    'fast_onboarding.task.prepare_land.title': 'Siapkan lahan Anda',
    'fast_onboarding.home.mark_done':       'Tandai selesai',
  }),
});

export function applyFastOnboardingOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(FAST_ONBOARDING_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

export function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

function core(keys) { return Object.freeze({ ...keys }); }

export default FAST_ONBOARDING_TRANSLATIONS;
