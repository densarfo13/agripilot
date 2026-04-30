/**
 * photoAnalysisEngine.js — safe, rule-based placeholder for
 * the crop-photo intelligence flow.
 *
 * Strict-rule audit (spec §9):
 *   • NEVER claim a confirmed diagnosis. Output uses "possible
 *     issue" / "may indicate" wording.
 *   • NEVER recommend an exact pesticide / chemical dosage.
 *   • NEVER guarantee a yield / harvest outcome.
 *   • For severe / unclear images, default to "contact an
 *     agronomist".
 *   • The engine has no model access — every result is a
 *     templated, reviewed response keyed by question + crop.
 *
 * Wiring:
 *   • photoAnalysisService.analyzePhoto() calls this engine
 *     when the backend is unavailable (the default until the
 *     vision endpoint ships).
 *   • When FEATURE_OPEN_AI_DIAGNOSIS lands, the service will
 *     call the backend FIRST and use this engine as the safe
 *     fallback if the backend errors / times out.
 *
 * Output shape:
 *   {
 *     possibleIssue:     string,
 *     confidence:        'low' | 'medium' | 'high',
 *     recommendedAction: string,
 *     safetyWarning:     string | null,
 *     seekHelp:          string,    // when to contact help
 *     localizedResponse: string,    // stitched-together
 *                                    // version for voice playback
 *   }
 */

// ── Per-question copy keyed by language ──────────────────────
//
// The engine's job is to be HELPFUL without overclaiming.
// Each question carries a generic-but-actionable response that
// nudges the farmer toward the right next step (look, check,
// retake) and toward an agronomist when the picture suggests
// severity.
//
// All copy is spec-§9 reviewed: no pesticide dosages, no
// "confirmed", no yield guarantees.
const COPY = Object.freeze({
  whats_wrong: {
    en: {
      possibleIssue: 'Possible issue: leaves or stem may show stress signs.',
      recommendedAction: 'Check the leaves under the bottom of the plant, the stem, and the soil moisture. Compare with healthy plants on the same farm.',
      safetyWarning: null,
      seekHelp: 'If damage is spreading or affecting many plants, contact an agronomist within the next 24 hours.',
    },
    tw: {
      possibleIssue: 'Asɛm a ɛbɛtumi aba: nhaban anaa dua bi bɛtumi akyerɛ sɛ ɛrebrɛ.',
      recommendedAction: 'Hwɛ nhaban a ɛwɔ ase, dua no, ne fam asase ho fonkɔ. Toatoa wɔn ne nnɔbae a ɛho yɛ pa wɔ afuo no mu.',
      safetyWarning: null,
      seekHelp: 'Sɛ ɔhaw no retrɛw anaa ɛredidi nnɔbae bebree so a, frɛ kuayɛ ɔbenfoɔ wɔ nnɔnhwere 24 ntam.',
    },
    ha: {
      possibleIssue: 'Yiwuwar matsala: ganye ko kara na iya nuna alamun damuwa.',
      recommendedAction: 'Duba ganyaye a ƙarƙashin tsiron, kara, da danshin ƙasa. Kwatanta da tsire-tsiren da suka da lafiya.',
      safetyWarning: null,
      seekHelp: 'Idan lalacewa tana yaduwa ko ta shafi tsire-tsire da yawa, tuntuɓi masanin noma a cikin awa 24.',
    },
  },
  pest_damage: {
    en: {
      possibleIssue: 'Possible pest damage. Look for chew marks, holes, or insects on the leaves.',
      recommendedAction: 'Inspect the underside of the leaves and the stem early in the morning. Note how many plants are affected.',
      safetyWarning: 'Do not apply pesticide without expert guidance — wrong dosage can damage the crop.',
      seekHelp: 'If you see insects on more than a quarter of plants, contact an agronomist before treating.',
    },
    tw: {
      possibleIssue: 'Mmoa bi bɛtumi ahaw nnɔbae no. Hwɛ tu, tokuro anaa mmoa wɔ nhaban no so.',
      recommendedAction: 'Hwɛ nhaban no anim ne dua no anɔpa. Kan dodow nnɔbae a wɔayɛ wɔn bɔne.',
      safetyWarning: 'Mfa aduro nso nnyɛ adwuma sɛ wonni ɔbenfoɔ akwankyerɛ — dodow a ɛnyɛ pa bɛtumi asɛe nnɔbae no.',
      seekHelp: 'Sɛ wuhu mmoa wɔ nnɔbae no nyinaa nkyɛmu anan mu baako so a, frɛ kuayɛ ɔbenfoɔ ansa na woasɔ aduro.',
    },
    ha: {
      possibleIssue: 'Yiwuwar lalacewar kwari. Nemo alamun cizo, ramuka, ko kwari a kan ganye.',
      recommendedAction: 'Duba ƙarƙashin ganyaye da kara da safe. Kirga tsire-tsire nawa ne suka shafa.',
      safetyWarning: 'Kar ka yi amfani da maganin kwari ba tare da shawarar masani ba — magani fiye da kima yana iya lalata amfanin gona.',
      seekHelp: 'Idan kun ga kwari a sama da kwata na tsire-tsire, tuntuɓi masanin noma kafin ku yi magani.',
    },
  },
  disease: {
    en: {
      possibleIssue: 'Possible disease signs — spots, yellowing, or wilting may indicate a leaf or root issue.',
      recommendedAction: 'Mark affected plants with a stick. Avoid working on healthy plants right after touching the affected ones, to slow spread.',
      safetyWarning: 'Possible signs only. We cannot confirm a disease from a photo.',
      seekHelp: 'Contact an agronomist if more than a few plants show the same symptoms.',
    },
    tw: {
      possibleIssue: 'Yadeɛ bi bɛtumi aba — ntokuro, akokɔsrade, anaa ɔdɛn bɛtumi akyerɛ nhaban anaa nhini ho asɛm.',
      recommendedAction: 'Fa dua bi pi nnɔbae a ne ho yare no ho. Mfa wo nsa nka nnɔbae a ne ho yɛ pa amma ɔhaw no antrɛw.',
      safetyWarning: 'Yei yɛ nsɛnkyerɛnneɛ kɛkɛ. Yɛntumi nsi yadeɛ pii pi mfiri foto so.',
      seekHelp: 'Frɛ kuayɛ ɔbenfoɔ sɛ nnɔbae bebree kyerɛ saa nsɛnkyerɛnneɛ koro no a.',
    },
    ha: {
      possibleIssue: 'Yiwuwar alamun cuta — tabo, fitar rawaya, ko bushewa na iya nuna matsalar ganye ko saiwa.',
      recommendedAction: 'Yi alama ga tsire-tsiren da suka shafa da sanda. Kar ka taɓa tsire-tsiren da suka da lafiya bayan ka taɓi waɗanda suka shafa.',
      safetyWarning: 'Alamomi kawai. Ba mu iya tabbatar da cuta daga hoto ba.',
      seekHelp: 'Tuntuɓi masanin noma idan tsire-tsire fiye da \u2019yan kaɗan suna nuna alamomin.',
    },
  },
  ready_to_harvest: {
    en: {
      possibleIssue: 'The crop may be approaching harvest readiness, but a photo alone cannot confirm.',
      recommendedAction: 'Check the firmness, colour, and size of a few sample fruits or grains. Compare with the harvest guide for this crop.',
      safetyWarning: null,
      seekHelp: 'If unsure, ask an agronomist or check the harvest readiness chart on the My Farm page before cutting.',
    },
    tw: {
      possibleIssue: 'Nnɔbae no bɛtumi adi mu, nanso foto nko ara ntumi ntu adwene.',
      recommendedAction: 'Hwɛ aduaba kakra anaa aba kakra mu, ne kɛse, ne kɔla a ɛwɔ wɔn so. Toatoa ne nnɔbae yi twa ho akwankyerɛ ho.',
      safetyWarning: null,
      seekHelp: 'Sɛ wonnim a, bisa kuayɛ ɔbenfoɔ anaa hwɛ nnɔbae twa ho twerɛnsɛm wɔ Me Afuo pagye no so ansa na woatwa.',
    },
    ha: {
      possibleIssue: 'Amfanin gona na iya kusantowa shirye don girbi, amma hoto kaɗai ba zai iya tabbatarwa ba.',
      recommendedAction: 'Duba taurin, launi, da girman wasu \u2019ya\u2019yan itace ko ƙwayoyi. Kwatanta da jagorar girbi don wannan amfani.',
      safetyWarning: null,
      seekHelp: 'Idan ba ka da tabbaci, tambayi masanin noma ko duba jadawalin shirye-shiryen girbi a shafin Gonata kafin ka yanke.',
    },
  },
  whats_next: {
    en: {
      possibleIssue: 'We need a clearer view of the leaves, stem, and soil to suggest a next step.',
      recommendedAction: 'Take one photo of a healthy plant and one of an affected plant in good daylight. Then re-run the scan.',
      safetyWarning: null,
      seekHelp: 'If you see fast-spreading damage, contact an agronomist while you re-take the photo.',
    },
    tw: {
      possibleIssue: 'Yɛhia foto a ɛkyerɛ nhaban, dua, ne asase mu yiye, ansa na yɛatumi akyerɛ nea ɛsɛ sɛ woyɛ.',
      recommendedAction: 'Twe foto baako a ɛkyerɛ nnɔbae a ne ho yɛ pa, ne baako a ɛkyerɛ nea ne ho yare wɔ kanea pa mu. Afei san hwehwɛ.',
      safetyWarning: null,
      seekHelp: 'Sɛ wuhu sɛ ɔhaw no retrɛw ntɛm a, frɛ kuayɛ ɔbenfoɔ bere a worepɛ foto foforɔ.',
    },
    ha: {
      possibleIssue: 'Muna buƙatar bayyanannen hoto na ganye, kara, da ƙasa kafin mu ba da shawara.',
      recommendedAction: 'Ɗauki hoto ɗaya na tsiro mai lafiya da ɗaya na tsiron da ya shafa cikin haske mai kyau. Sannan sake nazari.',
      safetyWarning: null,
      seekHelp: 'Idan kun ga lalacewar tana yaduwa cikin sauri, tuntuɓi masanin noma yayin da kuke sake ɗaukar hoto.',
    },
  },
});

// ── Question id catalogue (canonical ids the UI uses) ────────
export const PHOTO_QUESTIONS = Object.freeze([
  { id: 'whats_wrong',      labelKey: 'photo.q.whatsWrong' },
  { id: 'pest_damage',      labelKey: 'photo.q.pestDamage' },
  { id: 'disease',          labelKey: 'photo.q.disease' },
  { id: 'ready_to_harvest', labelKey: 'photo.q.readyHarvest' },
  { id: 'whats_next',       labelKey: 'photo.q.whatsNext' },
]);

const SAFE_FALLBACK = Object.freeze({
  en: {
    possibleIssue: 'We need more information to give you a clear answer.',
    recommendedAction: 'Check the leaves, stem, soil moisture, and any pests. Take another clear photo in good light if possible.',
    safetyWarning: null,
    seekHelp: 'Contact an agronomist if damage is spreading or affecting many plants.',
  },
  tw: {
    possibleIssue: 'Yɛhia nsɛm pii ansa na yɛatumi ama wo mmuaeɛ pa.',
    recommendedAction: 'Hwɛ nhaban, dua, asase mu fonkɔ, ne mmoa biara. Twe foto foforɔ a ɛyɛ pa wɔ kanea pa mu sɛ wobetumi a.',
    safetyWarning: null,
    seekHelp: 'Frɛ kuayɛ ɔbenfoɔ sɛ ɔhaw retrɛw anaa ɛredidi nnɔbae bebree so a.',
  },
  ha: {
    possibleIssue: 'Muna buƙatar ƙarin bayani kafin mu ba da amsa bayyanannu.',
    recommendedAction: 'Duba ganyaye, kara, danshin ƙasa, da kwari. Idan zai yiwu ɗauki sabon hoto a haske mai kyau.',
    safetyWarning: null,
    seekHelp: 'Tuntuɓi masanin noma idan lalacewa tana yaduwa ko ta shafi tsire-tsire da yawa.',
  },
});

/**
 * pickResponse — language-aware selector with English fallback.
 */
function pickResponse(questionId, language) {
  const lang = String(language || 'en').toLowerCase();
  const row = COPY[questionId];
  if (!row) return SAFE_FALLBACK[lang] || SAFE_FALLBACK.en;
  return row[lang] || row.en;
}

/**
 * confidenceFor — returns 'low' for every rule-based response
 * because we cannot meaningfully confirm anything from the
 * placeholder engine. When the vision backend lands, the
 * service can override with the model's actual score.
 */
function confidenceFor(_questionId, _imageHint) {
  return 'low';
}

/**
 * stitchLocalizedResponse — short single-paragraph version
 * suitable for the voice playback path.
 */
function stitchLocalizedResponse(parts) {
  const out = [];
  if (parts.possibleIssue)     out.push(parts.possibleIssue);
  if (parts.recommendedAction) out.push(parts.recommendedAction);
  if (parts.safetyWarning)     out.push(parts.safetyWarning);
  if (parts.seekHelp)          out.push(parts.seekHelp);
  return out.join(' ');
}

/**
 * analyzePhoto — main entry. Pure function; no I/O.
 *
 * @param  {object} args
 * @param  {string} args.questionId   one of PHOTO_QUESTIONS.id
 * @param  {string} args.language     active UI language
 * @param  {string} [args.cropId]     optional crop hint (room
 *                                     for crop-specific copy
 *                                     when the partner team
 *                                     supplies it)
 * @param  {object} [args.imageHint]  optional metadata hint
 *                                     ({ tooDark, tooBlurry })
 *
 * @returns the analysis card payload (see file header).
 */
export function analyzePhoto({
  questionId,
  language = 'en',
  cropId = null,
  imageHint = null,
} = {}) {
  // Image-quality guards — the spec wants "ask the farmer to
  // retake in better light" when the picture is unusable.
  if (imageHint && (imageHint.tooDark || imageHint.tooBlurry)) {
    const lang = String(language).toLowerCase();
    const safe = SAFE_FALLBACK[lang] || SAFE_FALLBACK.en;
    const possibleIssue = lang === 'tw'
      ? 'Foto no mu nyɛ pa. Yɛnntumi nhwɛ no yiye.'
      : lang === 'ha'
        ? 'Hoton bai bayyana ba. Ba za mu iya nazari ba.'
        : 'The photo isn\u2019t clear enough to analyse.';
    const recommendedAction = lang === 'tw'
      ? 'San yɛ foto wɔ kanea pa mu, na fa kamera no bɛn nnɔbae no.'
      : lang === 'ha'
        ? 'Sake ɗaukar hoto a haske mai kyau, kuma kusantar da kyamara da tsiro.'
        : 'Re-take the photo in good daylight and move closer to the plant.';
    const result = {
      possibleIssue,
      confidence: 'low',
      recommendedAction,
      safetyWarning: null,
      seekHelp: safe.seekHelp,
    };
    return {
      ...result,
      localizedResponse: stitchLocalizedResponse(result),
      retakeRequested: true,
    };
  }

  const r = pickResponse(questionId, language);
  const result = {
    possibleIssue:     r.possibleIssue,
    confidence:        confidenceFor(questionId),
    recommendedAction: r.recommendedAction,
    safetyWarning:     r.safetyWarning,
    seekHelp:          r.seekHelp,
  };
  return {
    ...result,
    localizedResponse: stitchLocalizedResponse(result),
    retakeRequested: false,
  };
}

export const _internal = Object.freeze({ COPY, SAFE_FALLBACK });
