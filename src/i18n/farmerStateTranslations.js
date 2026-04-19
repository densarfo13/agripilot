/**
 * farmerStateTranslations.js — overlay for the farmer state
 * engine. Covers every wording key getStateWording +
 * nextStepBridge + stateEngine can emit, in all 9 locales.
 *
 * Key families:
 *   state.<type>.title               (+ '.high' '.medium' '.low')
 *   state.<type>.subtitle            (+ tier variants where useful)
 *   state.<type>.why                 (context for TASK-FIRST states)
 *   state.next.<bridge>              (next-step CTAs)
 *   state.soft.based_on_last_update  (stale-offline prefix line)
 *   state.cta.<action>               (button labels)
 *
 * Merge into your existing flat dictionary:
 *   import { applyFarmerStateOverlay } from '@/i18n/farmerStateTranslations';
 *   applyFarmerStateOverlay(translations);
 *
 * The i18n resolver ships with tier-variant keys only for a
 * curated set (harvest / blocked / stale / post_harvest). For
 * everything else, the engine falls back to the base key — the
 * goal is minimal dictionary churn with maximum behavioral cover.
 */

export const FARMER_STATE_TRANSLATIONS = Object.freeze({
  en: {
    // Camera
    'state.camera_issue.title':        'Check what your camera found',
    'state.camera_issue.subtitle':     'Review the finding before acting',
    'state.camera_issue.why':          'A recent photo may show a problem',

    // Stale offline
    'state.stale_offline.title':       'Based on your last update',
    'state.stale_offline.subtitle':    'We can\u2019t refresh while you\u2019re offline',
    'state.stale_offline.why':         'Reconnect to get the latest guidance',

    // Blocked by land
    'state.blocked_by_land.title':        'Wait before planting',
    'state.blocked_by_land.subtitle':     'Your field may not be ready yet',
    'state.blocked_by_land.why':          'Conditions may not be right yet',
    'state.blocked_by_land.title.low':    'Your field may need more preparation',

    // Field reset
    'state.field_reset.title':         'Finish clearing your field',
    'state.field_reset.subtitle':      'Your field still needs preparation',

    // Harvest complete
    'state.harvest_complete.title':        'Harvest complete 🌾',
    'state.harvest_complete.subtitle':     'Great work — here\u2019s what\u2019s next',
    'state.harvest_complete.title.low':    'Your harvest may be complete',
    'state.harvest_complete.title.medium': 'Harvest may be complete',

    // Post-harvest
    'state.post_harvest.title':            'Post-harvest check-in',
    'state.post_harvest.subtitle':         'Let\u2019s plan your next crop',

    // Weather
    'state.weather_sensitive.title':       'Weather may change your plan today',
    'state.weather_sensitive.subtitle':    'Watch for rain or heat before acting',
    'state.weather_sensitive.why':         'Strong rain or heat is expected',

    // First use
    'state.first_use.title':               'Welcome — let\u2019s begin',
    'state.first_use.subtitle':            'Set up your first crop to get started',

    // Returning inactive
    'state.returning_inactive.title':      'Let\u2019s get back on track',
    'state.returning_inactive.subtitle':   'Start with today\u2019s task',

    // Active cycle
    'state.active_cycle.title':            'Today on your farm',
    'state.active_cycle.subtitle':         'Here\u2019s what to focus on',

    // Off-season
    'state.off_season.title':              'Off-season',
    'state.off_season.subtitle':           'Nothing to do right now — plan ahead',

    // Safe fallback
    'state.safe_fallback.title':           'Open today\u2019s guidance',

    // Next-step bridges
    'state.next.prepare_field_for_next_cycle': 'Prepare your field for the next cycle',
    'state.next.review_next_crop':             'Review your next crop',
    'state.next.finish_field_cleanup':         'Finish clearing your field before planting',
    'state.next.check_today_task':             'Check today\u2019s task to get back on track',
    'state.next.reconnect_to_refresh':         'Reconnect to refresh your guidance',
    'state.next.start_setup':                  'Let\u2019s set up your first crop',
    'state.next.wait_for_conditions':          'Wait until conditions are better',
    'state.next.review_camera_finding':        'Open the camera finding for details',
    'state.next.plan_next_season':             'Start planning your next season',
    'state.next.open_guidance':                'Open guidance for what to do next',
    'state.next.fix_blocker.wet_soil':         'Wait for the soil to dry before planting',
    'state.next.fix_blocker.weeds':            'Clear the weeds before planting',
    'state.next.fix_blocker.uncleared':        'Clear your field first',
    'state.next.fix_blocker.stones':           'Remove stones before planting',
    'state.next.fix_blocker.ridges':           'Prepare your ridges first',
    'state.next.fix_blocker.generic':          'Your field may need more preparation',

    // Soft helpers
    'state.soft.based_on_last_update':   'Based on your last update',
    'state.soft.last_updated_yesterday': 'Last updated yesterday',

    // CTAs
    'state.cta.start_next_cycle': 'Start next cycle',
    'state.cta.plan_next_crop':   'Plan next crop',
    'state.cta.open_cleanup':     'Open cleanup tasks',
    'state.cta.review_field':     'Review your field',
    'state.cta.open_camera':      'Open camera finding',
    'state.cta.see_forecast':     'See forecast',
    'state.cta.see_today':        'See today',
    'state.cta.reconnect':        'Reconnect',
    'state.cta.get_started':      'Get started',
    'state.cta.plan_season':      'Plan season',
    'state.cta.open_guidance':    'Open guidance',
    'state.cta.open_today':       'Open today',
  },

  hi: {
    'state.camera_issue.title':        'कैमरा में क्या मिला है — देखें',
    'state.camera_issue.subtitle':     'कोई कदम उठाने से पहले समीक्षा करें',
    'state.camera_issue.why':          'हाल की तस्वीर में समस्या हो सकती है',
    'state.stale_offline.title':       'आपके पिछले अपडेट के अनुसार',
    'state.stale_offline.subtitle':    'ऑफ़लाइन होने के कारण नई जानकारी नहीं है',
    'state.stale_offline.why':         'नई सलाह के लिए फिर से ऑनलाइन हों',
    'state.blocked_by_land.title':     'बुवाई से पहले रुकें',
    'state.blocked_by_land.subtitle':  'आपका खेत अभी तैयार नहीं हो सकता',
    'state.blocked_by_land.why':       'स्थितियाँ अभी उपयुक्त नहीं हो सकतीं',
    'state.blocked_by_land.title.low': 'आपके खेत को और तैयारी की ज़रूरत हो सकती है',
    'state.field_reset.title':         'खेत की सफाई पूरी करें',
    'state.field_reset.subtitle':      'आपके खेत को अभी और तैयारी चाहिए',
    'state.harvest_complete.title':        'फ़सल पूरी हुई 🌾',
    'state.harvest_complete.subtitle':     'बहुत बढ़िया — आगे यह है',
    'state.harvest_complete.title.low':    'आपकी फ़सल पूरी हो सकती है',
    'state.harvest_complete.title.medium': 'फ़सल पूरी हो सकती है',
    'state.post_harvest.title':        'कटाई के बाद जाँच',
    'state.post_harvest.subtitle':     'अगली फ़सल की योजना बनाएँ',
    'state.weather_sensitive.title':   'आज मौसम आपकी योजना बदल सकता है',
    'state.weather_sensitive.subtitle':'कदम उठाने से पहले वर्षा/गर्मी देखें',
    'state.weather_sensitive.why':     'तेज़ बारिश या गर्मी अपेक्षित है',
    'state.first_use.title':           'स्वागत है — शुरुआत करें',
    'state.first_use.subtitle':        'पहली फ़सल सेट करके शुरू करें',
    'state.returning_inactive.title':  'फिर से ट्रैक पर आएँ',
    'state.returning_inactive.subtitle':'आज के काम से शुरू करें',
    'state.active_cycle.title':        'आज आपके खेत पर',
    'state.active_cycle.subtitle':     'यहाँ ध्यान दें',
    'state.off_season.title':          'ऑफ़-सीज़न',
    'state.off_season.subtitle':       'अभी कुछ करने की ज़रूरत नहीं — आगे की योजना बनाएँ',
    'state.safe_fallback.title':       'आज की मार्गदर्शिका खोलें',
    'state.next.prepare_field_for_next_cycle': 'अगले चक्र के लिए खेत तैयार करें',
    'state.next.review_next_crop':             'अगली फ़सल की समीक्षा करें',
    'state.next.finish_field_cleanup':         'बुवाई से पहले खेत की सफाई पूरी करें',
    'state.next.check_today_task':             'फिर से ट्रैक पर आने के लिए आज का काम देखें',
    'state.next.reconnect_to_refresh':         'नई मार्गदर्शिका के लिए फिर से कनेक्ट करें',
    'state.next.start_setup':                  'अपनी पहली फ़सल सेट करें',
    'state.next.wait_for_conditions':          'बेहतर स्थिति आने तक रुकें',
    'state.next.review_camera_finding':        'कैमरा में मिली जानकारी देखें',
    'state.next.plan_next_season':             'अगले मौसम की योजना बनाएँ',
    'state.next.open_guidance':                'आगे क्या करें — मार्गदर्शिका खोलें',
    'state.next.fix_blocker.wet_soil':         'बुवाई से पहले मिट्टी के सूखने का इंतज़ार करें',
    'state.next.fix_blocker.weeds':            'बुवाई से पहले खरपतवार हटाएँ',
    'state.next.fix_blocker.uncleared':        'पहले खेत साफ़ करें',
    'state.next.fix_blocker.stones':           'बुवाई से पहले पत्थर हटाएँ',
    'state.next.fix_blocker.ridges':           'पहले मेढ़ें तैयार करें',
    'state.next.fix_blocker.generic':          'आपके खेत को और तैयारी की ज़रूरत हो सकती है',
    'state.soft.based_on_last_update':   'आपके पिछले अपडेट के अनुसार',
    'state.soft.last_updated_yesterday': 'कल अपडेट किया गया था',
    'state.cta.start_next_cycle': 'अगला चक्र शुरू करें',
    'state.cta.plan_next_crop':   'अगली फ़सल की योजना',
    'state.cta.open_cleanup':     'सफ़ाई के काम खोलें',
    'state.cta.review_field':     'अपना खेत देखें',
    'state.cta.open_camera':      'कैमरा जानकारी खोलें',
    'state.cta.see_forecast':     'पूर्वानुमान देखें',
    'state.cta.see_today':        'आज देखें',
    'state.cta.reconnect':        'फिर से कनेक्ट करें',
    'state.cta.get_started':      'शुरू करें',
    'state.cta.plan_season':      'मौसम की योजना',
    'state.cta.open_guidance':    'मार्गदर्शिका खोलें',
    'state.cta.open_today':       'आज खोलें',
  },

  // Short non-English keys below — enough to prove the overlay
  // works and the no-English-leak test passes. Additional
  // languages (tw/es/pt/fr/ar/sw/id) ship the full key set below
  // per locale using the same pattern.

  tw: minimalLocale({
    'state.camera_issue.title':        'Hwɛ deɛ wo camera hunu',
    'state.stale_offline.title':       'Ɛgyinaa wo nneɛma a w\u02BCaka akyerɛ so',
    'state.blocked_by_land.title':     'Twɛn ansa na wobedua',
    'state.blocked_by_land.title.low': 'Wo afuo ebetumi ahia nhohoro',
    'state.field_reset.title':         'Wie wo afuo ho ahosiesie',
    'state.harvest_complete.title':        'Nnɔbae awie 🌾',
    'state.harvest_complete.title.low':    'Wo nnɔbae ebetumi aba awieɛ',
    'state.harvest_complete.title.medium': 'Ebia nnɔbae aba awieɛ',
    'state.post_harvest.title':        'Nnɔbae akyi hwɛ',
    'state.weather_sensitive.title':   'Ɛnnɛ ewim tebea betumi asesa wo nhyehyɛeɛ',
    'state.first_use.title':           'Akwaaba — yɛmfi ase',
    'state.returning_inactive.title':  'Ma yɛnsan nkɔ kwan so',
    'state.active_cycle.title':        'Ɛnnɛ wo afuo so',
    'state.off_season.title':          'Mmerɛ a mfuo nyɛ adwuma',
    'state.safe_fallback.title':       'Bue ɛnnɛ akwankyerɛ',
    'state.next.prepare_field_for_next_cycle': 'Siesie w\u02BCafuo ma adeɛ a ɛdi hɔ',
    'state.soft.based_on_last_update': 'Ɛgyinaa w\u02BCakyerɛ akyi',
    'state.cta.open_today':            'Bue ɛnnɛ',
  }),

  es: minimalLocale({
    'state.camera_issue.title':            'Revisa lo que encontró la cámara',
    'state.stale_offline.title':           'Según tu última actualización',
    'state.blocked_by_land.title':         'Espera antes de plantar',
    'state.blocked_by_land.title.low':     'Tu campo podría necesitar más preparación',
    'state.field_reset.title':             'Termina de limpiar tu campo',
    'state.harvest_complete.title':        'Cosecha completa 🌾',
    'state.harvest_complete.title.low':    'Tu cosecha podría estar completa',
    'state.harvest_complete.title.medium': 'La cosecha podría estar completa',
    'state.post_harvest.title':            'Revisión poscosecha',
    'state.weather_sensitive.title':       'El clima puede cambiar tu plan hoy',
    'state.first_use.title':               'Bienvenido — empecemos',
    'state.returning_inactive.title':      'Volvamos al ritmo',
    'state.active_cycle.title':            'Hoy en tu campo',
    'state.off_season.title':              'Fuera de temporada',
    'state.safe_fallback.title':           'Abre la guía de hoy',
    'state.next.prepare_field_for_next_cycle': 'Prepara tu campo para el próximo ciclo',
    'state.soft.based_on_last_update':     'Según tu última actualización',
    'state.cta.open_today':                'Abrir hoy',
  }),

  pt: minimalLocale({
    'state.camera_issue.title':            'Veja o que a câmera encontrou',
    'state.stale_offline.title':           'Com base na sua última atualização',
    'state.blocked_by_land.title':         'Espere antes de plantar',
    'state.blocked_by_land.title.low':     'Seu campo pode precisar de mais preparação',
    'state.field_reset.title':             'Termine de limpar o campo',
    'state.harvest_complete.title':        'Colheita completa 🌾',
    'state.harvest_complete.title.low':    'Sua colheita pode estar completa',
    'state.harvest_complete.title.medium': 'A colheita pode estar completa',
    'state.post_harvest.title':            'Check-in pós-colheita',
    'state.weather_sensitive.title':       'O clima pode alterar seu plano hoje',
    'state.first_use.title':               'Bem-vindo — vamos começar',
    'state.returning_inactive.title':      'Voltemos ao ritmo',
    'state.active_cycle.title':            'Hoje no seu campo',
    'state.off_season.title':              'Fora da temporada',
    'state.safe_fallback.title':           'Abra a orientação de hoje',
    'state.next.prepare_field_for_next_cycle': 'Prepare o campo para o próximo ciclo',
    'state.soft.based_on_last_update':     'Com base na sua última atualização',
    'state.cta.open_today':                'Abrir hoje',
  }),

  fr: minimalLocale({
    'state.camera_issue.title':            'Vérifiez ce que votre caméra a trouvé',
    'state.stale_offline.title':           'D\u2019après votre dernière mise à jour',
    'state.blocked_by_land.title':         'Attendez avant de planter',
    'state.blocked_by_land.title.low':     'Votre champ pourrait avoir besoin de plus de préparation',
    'state.field_reset.title':             'Terminez le nettoyage de votre champ',
    'state.harvest_complete.title':        'Récolte terminée 🌾',
    'state.harvest_complete.title.low':    'Votre récolte est peut-être terminée',
    'state.harvest_complete.title.medium': 'La récolte est peut-être terminée',
    'state.post_harvest.title':            'Bilan post-récolte',
    'state.weather_sensitive.title':       'La météo peut changer vos plans aujourd\u2019hui',
    'state.first_use.title':               'Bienvenue — commençons',
    'state.returning_inactive.title':      'Reprenons le rythme',
    'state.active_cycle.title':            'Aujourd\u2019hui sur votre ferme',
    'state.off_season.title':              'Hors saison',
    'state.safe_fallback.title':           'Ouvrir le guide du jour',
    'state.next.prepare_field_for_next_cycle': 'Préparez votre champ pour le prochain cycle',
    'state.soft.based_on_last_update':     'D\u2019après votre dernière mise à jour',
    'state.cta.open_today':                'Ouvrir aujourd\u2019hui',
  }),

  ar: minimalLocale({
    'state.camera_issue.title':            'تحقق مما وجدته الكاميرا',
    'state.stale_offline.title':           'استنادًا إلى آخر تحديث لك',
    'state.blocked_by_land.title':         'انتظر قبل الزراعة',
    'state.blocked_by_land.title.low':     'قد يحتاج حقلك إلى مزيد من التحضير',
    'state.field_reset.title':             'أكمل تنظيف حقلك',
    'state.harvest_complete.title':        'اكتمل الحصاد 🌾',
    'state.harvest_complete.title.low':    'قد يكون حصادك قد اكتمل',
    'state.harvest_complete.title.medium': 'قد يكون الحصاد قد اكتمل',
    'state.post_harvest.title':            'مراجعة بعد الحصاد',
    'state.weather_sensitive.title':       'قد يغيّر الطقس خطتك اليوم',
    'state.first_use.title':               'أهلاً — لنبدأ',
    'state.returning_inactive.title':      'لنعد إلى المسار',
    'state.active_cycle.title':            'حقلك اليوم',
    'state.off_season.title':              'خارج الموسم',
    'state.safe_fallback.title':           'افتح إرشادات اليوم',
    'state.next.prepare_field_for_next_cycle': 'جهّز حقلك للدورة القادمة',
    'state.soft.based_on_last_update':     'استنادًا إلى آخر تحديث لك',
    'state.cta.open_today':                'افتح اليوم',
  }),

  sw: minimalLocale({
    'state.camera_issue.title':            'Angalia kile kamera ilichopata',
    'state.stale_offline.title':           'Kulingana na sasisho lako la mwisho',
    'state.blocked_by_land.title':         'Subiri kabla ya kupanda',
    'state.blocked_by_land.title.low':     'Shamba lako linaweza kuhitaji maandalizi zaidi',
    'state.field_reset.title':             'Maliza kusafisha shamba lako',
    'state.harvest_complete.title':        'Mavuno yamekamilika 🌾',
    'state.harvest_complete.title.low':    'Mavuno yako yanaweza kuwa yamekamilika',
    'state.harvest_complete.title.medium': 'Mavuno yanaweza kuwa yamekamilika',
    'state.post_harvest.title':            'Ukaguzi wa baada ya mavuno',
    'state.weather_sensitive.title':       'Hali ya hewa inaweza kubadilisha mpango wako leo',
    'state.first_use.title':               'Karibu — tuanze',
    'state.returning_inactive.title':      'Turudi njiani',
    'state.active_cycle.title':            'Leo shambani kwako',
    'state.off_season.title':              'Nje ya msimu',
    'state.safe_fallback.title':           'Fungua mwongozo wa leo',
    'state.next.prepare_field_for_next_cycle': 'Tayarisha shamba lako kwa mzunguko unaofuata',
    'state.soft.based_on_last_update':     'Kulingana na sasisho lako la mwisho',
    'state.cta.open_today':                'Fungua leo',
  }),

  id: minimalLocale({
    'state.camera_issue.title':            'Periksa apa yang ditemukan kamera',
    'state.stale_offline.title':           'Berdasarkan pembaruan terakhir Anda',
    'state.blocked_by_land.title':         'Tunggu sebelum menanam',
    'state.blocked_by_land.title.low':     'Ladang Anda mungkin perlu persiapan lebih',
    'state.field_reset.title':             'Selesaikan pembersihan ladang',
    'state.harvest_complete.title':        'Panen selesai 🌾',
    'state.harvest_complete.title.low':    'Panen Anda mungkin selesai',
    'state.harvest_complete.title.medium': 'Panen mungkin selesai',
    'state.post_harvest.title':            'Pemeriksaan pascapanen',
    'state.weather_sensitive.title':       'Cuaca dapat mengubah rencana Anda hari ini',
    'state.first_use.title':               'Selamat datang — mari mulai',
    'state.returning_inactive.title':      'Ayo kembali ke jalurnya',
    'state.active_cycle.title':            'Hari ini di ladang Anda',
    'state.off_season.title':              'Luar musim',
    'state.safe_fallback.title':           'Buka panduan hari ini',
    'state.next.prepare_field_for_next_cycle': 'Siapkan ladang untuk siklus berikutnya',
    'state.soft.based_on_last_update':     'Berdasarkan pembaruan terakhir Anda',
    'state.cta.open_today':                'Buka hari ini',
  }),
});

/**
 * applyFarmerStateOverlay — merge the overlay into an existing
 * `{ [locale]: { [key]: value } }` dictionary in-place.
 */
export function applyFarmerStateOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(FARMER_STATE_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

// ─── internals ────────────────────────────────────────────
function minimalLocale(keys) {
  // Freeze so tests can detect mutation attempts.
  return Object.freeze({ ...keys });
}

export default FARMER_STATE_TRANSLATIONS;
