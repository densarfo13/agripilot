/**
 * homeTranslations.js — i18n overlay for the Home screen's new
 * helpers: welcome header, subtitles, dominant-card labels,
 * CTAs, progress line, and fallback why text.
 *
 * Key families:
 *   home.welcome.*          — header line 1
 *   home.subtitle.*         — header line 2 / card subtitle
 *   home.card.label.*       — UPPERCASE card labels
 *   home.card.*             — card CTAs + stale-safe copy
 *   home.progress.*         — progress line variants
 *   home.why.*              — last-resort why fallbacks
 *
 * Full English + Hindi ship. Other locales ship the core subset
 * with English fallback for the long tail — same pattern as the
 * other overlays.
 */

export const HOME_TRANSLATIONS = Object.freeze({
  en: {
    // Welcome line 1
    'home.welcome.good_morning_name':   'Good morning, {name}',
    'home.welcome.good_afternoon_name': 'Good afternoon, {name}',
    'home.welcome.good_evening_name':   'Good evening, {name}',
    'home.welcome.welcome_name':        'Welcome, {name}',
    'home.welcome.welcome_back_name':   'Welcome back, {name}',
    'home.welcome.harvest_complete':    'Harvest complete 🌾',
    'home.welcome.post_harvest':        'Post-harvest check-in',
    'home.welcome.field_reset':         'Finish clearing your field',
    'home.welcome.based_on_last_update':'Based on your last update',
    'home.welcome.fallback_name':       'there',

    // Welcome line 2 / subtitles
    'home.subtitle.lets_get_back_on_track':  'Let\u2019s get back on track',
    'home.subtitle.prepare_field_next_cycle':'Prepare your field for the next cycle',
    'home.subtitle.review_next_crop':        'Review your next crop',
    'home.subtitle.field_cleanup_first':     'Clear the field before the next planting',
    'home.subtitle.check_field_today':       'Check your field today',
    'home.subtitle.lets_set_up':             'Let\u2019s set up your first crop',
    'home.subtitle.dry_now_rain_later':      'Dry now \u2014 rain later today',
    'home.subtitle.rain_coming':             'Rain is coming later today',
    'home.subtitle.heat_expected':           'Heat expected today',
    'home.subtitle.here_whats_next':         'Here\u2019s what\u2019s next',
    'home.subtitle.nothing_urgent':          'Nothing urgent — check today\u2019s task',

    // Card labels
    'home.card.label.today':         'TODAY',
    'home.card.label.today_task':    'TODAY\u2019S TASK',
    'home.card.label.harvest':       'HARVEST',
    'home.card.label.post_harvest':  'POST-HARVEST',
    'home.card.label.field_reset':   'FIELD RESET',
    'home.card.label.resume':        'RESUME',
    'home.card.label.stale':         'BASED ON LAST UPDATE',
    'home.card.label.setup':         'SETUP',
    'home.card.label.camera':        'CAMERA FINDING',
    'home.card.label.off_season':    'OFF-SEASON',
    'home.card.label.reminder':      'STILL ON YOUR LIST',

    // Card CTAs
    'home.card.mark_done':       'Mark as done',
    'home.card.i_checked':       'I checked',
    'home.card.continue':        'Continue',
    'home.card.try_again':       'Try again',
    'home.card.see_today':       'See today',
    'home.card.get_started':     'Get started',
    'home.card.open_finding':    'Open finding',

    // Stale-safe card copy
    'home.card.stale_title':     'Check your field today',
    'home.card.stale_why':       'Your latest data may be out of date',

    // Progress line
    'home.progress.all_done':       'All done for now',
    'home.progress.x_of_y':         '{done} of {total} done today',
    'home.progress.on_track':       'On track',
    'home.progress.nothing_queued': 'Nothing queued today',

    // Fallback why
    'home.why.missed_days':  'You missed a few days — start here',
    'home.why.generic':      'Here\u2019s what matters today',
  },

  hi: {
    'home.welcome.good_morning_name':   'सुप्रभात, {name}',
    'home.welcome.good_afternoon_name': 'शुभ दोपहर, {name}',
    'home.welcome.good_evening_name':   'शुभ संध्या, {name}',
    'home.welcome.welcome_name':        'स्वागत है, {name}',
    'home.welcome.welcome_back_name':   'वापस स्वागत है, {name}',
    'home.welcome.harvest_complete':    'फ़सल पूरी हुई 🌾',
    'home.welcome.post_harvest':        'कटाई के बाद जाँच',
    'home.welcome.field_reset':         'खेत की सफ़ाई पूरी करें',
    'home.welcome.based_on_last_update':'आपके पिछले अपडेट के अनुसार',
    'home.welcome.fallback_name':       'वहाँ',
    'home.subtitle.lets_get_back_on_track':  'फिर से ट्रैक पर आएँ',
    'home.subtitle.prepare_field_next_cycle':'अगले चक्र के लिए खेत तैयार करें',
    'home.subtitle.review_next_crop':        'अगली फ़सल की समीक्षा करें',
    'home.subtitle.field_cleanup_first':     'अगली बुवाई से पहले खेत साफ़ करें',
    'home.subtitle.check_field_today':       'आज अपने खेत की जाँच करें',
    'home.subtitle.lets_set_up':             'पहली फ़सल सेट करें',
    'home.subtitle.dry_now_rain_later':      'अभी सूखा है — बाद में बारिश',
    'home.subtitle.rain_coming':             'बाद में बारिश की संभावना है',
    'home.subtitle.heat_expected':           'आज गर्मी अपेक्षित है',
    'home.subtitle.here_whats_next':         'आगे यह है',
    'home.subtitle.nothing_urgent':          'कुछ ज़रूरी नहीं — आज का काम देखें',
    'home.card.label.today':         'आज',
    'home.card.label.today_task':    'आज का काम',
    'home.card.label.harvest':       'फ़सल',
    'home.card.label.post_harvest':  'कटाई के बाद',
    'home.card.label.field_reset':   'खेत रिसेट',
    'home.card.label.resume':        'फिर से शुरू',
    'home.card.label.stale':         'पिछले अपडेट के अनुसार',
    'home.card.label.setup':         'सेटअप',
    'home.card.label.camera':        'कैमरा निष्कर्ष',
    'home.card.label.off_season':    'ऑफ़-सीज़न',
    'home.card.label.reminder':      'आज भी आपकी सूची में',
    'home.card.mark_done':       'पूरा करें',
    'home.card.i_checked':       'मैंने देखा',
    'home.card.continue':        'जारी रखें',
    'home.card.try_again':       'फिर से कोशिश करें',
    'home.card.see_today':       'आज देखें',
    'home.card.get_started':     'शुरू करें',
    'home.card.open_finding':    'निष्कर्ष खोलें',
    'home.card.stale_title':     'आज अपने खेत की जाँच करें',
    'home.card.stale_why':       'आपकी नवीनतम जानकारी पुरानी हो सकती है',
    'home.progress.all_done':       'अभी के लिए सब हो गया',
    'home.progress.x_of_y':         'आज {done}/{total} पूरा',
    'home.progress.on_track':       'सही रास्ते पर',
    'home.progress.nothing_queued': 'आज कुछ नहीं',
    'home.why.missed_days':  'आप कुछ दिन चूक गए — यहाँ से शुरू करें',
    'home.why.generic':      'आज की मुख्य बात',
  },

  // Core subsets
  tw: core({
    'home.welcome.good_morning_name': 'Maakye, {name}',
    'home.welcome.welcome_back_name': 'Akwaaba bio, {name}',
    'home.welcome.harvest_complete':  'Nnɔbae awie 🌾',
    'home.subtitle.lets_get_back_on_track': 'Ma yɛnsan nkɔ kwan so',
    'home.subtitle.prepare_field_next_cycle': 'Siesie w\u02BCafuo ma adeɛ a ɛdi hɔ',
    'home.card.label.today_task': 'ƐNNƐ ADWUMA',
    'home.card.mark_done':        'Wie no',
    'home.progress.on_track':     'Ɛrekɔ yie',
  }),
  es: core({
    'home.welcome.good_morning_name': 'Buenos días, {name}',
    'home.welcome.welcome_back_name': 'Bienvenido de nuevo, {name}',
    'home.welcome.harvest_complete':  'Cosecha completa 🌾',
    'home.subtitle.lets_get_back_on_track': 'Volvamos al ritmo',
    'home.subtitle.prepare_field_next_cycle': 'Prepara tu campo para el próximo ciclo',
    'home.subtitle.rain_coming': 'Viene lluvia más tarde',
    'home.card.label.today_task': 'TAREA DE HOY',
    'home.card.mark_done':        'Marcar como hecho',
    'home.card.continue':         'Continuar',
    'home.card.try_again':        'Reintentar',
    'home.progress.all_done':     'Todo hecho',
    'home.progress.x_of_y':       '{done} de {total} hechos hoy',
    'home.progress.on_track':     'Vas bien',
  }),
  pt: core({
    'home.welcome.good_morning_name': 'Bom dia, {name}',
    'home.welcome.welcome_back_name': 'Bem-vindo de volta, {name}',
    'home.welcome.harvest_complete':  'Colheita completa 🌾',
    'home.subtitle.lets_get_back_on_track': 'Voltemos ao ritmo',
    'home.subtitle.prepare_field_next_cycle': 'Prepare o campo para o próximo ciclo',
    'home.card.label.today_task': 'TAREFA DE HOJE',
    'home.card.mark_done':        'Marcar como feito',
    'home.card.continue':         'Continuar',
    'home.progress.x_of_y':       '{done} de {total} feitos hoje',
  }),
  fr: core({
    'home.welcome.good_morning_name': 'Bonjour, {name}',
    'home.welcome.welcome_back_name': 'Content de vous revoir, {name}',
    'home.welcome.harvest_complete':  'Récolte terminée 🌾',
    'home.subtitle.lets_get_back_on_track': 'Reprenons le rythme',
    'home.subtitle.prepare_field_next_cycle': 'Préparez votre champ pour le prochain cycle',
    'home.card.label.today_task': 'TÂCHE DU JOUR',
    'home.card.mark_done':        'Marquer comme terminé',
    'home.card.continue':         'Continuer',
    'home.progress.x_of_y':       '{done} sur {total} aujourd\u2019hui',
  }),
  ar: core({
    'home.welcome.good_morning_name': 'صباح الخير، {name}',
    'home.welcome.welcome_back_name': 'أهلاً بعودتك، {name}',
    'home.welcome.harvest_complete':  'اكتمل الحصاد 🌾',
    'home.subtitle.lets_get_back_on_track': 'لنعد إلى المسار',
    'home.subtitle.prepare_field_next_cycle': 'جهّز حقلك للدورة القادمة',
    'home.card.label.today_task': 'مهمة اليوم',
    'home.card.mark_done':        'اعتبره منجزاً',
    'home.progress.x_of_y':       '{done} من {total} اليوم',
  }),
  sw: core({
    'home.welcome.good_morning_name': 'Habari za asubuhi, {name}',
    'home.welcome.welcome_back_name': 'Karibu tena, {name}',
    'home.welcome.harvest_complete':  'Mavuno yamekamilika 🌾',
    'home.subtitle.lets_get_back_on_track': 'Turudi njiani',
    'home.subtitle.prepare_field_next_cycle': 'Tayarisha shamba kwa mzunguko unaofuata',
    'home.card.label.today_task': 'KAZI YA LEO',
    'home.card.mark_done':        'Maliza',
    'home.progress.x_of_y':       '{done} kati ya {total} leo',
  }),
  id: core({
    'home.welcome.good_morning_name': 'Selamat pagi, {name}',
    'home.welcome.welcome_back_name': 'Selamat datang kembali, {name}',
    'home.welcome.harvest_complete':  'Panen selesai 🌾',
    'home.subtitle.lets_get_back_on_track': 'Ayo kembali ke jalurnya',
    'home.subtitle.prepare_field_next_cycle': 'Siapkan ladang untuk siklus berikutnya',
    'home.card.label.today_task': 'TUGAS HARI INI',
    'home.card.mark_done':        'Tandai selesai',
    'home.progress.x_of_y':       '{done} dari {total} hari ini',
  }),
});

/** applyHomeOverlay — merge into an existing dictionary in place. */
export function applyHomeOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(HOME_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

function core(keys) { return Object.freeze({ ...keys }); }

export default HOME_TRANSLATIONS;
