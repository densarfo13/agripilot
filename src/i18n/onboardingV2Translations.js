/**
 * onboardingV2Translations.js — i18n overlay for the redesigned
 * onboarding. Key families:
 *
 *   onboardingV2.welcome.*          Welcome screen
 *   onboardingV2.location.*         Location screen
 *   onboardingV2.growingType.*      Growing type step
 *   onboardingV2.experience.*       Experience step
 *   onboardingV2.sizeDetails.*      Size details (mode-aware)
 *   onboardingV2.recommendations.*  Recommendations screen
 *   onboardingV2.cropConfirm.*      Crop confirmation
 *   onboardingV2.first_value.*      First-value screen
 *   onboardingV2.progress.*         Progress labels
 *   onboardingV2.common.*           Shared buttons / trust text
 *
 * Full English + Hindi ship. Other locales ship the core set
 * with English fallback for the long tail — follows the same
 * pattern as the other overlays in this codebase.
 */

export const ONBOARDING_V2_TRANSLATIONS = Object.freeze({
  en: {
    // Welcome
    'onboardingV2.welcome.promise': 'We tell you what to do on your farm every day.',
    'onboardingV2.welcome.cta':     'Get started',
    'onboardingV2.welcome.languageLabel': 'Language',

    // Location
    'onboardingV2.location.title':        'Use your location',
    'onboardingV2.location.helper':       'This helps us recommend the right crops and tasks.',
    'onboardingV2.location.detectCta':    'Detect my location',
    'onboardingV2.location.detecting':    'Detecting\u2026',
    'onboardingV2.location.detectedLabel':'Detected location',
    'onboardingV2.location.confirmPrompt':'Is this your farm location?',
    'onboardingV2.location.confirmYes':   'Yes, use this',
    'onboardingV2.location.chooseManual': 'Choose manually',
    'onboardingV2.location.failTitle':    'We couldn\u2019t detect your location',
    'onboardingV2.location.tryAgain':     'Try again',
    'onboardingV2.location.trust.detect': 'Detected using your device location',
    'onboardingV2.location.manual.country':'Country',
    'onboardingV2.location.manual.state': 'State / region',
    'onboardingV2.location.manual.city':  'City (optional)',
    'onboardingV2.location.manual.save':  'Save location',

    // Growing type
    'onboardingV2.growingType.title':    'What best describes your growing space?',
    'onboardingV2.growingType.helper':   'This helps us tailor your crop recommendations.',
    'onboardingV2.growingType.backyard': 'Backyard / Home garden',
    'onboardingV2.growingType.small':    'Small farm',
    'onboardingV2.growingType.medium':   'Medium farm',
    'onboardingV2.growingType.large':    'Large farm',

    // Experience
    'onboardingV2.experience.title':       'How much farming experience do you have?',
    'onboardingV2.experience.helper':      'We\u2019ll adjust crop suggestions and task difficulty.',
    'onboardingV2.experience.new':         'I\u2019m new',
    'onboardingV2.experience.experienced': 'I have experience',

    // Size details — backyard
    'onboardingV2.sizeDetails.backyard.title':   'Where are you growing?',
    'onboardingV2.sizeDetails.backyard.helper':  'This changes what crops and tasks we suggest.',
    'onboardingV2.sizeDetails.backyard.pots':    'Pots / containers',
    'onboardingV2.sizeDetails.backyard.raised':  'Raised bed',
    'onboardingV2.sizeDetails.backyard.soil':    'Backyard soil',
    'onboardingV2.sizeDetails.backyard.approx':  'Approximate growing space (optional)',

    // Size details — farm
    'onboardingV2.sizeDetails.farm.title':       'How big is your farm?',
    'onboardingV2.sizeDetails.farm.helper':      'This changes task scale and planning recommendations.',
    'onboardingV2.sizeDetails.farm.small':       'Small — less than 2 acres',
    'onboardingV2.sizeDetails.farm.medium':      'Medium — 2 to 10 acres',
    'onboardingV2.sizeDetails.farm.large':       'Large — 10+ acres',
    'onboardingV2.sizeDetails.farm.exactLabel':  'Enter exact size (optional)',
    'onboardingV2.sizeDetails.farm.unit.acre':   'Acres',
    'onboardingV2.sizeDetails.farm.unit.hectare':'Hectares',

    // Recommendations
    'onboardingV2.recommendations.title':    'Best crops for your location',
    'onboardingV2.recommendations.subtitle': 'Based on your location, experience, and growing setup',
    'onboardingV2.recommendations.best':     'Best for you',
    'onboardingV2.recommendations.also':     'Also possible',
    'onboardingV2.recommendations.notRecommended':   'Not recommended',
    'onboardingV2.recommendations.showNotRecommended':'Show crops that fit less well',
    'onboardingV2.recommendations.beginnerFriendly': 'Beginner-friendly',
    'onboardingV2.recommendations.supportDepth.full':    'Full support',
    'onboardingV2.recommendations.supportDepth.partial': 'Partial support',
    'onboardingV2.recommendations.supportDepth.limited': 'Limited support',
    'onboardingV2.recommendations.emptyState': 'We need a little more info before we can suggest crops for your region.',

    // Crop confirm
    'onboardingV2.cropConfirm.title':        'Start with {crop}',
    'onboardingV2.cropConfirm.statusLabel':  'Current planting status',
    'onboardingV2.cropConfirm.startBtn':     'Start my plan',
    'onboardingV2.cropConfirm.changeBtn':    'Change crop',

    // First-value
    'onboardingV2.first_value.task_title':   'Your first task is ready',
    'onboardingV2.first_value.task_why':     'Start here to build a daily rhythm',
    'onboardingV2.first_value.plan_title':   'Your plan is ready',
    'onboardingV2.first_value.plan_why':     'We\u2019ll guide you from today onward',
    'onboardingV2.first_value.plan_next':    'Open Today when you want to see your first task',
    'onboardingV2.first_value.cta.go_to_today': 'Go to Today',
    'onboardingV2.first_value.cta.view_plan':   'View my plan',

    // Progress
    'onboardingV2.progress.step': 'Step {n} of {total}',

    // Common
    'onboardingV2.common.back':     'Back',
    'onboardingV2.common.next':     'Next',
    'onboardingV2.common.continue': 'Continue',
    'onboardingV2.common.skip':     'Skip',
    'onboardingV2.common.saving':   'Saving\u2026',
    'onboardingV2.common.offlineHint': 'You\u2019re offline — we\u2019ll save your progress and sync later',
  },

  hi: {
    // Welcome
    'onboardingV2.welcome.promise': 'हम आपको बताते हैं कि हर दिन अपने खेत पर क्या करना है।',
    'onboardingV2.welcome.cta':     'शुरू करें',
    'onboardingV2.welcome.languageLabel': 'भाषा',
    // Location
    'onboardingV2.location.title':        'अपना स्थान उपयोग करें',
    'onboardingV2.location.helper':       'इससे हम सही फ़सलें और काम सुझा पाते हैं।',
    'onboardingV2.location.detectCta':    'मेरा स्थान खोजें',
    'onboardingV2.location.detecting':    'खोजा जा रहा है…',
    'onboardingV2.location.detectedLabel':'मिला हुआ स्थान',
    'onboardingV2.location.confirmPrompt':'क्या यह आपके खेत का स्थान है?',
    'onboardingV2.location.confirmYes':   'हाँ, इसे उपयोग करें',
    'onboardingV2.location.chooseManual': 'खुद चुनें',
    'onboardingV2.location.failTitle':    'हम आपका स्थान नहीं खोज पाए',
    'onboardingV2.location.tryAgain':     'फिर से कोशिश करें',
    'onboardingV2.location.trust.detect': 'आपके डिवाइस से पहचाना गया',
    'onboardingV2.location.manual.country':'देश',
    'onboardingV2.location.manual.state': 'राज्य / क्षेत्र',
    'onboardingV2.location.manual.city':  'शहर (वैकल्पिक)',
    'onboardingV2.location.manual.save':  'स्थान सहेजें',
    // Growing type
    'onboardingV2.growingType.title':    'आप कहाँ उगा रहे हैं?',
    'onboardingV2.growingType.helper':   'इससे हम आपकी फ़सलें सुझाते हैं।',
    'onboardingV2.growingType.backyard': 'पिछला आँगन / घर का बगीचा',
    'onboardingV2.growingType.small':    'छोटा खेत',
    'onboardingV2.growingType.medium':   'मध्यम खेत',
    'onboardingV2.growingType.large':    'बड़ा खेत',
    // Experience
    'onboardingV2.experience.title':       'आपके पास खेती का कितना अनुभव है?',
    'onboardingV2.experience.helper':      'हम फ़सलें और कामों का स्तर उसी के अनुसार तय करेंगे।',
    'onboardingV2.experience.new':         'मैं नया/नई हूँ',
    'onboardingV2.experience.experienced': 'मुझे अनुभव है',
    // Size details
    'onboardingV2.sizeDetails.backyard.title':  'आप कहाँ उगा रहे हैं?',
    'onboardingV2.sizeDetails.backyard.helper': 'इससे सुझाई गई फ़सलें और काम बदलते हैं।',
    'onboardingV2.sizeDetails.backyard.pots':   'गमले / कंटेनर',
    'onboardingV2.sizeDetails.backyard.raised': 'उठी हुई क्यारी',
    'onboardingV2.sizeDetails.backyard.soil':   'पिछले आँगन की मिट्टी',
    'onboardingV2.sizeDetails.backyard.approx': 'लगभग जगह (वैकल्पिक)',
    'onboardingV2.sizeDetails.farm.title':      'आपका खेत कितना बड़ा है?',
    'onboardingV2.sizeDetails.farm.helper':     'इससे कामों का पैमाना और योजना तय होती है।',
    'onboardingV2.sizeDetails.farm.small':      'छोटा — 2 एकड़ से कम',
    'onboardingV2.sizeDetails.farm.medium':     'मध्यम — 2 से 10 एकड़',
    'onboardingV2.sizeDetails.farm.large':      'बड़ा — 10 एकड़ से अधिक',
    'onboardingV2.sizeDetails.farm.exactLabel': 'सटीक आकार भरें (वैकल्पिक)',
    'onboardingV2.sizeDetails.farm.unit.acre':  'एकड़',
    'onboardingV2.sizeDetails.farm.unit.hectare':'हेक्टेयर',
    // Recommendations
    'onboardingV2.recommendations.title':    'आपके क्षेत्र के लिए सर्वोत्तम फ़सलें',
    'onboardingV2.recommendations.subtitle': 'आपके स्थान, अनुभव और खेती के तरीके के आधार पर',
    'onboardingV2.recommendations.best':     'आपके लिए सबसे अच्छी',
    'onboardingV2.recommendations.also':     'ये भी संभव हैं',
    'onboardingV2.recommendations.notRecommended':    'कम उपयुक्त',
    'onboardingV2.recommendations.showNotRecommended':'कम उपयुक्त फ़सलें दिखाएँ',
    'onboardingV2.recommendations.beginnerFriendly':  'शुरुआती-अनुकूल',
    'onboardingV2.recommendations.supportDepth.full':    'पूरा समर्थन',
    'onboardingV2.recommendations.supportDepth.partial': 'आंशिक समर्थन',
    'onboardingV2.recommendations.supportDepth.limited': 'सीमित समर्थन',
    'onboardingV2.recommendations.emptyState': 'आपके क्षेत्र के लिए सुझाव देने से पहले थोड़ी और जानकारी चाहिए।',
    // Crop confirm
    'onboardingV2.cropConfirm.title':        '{crop} से शुरू करें',
    'onboardingV2.cropConfirm.statusLabel':  'वर्तमान बुवाई की स्थिति',
    'onboardingV2.cropConfirm.startBtn':     'मेरी योजना शुरू करें',
    'onboardingV2.cropConfirm.changeBtn':    'फ़सल बदलें',
    // First-value
    'onboardingV2.first_value.task_title':   'आपका पहला काम तैयार है',
    'onboardingV2.first_value.task_why':     'यहाँ से शुरू करें और रोज़ का क्रम बनाएँ',
    'onboardingV2.first_value.plan_title':   'आपकी योजना तैयार है',
    'onboardingV2.first_value.plan_why':     'आज से हम आपका मार्गदर्शन करेंगे',
    'onboardingV2.first_value.plan_next':    'पहला काम देखने के लिए Today खोलें',
    'onboardingV2.first_value.cta.go_to_today': 'Today पर जाएँ',
    'onboardingV2.first_value.cta.view_plan':   'मेरी योजना देखें',
    // Progress
    'onboardingV2.progress.step': 'चरण {n} / {total}',
    // Common
    'onboardingV2.common.back':     'पीछे',
    'onboardingV2.common.next':     'आगे',
    'onboardingV2.common.continue': 'जारी रखें',
    'onboardingV2.common.skip':     'छोड़ें',
    'onboardingV2.common.saving':   'सहेजा जा रहा है…',
    'onboardingV2.common.offlineHint': 'आप ऑफ़लाइन हैं — प्रगति सहेजी जाएगी',
  },

  // Core subsets for the other shipped locales. English fallback
  // covers the long tail; expanding a locale is incremental.
  tw: coreLocale({
    'onboardingV2.welcome.promise':  'Yɛka deɛ ɛsɛ sɛ woyɛ wo afuo so da biara.',
    'onboardingV2.welcome.cta':      'Hyɛ aseɛ',
    'onboardingV2.location.title':   'Fa wo baabi',
    'onboardingV2.location.helper':  'Ɛboa yɛn ma yɛtumi ma wo nnɔbae a ɛfata.',
    'onboardingV2.location.detectCta':'Hwehwɛ me baabi',
    'onboardingV2.location.confirmYes':'Aane, fa saa',
    'onboardingV2.location.chooseManual':'Yi w\u02BCara',
    'onboardingV2.growingType.title':'Ɛhe na worefɛ adua?',
    'onboardingV2.experience.title': 'Wowɔ afuo yɛ ho osuahunu dodow sɛn?',
    'onboardingV2.recommendations.title':'Nnɔbae a ɛyɛ ma wo mpɔtam',
    'onboardingV2.cropConfirm.startBtn':'Hyɛ me nhyehyɛe ase',
    'onboardingV2.first_value.task_title':'Wo dwumadi a ɛdi kan asiesie ne ho',
    'onboardingV2.first_value.cta.go_to_today':'Kɔ Ɛnnɛ',
    'onboardingV2.progress.step':    'Ɔfa {n}/{total}',
  }),

  es: coreLocale({
    'onboardingV2.welcome.promise':     'Te decimos qué hacer en tu granja todos los días.',
    'onboardingV2.welcome.cta':         'Comenzar',
    'onboardingV2.location.title':      'Usa tu ubicación',
    'onboardingV2.location.helper':     'Nos ayuda a recomendar los cultivos y tareas correctos.',
    'onboardingV2.location.detectCta':  'Detectar mi ubicación',
    'onboardingV2.location.confirmPrompt':'¿Es esta la ubicación de tu granja?',
    'onboardingV2.location.confirmYes': 'Sí, usar esta',
    'onboardingV2.location.chooseManual':'Elegir manualmente',
    'onboardingV2.growingType.title':   '¿Qué describe mejor tu espacio de cultivo?',
    'onboardingV2.experience.title':    '¿Cuánta experiencia tienes en agricultura?',
    'onboardingV2.recommendations.title':'Mejores cultivos para tu ubicación',
    'onboardingV2.cropConfirm.startBtn':'Comenzar mi plan',
    'onboardingV2.first_value.task_title':'Tu primera tarea está lista',
    'onboardingV2.first_value.plan_title':'Tu plan está listo',
    'onboardingV2.first_value.cta.go_to_today':'Ir a Hoy',
    'onboardingV2.progress.step':       'Paso {n} de {total}',
  }),

  pt: coreLocale({
    'onboardingV2.welcome.promise':     'Dizemos o que fazer na sua fazenda todos os dias.',
    'onboardingV2.welcome.cta':         'Começar',
    'onboardingV2.location.title':      'Use sua localização',
    'onboardingV2.location.helper':     'Ajuda a recomendar as culturas e tarefas certas.',
    'onboardingV2.location.detectCta':  'Detectar minha localização',
    'onboardingV2.location.confirmYes': 'Sim, use esta',
    'onboardingV2.growingType.title':   'O que melhor descreve seu espaço de cultivo?',
    'onboardingV2.experience.title':    'Quanta experiência agrícola você tem?',
    'onboardingV2.recommendations.title':'Melhores culturas para sua localização',
    'onboardingV2.cropConfirm.startBtn':'Começar meu plano',
    'onboardingV2.first_value.task_title':'Sua primeira tarefa está pronta',
    'onboardingV2.first_value.cta.go_to_today':'Ir para Hoje',
    'onboardingV2.progress.step':       'Passo {n} de {total}',
  }),

  fr: coreLocale({
    'onboardingV2.welcome.promise':     'Nous vous indiquons quoi faire dans votre ferme chaque jour.',
    'onboardingV2.welcome.cta':         'Commencer',
    'onboardingV2.location.title':      'Utiliser votre position',
    'onboardingV2.location.helper':     'Cela nous aide à recommander les bonnes cultures et tâches.',
    'onboardingV2.location.detectCta':  'Détecter ma position',
    'onboardingV2.location.confirmYes': 'Oui, utilisez celle-ci',
    'onboardingV2.growingType.title':   'Qu\u2019est-ce qui décrit le mieux votre espace de culture?',
    'onboardingV2.experience.title':    'Quelle expérience agricole avez-vous?',
    'onboardingV2.recommendations.title':'Meilleures cultures pour votre emplacement',
    'onboardingV2.cropConfirm.startBtn':'Commencer mon plan',
    'onboardingV2.first_value.task_title':'Votre première tâche est prête',
    'onboardingV2.first_value.cta.go_to_today':'Aller à Aujourd\u2019hui',
    'onboardingV2.progress.step':       'Étape {n} sur {total}',
  }),

  ar: coreLocale({
    'onboardingV2.welcome.promise':     'نخبرك بما عليك فعله في مزرعتك كل يوم.',
    'onboardingV2.welcome.cta':         'ابدأ',
    'onboardingV2.location.title':      'استخدم موقعك',
    'onboardingV2.location.helper':     'هذا يساعدنا في اقتراح المحاصيل والمهام المناسبة.',
    'onboardingV2.location.detectCta':  'اكتشف موقعي',
    'onboardingV2.location.confirmYes': 'نعم، استخدم هذا',
    'onboardingV2.growingType.title':   'ما الذي يصف أفضل مساحة زراعتك؟',
    'onboardingV2.experience.title':    'كم لديك من الخبرة الزراعية؟',
    'onboardingV2.recommendations.title':'أفضل المحاصيل لموقعك',
    'onboardingV2.cropConfirm.startBtn':'ابدأ خطتي',
    'onboardingV2.first_value.task_title':'مهمتك الأولى جاهزة',
    'onboardingV2.first_value.cta.go_to_today':'اذهب إلى اليوم',
    'onboardingV2.progress.step':       'الخطوة {n} من {total}',
  }),

  sw: coreLocale({
    'onboardingV2.welcome.promise':     'Tunakuambia cha kufanya shambani kila siku.',
    'onboardingV2.welcome.cta':         'Anza',
    'onboardingV2.location.title':      'Tumia eneo lako',
    'onboardingV2.location.helper':     'Inatusaidia kupendekeza mazao na kazi sahihi.',
    'onboardingV2.location.detectCta':  'Gundua eneo langu',
    'onboardingV2.location.confirmYes': 'Ndiyo, tumia hili',
    'onboardingV2.growingType.title':   'Ni nini kinachofafanua eneo lako la kilimo?',
    'onboardingV2.experience.title':    'Una uzoefu kiasi gani wa kilimo?',
    'onboardingV2.recommendations.title':'Mazao bora kwa eneo lako',
    'onboardingV2.cropConfirm.startBtn':'Anza mpango wangu',
    'onboardingV2.first_value.task_title':'Kazi yako ya kwanza iko tayari',
    'onboardingV2.first_value.cta.go_to_today':'Nenda Leo',
    'onboardingV2.progress.step':       'Hatua {n} ya {total}',
  }),

  id: coreLocale({
    'onboardingV2.welcome.promise':     'Kami memberi tahu apa yang harus dilakukan di ladang setiap hari.',
    'onboardingV2.welcome.cta':         'Mulai',
    'onboardingV2.location.title':      'Gunakan lokasi Anda',
    'onboardingV2.location.helper':     'Ini membantu kami merekomendasikan tanaman dan tugas yang tepat.',
    'onboardingV2.location.detectCta':  'Deteksi lokasi saya',
    'onboardingV2.location.confirmYes': 'Ya, gunakan ini',
    'onboardingV2.growingType.title':   'Apa yang paling menggambarkan ruang tanam Anda?',
    'onboardingV2.experience.title':    'Berapa banyak pengalaman bertani Anda?',
    'onboardingV2.recommendations.title':'Tanaman terbaik untuk lokasi Anda',
    'onboardingV2.cropConfirm.startBtn':'Mulai rencana saya',
    'onboardingV2.first_value.task_title':'Tugas pertama Anda siap',
    'onboardingV2.first_value.cta.go_to_today':'Buka Hari Ini',
    'onboardingV2.progress.step':       'Langkah {n} dari {total}',
  }),
});

/**
 * applyOnboardingV2Overlay — merge overlay into a flat
 * dictionary in place. Returns the same reference.
 */
export function applyOnboardingV2Overlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(ONBOARDING_V2_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

/**
 * interpolate — the onboarding uses {crop}, {n}, {total} tokens
 * directly in the translation value. This tiny helper keeps that
 * substitution in one place.
 */
export function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

function coreLocale(keys) { return Object.freeze({ ...keys }); }

export default ONBOARDING_V2_TRANSLATIONS;
