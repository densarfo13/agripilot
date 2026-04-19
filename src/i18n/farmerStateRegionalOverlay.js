/**
 * farmerStateRegionalOverlay.js — region-suffixed wording
 * variants layered on top of the base farmerStateTranslations.
 * Exists specifically so the tone adapter has real content to
 * differentiate on. Translators can expand any bucket
 * incrementally; the base key still wins when a bucket variant
 * is missing.
 *
 * Key pattern:
 *   <baseKey>.<bucket>
 *   e.g. state.blocked_by_land.why.tropical_manual
 *
 * Buckets (matching mapCountryToAgRegion):
 *   tropical_manual  tropical_mixed  monsoon_mixed
 *   temperate_mechanized  arid_irrigated
 *
 * We also ship a core set of `state.next.*` bridge keys in
 * every shipped locale so the English-leak tests can assert
 * every bridge has a translation without requiring the full
 * farmerStateTranslations to be fleshed out.
 */

export const FARMER_STATE_REGIONAL_TRANSLATIONS = Object.freeze({
  en: {
    // Blocked-by-land — flavored "why" per region
    'state.blocked_by_land.why.tropical_manual':
      'Your field needs hand preparation before planting',
    'state.blocked_by_land.why.monsoon_mixed':
      'Your field needs preparation before the rains',
    'state.blocked_by_land.why.temperate_mechanized':
      'Your field needs preparation \u2014 check drainage and soil tilth',
    'state.blocked_by_land.why.arid_irrigated':
      'Your field needs preparation \u2014 check irrigation before planting',

    // Field reset — regional cleanup wording
    'state.field_reset.subtitle.tropical_manual':
      'Clear the field by hand before the next planting',
    'state.field_reset.subtitle.monsoon_mixed':
      'Clear the field before the rains return',
    'state.field_reset.subtitle.temperate_mechanized':
      'Run the cleanup pass before the next planting window',

    // Blocker-specific next step by region
    'state.next.fix_blocker.wet_soil.monsoon_mixed':
      'Wait for the rains to ease and the soil to dry',
    'state.next.fix_blocker.wet_soil.temperate_mechanized':
      'Check drainage before the next planting window',
    'state.next.fix_blocker.uncleared.tropical_manual':
      'Clear your field by hand before planting',

    // Harvest-complete subtitle by region (mechanized vs manual)
    'state.harvest_complete.subtitle.tropical_manual':
      'Great work \u2014 clear the field for your next planting',
    'state.harvest_complete.subtitle.temperate_mechanized':
      'Harvest is in \u2014 schedule residue management next',
  },

  hi: {
    'state.blocked_by_land.why.monsoon_mixed':
      'बारिश से पहले खेत की तैयारी चाहिए',
    'state.next.fix_blocker.wet_soil.monsoon_mixed':
      'बारिश कम होने और मिट्टी सूखने का इंतज़ार करें',
    'state.field_reset.subtitle.monsoon_mixed':
      'बारिश लौटने से पहले खेत साफ़ करें',
  },

  tw: {
    'state.blocked_by_land.why.tropical_manual':
      'W\u02BCafuo no hia nsa ho nsiesie ansa na wobedua',
    'state.next.fix_blocker.uncleared.tropical_manual':
      'Yi wo afuo ho nsumaa ansa na wobedua',
    'state.field_reset.subtitle.tropical_manual':
      'Yi w\u02BCafuo ho nsumaa ma adeɛ a ɛdi hɔ',
  },

  es: {
    'state.blocked_by_land.why.tropical_manual':
      'Tu campo necesita preparación manual antes de plantar',
    'state.blocked_by_land.why.temperate_mechanized':
      'Tu campo necesita preparación \u2014 revisa el drenaje y la labranza',
  },

  pt: {
    'state.blocked_by_land.why.tropical_manual':
      'Seu campo precisa de preparação manual antes de plantar',
    'state.blocked_by_land.why.temperate_mechanized':
      'Seu campo precisa de preparação \u2014 verifique drenagem e lavoura',
  },

  fr: {
    'state.blocked_by_land.why.tropical_manual':
      'Votre champ nécessite une préparation manuelle avant plantation',
    'state.blocked_by_land.why.temperate_mechanized':
      'Votre champ nécessite une préparation \u2014 vérifiez drainage et labour',
  },

  ar: {
    'state.blocked_by_land.why.monsoon_mixed':
      'يحتاج حقلك إلى التحضير قبل موسم الأمطار',
  },

  sw: {
    'state.blocked_by_land.why.tropical_manual':
      'Shamba lako linahitaji maandalizi ya mkono kabla ya kupanda',
  },

  id: {
    'state.blocked_by_land.why.monsoon_mixed':
      'Ladang Anda perlu persiapan sebelum musim hujan',
  },
});

/**
 * Core next-step bridges shipped in every locale so the
 * English-leak test can assert every bridge has a translation.
 * This piggy-backs the same overlay function so callers only
 * have to apply one extra overlay to get both the regional
 * flavors and the core bridge coverage.
 */
export const CORE_BRIDGES_BY_LOCALE = Object.freeze({
  en: {
    'state.next.prepare_field_for_next_cycle':
      'Prepare your field for the next cycle',
    'state.next.review_next_crop':
      'Review your next crop',
    'state.next.reconnect_to_refresh':
      'Reconnect to refresh your guidance',
    'state.next.check_today_task':
      'Check today\u2019s task to get back on track',
  },
  hi: {
    'state.next.prepare_field_for_next_cycle':
      'अगले चक्र के लिए खेत तैयार करें',
    'state.next.review_next_crop':
      'अगली फ़सल की समीक्षा करें',
    'state.next.reconnect_to_refresh':
      'नई मार्गदर्शिका के लिए फिर से कनेक्ट करें',
    'state.next.check_today_task':
      'फिर से ट्रैक पर आने के लिए आज का काम देखें',
  },
  tw: {
    'state.next.prepare_field_for_next_cycle':
      'Siesie w\u02BCafuo ma adeɛ a ɛdi hɔ',
    'state.next.review_next_crop':
      'Hwɛ w\u02BCafudeɛ a ɛdi hɔ',
    'state.next.reconnect_to_refresh':
      'San bra intanɛt so na yɛn ma wo nsɛm foforɔ',
    'state.next.check_today_task':
      'Hwɛ ɛnnɛ adwumayɛ na wosan kɔ so',
  },
  es: {
    'state.next.prepare_field_for_next_cycle':
      'Prepara tu campo para el próximo ciclo',
    'state.next.review_next_crop':
      'Revisa tu próximo cultivo',
    'state.next.reconnect_to_refresh':
      'Reconéctate para actualizar tu guía',
    'state.next.check_today_task':
      'Revisa la tarea de hoy para retomar el ritmo',
  },
  pt: {
    'state.next.prepare_field_for_next_cycle':
      'Prepare seu campo para o próximo ciclo',
    'state.next.review_next_crop':
      'Revise sua próxima cultura',
    'state.next.reconnect_to_refresh':
      'Reconecte-se para atualizar sua orientação',
    'state.next.check_today_task':
      'Veja a tarefa de hoje para voltar ao ritmo',
  },
  fr: {
    'state.next.prepare_field_for_next_cycle':
      'Préparez votre champ pour le prochain cycle',
    'state.next.review_next_crop':
      'Examinez votre prochaine culture',
    'state.next.reconnect_to_refresh':
      'Reconnectez-vous pour actualiser vos conseils',
    'state.next.check_today_task':
      'Consultez la tâche d\u2019aujourd\u2019hui pour reprendre',
  },
  ar: {
    'state.next.prepare_field_for_next_cycle':
      'جهّز حقلك للدورة القادمة',
    'state.next.review_next_crop':
      'راجع محصولك التالي',
    'state.next.reconnect_to_refresh':
      'أعد الاتصال لتحديث إرشاداتك',
    'state.next.check_today_task':
      'تحقق من مهمة اليوم للعودة إلى المسار',
  },
  sw: {
    'state.next.prepare_field_for_next_cycle':
      'Tayarisha shamba lako kwa mzunguko unaofuata',
    'state.next.review_next_crop':
      'Angalia zao lako linalofuata',
    'state.next.reconnect_to_refresh':
      'Unganisha tena ili kupata mwongozo mpya',
    'state.next.check_today_task':
      'Angalia kazi ya leo ili kurudi kwenye mstari',
  },
  id: {
    'state.next.prepare_field_for_next_cycle':
      'Siapkan ladang untuk siklus berikutnya',
    'state.next.review_next_crop':
      'Tinjau tanaman berikutnya',
    'state.next.reconnect_to_refresh':
      'Sambungkan lagi untuk memperbarui panduan Anda',
    'state.next.check_today_task':
      'Periksa tugas hari ini untuk kembali ke jalurnya',
  },
});

/**
 * applyFarmerStateRegionalOverlay — merge both regional
 * variants AND the core bridge coverage into an existing
 * dictionary in place. Returns the same reference.
 */
export function applyFarmerStateRegionalOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(FARMER_STATE_REGIONAL_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  for (const [locale, keys] of Object.entries(CORE_BRIDGES_BY_LOCALE)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

export default FARMER_STATE_REGIONAL_TRANSLATIONS;
