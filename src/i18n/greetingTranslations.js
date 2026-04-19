/**
 * greetingTranslations.js — overlay for the dynamic-greeting
 * system. Adds 13 keys × 9 locales. Merge into the existing
 * dictionary with one line:
 *
 *   import { applyGreetingOverlay } from '@/i18n/greetingTranslations';
 *   applyGreetingOverlay(translations);
 *
 * Keys:
 *   greeting.time.morning / .afternoon / .evening
 *   greeting.first_use.title / .subtitle
 *   greeting.active_day.subtitle_with_crop    (contains {crop})
 *   greeting.active_day.subtitle_generic
 *   greeting.done.title / .subtitle
 *   greeting.inactive_return.title / .subtitle / .subtitle_many
 *   greeting.post_harvest.title / .subtitle
 *
 * The {crop} token is substituted by getDynamicGreeting with the
 * output of getCropDisplayName, so crop labels stay localized.
 */

export const GREETING_TRANSLATIONS = Object.freeze({
  en: {
    'greeting.time.morning':                 'Good morning 👋',
    'greeting.time.afternoon':               'Good afternoon 👋',
    'greeting.time.evening':                 'Good evening 👋',
    'greeting.first_use.title':              'Welcome 👋',
    'greeting.first_use.subtitle':           'Here\u2019s what to do first',
    'greeting.active_day.subtitle_with_crop':'Let\u2019s take care of your {crop} today',
    'greeting.active_day.subtitle_generic':  'Let\u2019s get today\u2019s farm work done',
    'greeting.done.title':                   'Nice work 👍',
    'greeting.done.subtitle':                'You\u2019re done for today',
    'greeting.inactive_return.title':        'Welcome back 👋',
    'greeting.inactive_return.subtitle':     'Let\u2019s get you back on track',
    'greeting.inactive_return.subtitle_many':'You missed a few days — start with this',
    'greeting.post_harvest.title':           'Harvest complete 👏',
    'greeting.post_harvest.subtitle':        'Let\u2019s plan your next crop',
  },
  hi: {
    'greeting.time.morning':                 'सुप्रभात 👋',
    'greeting.time.afternoon':               'शुभ दोपहर 👋',
    'greeting.time.evening':                 'शुभ संध्या 👋',
    'greeting.first_use.title':              'स्वागत है 👋',
    'greeting.first_use.subtitle':           'पहला कदम यह है',
    'greeting.active_day.subtitle_with_crop':'आज अपने {crop} का ध्यान रखें',
    'greeting.active_day.subtitle_generic':  'आज का खेत का काम पूरा करें',
    'greeting.done.title':                   'बहुत बढ़िया 👍',
    'greeting.done.subtitle':                'आज के लिए आपका काम पूरा है',
    'greeting.inactive_return.title':        'वापस स्वागत है 👋',
    'greeting.inactive_return.subtitle':     'फिर से शुरू करें',
    'greeting.inactive_return.subtitle_many':'कुछ दिन छूट गए — यहाँ से शुरू करें',
    'greeting.post_harvest.title':           'फ़सल पूरी हुई 👏',
    'greeting.post_harvest.subtitle':        'अगली फ़सल की योजना बनाएँ',
  },
  tw: {
    'greeting.time.morning':                 'Maakye 👋',
    'greeting.time.afternoon':               'Maaha 👋',
    'greeting.time.evening':                 'Maadwo 👋',
    'greeting.first_use.title':              'Akwaaba 👋',
    'greeting.first_use.subtitle':           'Deɛ ɛsɛ sɛ woyɛ kan nie',
    'greeting.active_day.subtitle_with_crop':'Hwɛ wo {crop} no ɛnnɛ',
    'greeting.active_day.subtitle_generic':  'Yɛ ɛnnɛ afuo adwuma',
    'greeting.done.title':                   'Papa 👍',
    'greeting.done.subtitle':                'Wo awie ɛnnɛ',
    'greeting.inactive_return.title':        'Akwaaba bio 👋',
    'greeting.inactive_return.subtitle':     'Yɛnkɔ so bio',
    'greeting.inactive_return.subtitle_many':'Woapa nnawɔtwe kakra — fi ha hyɛ aseɛ',
    'greeting.post_harvest.title':           'Nnɔbae awie 👏',
    'greeting.post_harvest.subtitle':        'Yɛn nhyehyɛ wo afudeɛ a ɛdi hɔ no',
  },
  es: {
    'greeting.time.morning':                 'Buenos días 👋',
    'greeting.time.afternoon':               'Buenas tardes 👋',
    'greeting.time.evening':                 'Buenas noches 👋',
    'greeting.first_use.title':              'Bienvenido 👋',
    'greeting.first_use.subtitle':           'Esto es lo primero',
    'greeting.active_day.subtitle_with_crop':'Cuida hoy de tus {crop}',
    'greeting.active_day.subtitle_generic':  'Hagamos el trabajo de hoy',
    'greeting.done.title':                   'Buen trabajo 👍',
    'greeting.done.subtitle':                'Has terminado por hoy',
    'greeting.inactive_return.title':        'Bienvenido de nuevo 👋',
    'greeting.inactive_return.subtitle':     'Pongámonos al día',
    'greeting.inactive_return.subtitle_many':'Te perdiste unos días — empieza aquí',
    'greeting.post_harvest.title':           'Cosecha completa 👏',
    'greeting.post_harvest.subtitle':        'Planifiquemos tu próximo cultivo',
  },
  pt: {
    'greeting.time.morning':                 'Bom dia 👋',
    'greeting.time.afternoon':               'Boa tarde 👋',
    'greeting.time.evening':                 'Boa noite 👋',
    'greeting.first_use.title':              'Bem-vindo 👋',
    'greeting.first_use.subtitle':           'Eis o primeiro passo',
    'greeting.active_day.subtitle_with_crop':'Cuida hoje do teu {crop}',
    'greeting.active_day.subtitle_generic':  'Vamos ao trabalho de hoje',
    'greeting.done.title':                   'Bom trabalho 👍',
    'greeting.done.subtitle':                'Terminaste por hoje',
    'greeting.inactive_return.title':        'Bem-vindo de volta 👋',
    'greeting.inactive_return.subtitle':     'Voltemos ao ritmo',
    'greeting.inactive_return.subtitle_many':'Faltaram alguns dias — começa aqui',
    'greeting.post_harvest.title':           'Colheita completa 👏',
    'greeting.post_harvest.subtitle':        'Vamos planear a próxima cultura',
  },
  fr: {
    'greeting.time.morning':                 'Bonjour 👋',
    'greeting.time.afternoon':               'Bon après-midi 👋',
    'greeting.time.evening':                 'Bonsoir 👋',
    'greeting.first_use.title':              'Bienvenue 👋',
    'greeting.first_use.subtitle':           'Voici la première étape',
    'greeting.active_day.subtitle_with_crop':'Occupons-nous de vos {crop} aujourd\u2019hui',
    'greeting.active_day.subtitle_generic':  'Faisons le travail du jour',
    'greeting.done.title':                   'Bien joué 👍',
    'greeting.done.subtitle':                'Vous avez terminé pour aujourd\u2019hui',
    'greeting.inactive_return.title':        'Content de vous revoir 👋',
    'greeting.inactive_return.subtitle':     'Reprenons le rythme',
    'greeting.inactive_return.subtitle_many':'Vous avez manqué quelques jours — commencez ici',
    'greeting.post_harvest.title':           'Récolte terminée 👏',
    'greeting.post_harvest.subtitle':        'Planifions votre prochaine culture',
  },
  ar: {
    'greeting.time.morning':                 'صباح الخير 👋',
    'greeting.time.afternoon':               'مساء الخير 👋',
    'greeting.time.evening':                 'مساء الخير 👋',
    'greeting.first_use.title':              'أهلاً بك 👋',
    'greeting.first_use.subtitle':           'هذه أول خطوة',
    'greeting.active_day.subtitle_with_crop':'اعتنِ بمحصول الـ{crop} اليوم',
    'greeting.active_day.subtitle_generic':  'لننجز عمل اليوم',
    'greeting.done.title':                   'أحسنت 👍',
    'greeting.done.subtitle':                'انتهيت لهذا اليوم',
    'greeting.inactive_return.title':        'أهلاً بعودتك 👋',
    'greeting.inactive_return.subtitle':     'لنعد إلى المسار',
    'greeting.inactive_return.subtitle_many':'فاتتك بضعة أيام — ابدأ من هنا',
    'greeting.post_harvest.title':           'اكتمل الحصاد 👏',
    'greeting.post_harvest.subtitle':        'لنخطط للمحصول التالي',
  },
  sw: {
    'greeting.time.morning':                 'Habari za asubuhi 👋',
    'greeting.time.afternoon':               'Habari za mchana 👋',
    'greeting.time.evening':                 'Habari za jioni 👋',
    'greeting.first_use.title':              'Karibu 👋',
    'greeting.first_use.subtitle':           'Hatua ya kwanza ni hii',
    'greeting.active_day.subtitle_with_crop':'Leo tunze {crop} yako',
    'greeting.active_day.subtitle_generic':  'Tufanye kazi za shamba leo',
    'greeting.done.title':                   'Kazi nzuri 👍',
    'greeting.done.subtitle':                'Umemaliza kwa leo',
    'greeting.inactive_return.title':        'Karibu tena 👋',
    'greeting.inactive_return.subtitle':     'Turudi njiani',
    'greeting.inactive_return.subtitle_many':'Umekosa siku kadhaa — anzia hapa',
    'greeting.post_harvest.title':           'Mavuno yamekamilika 👏',
    'greeting.post_harvest.subtitle':        'Tupange zao linalofuata',
  },
  id: {
    'greeting.time.morning':                 'Selamat pagi 👋',
    'greeting.time.afternoon':               'Selamat siang 👋',
    'greeting.time.evening':                 'Selamat malam 👋',
    'greeting.first_use.title':              'Selamat datang 👋',
    'greeting.first_use.subtitle':           'Inilah langkah pertama',
    'greeting.active_day.subtitle_with_crop':'Rawat {crop} Anda hari ini',
    'greeting.active_day.subtitle_generic':  'Mari selesaikan pekerjaan hari ini',
    'greeting.done.title':                   'Kerja bagus 👍',
    'greeting.done.subtitle':                'Anda sudah selesai untuk hari ini',
    'greeting.inactive_return.title':        'Selamat datang kembali 👋',
    'greeting.inactive_return.subtitle':     'Ayo kembali ke jalurnya',
    'greeting.inactive_return.subtitle_many':'Anda melewatkan beberapa hari — mulai dari sini',
    'greeting.post_harvest.title':           'Panen selesai 👏',
    'greeting.post_harvest.subtitle':        'Mari rencanakan tanaman berikutnya',
  },
});

/**
 * applyGreetingOverlay — merge the overlay into an existing
 * `{ [locale]: { [key]: value } }` dictionary in-place. Returns
 * the same reference so callers can chain.
 */
export function applyGreetingOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(GREETING_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

export default GREETING_TRANSLATIONS;
