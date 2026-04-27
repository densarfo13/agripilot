/**
 * mlWarningTranslations.js — i18n overlay for the model-status
 * banner copy surfaced by src/components/MlBaselineWarning.jsx.
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored
 * values still win.
 *
 * Keys covered
 *   ml.warning.placeholder  — zero-weight model (no real training yet)
 *   ml.warning.baseline     — small dataset (under 500 rows)
 *   ml.warning.stale        — old weights (over 90 days since training)
 *   ml.baseline.detailRows  — "Based on N labeled examples so far."
 *
 * Strict-rule audit
 *   * Calibrated wording: never claims accuracy, never says
 *     "AI is recommending..." in baseline mode. Just discloses
 *     the data state.
 *   * Translatable across en/fr/sw/ha/tw/hi.
 *   * {count} interpolation is supported on detailRows so the
 *     dataset size renders inline.
 */

export const ML_WARNING_TRANSLATIONS = Object.freeze({
  en: {
    'ml.warning.placeholder':  'No model trained yet. Using rule-based risk.',
    'ml.warning.baseline':     'Baseline model only \u2014 more data needed.',
    'ml.warning.stale':        'Model weights are old. Retraining recommended.',
    'ml.baseline.detailRows':  'Based on {count} labeled examples so far.',
  },

  fr: {
    'ml.warning.placeholder':  'Aucun mod\u00E8le entra\u00EEn\u00E9 pour le moment. Risque calcul\u00E9 par r\u00E8gles.',
    'ml.warning.baseline':     'Mod\u00E8le de base seulement \u2014 plus de donn\u00E9es n\u00E9cessaires.',
    'ml.warning.stale':        'Les poids du mod\u00E8le sont anciens. Un r\u00E9-entra\u00EEnement est recommand\u00E9.',
    'ml.baseline.detailRows':  'Bas\u00E9 sur {count} exemples \u00E9tiquet\u00E9s pour l\u2019instant.',
  },

  sw: {
    'ml.warning.placeholder':  'Hakuna modeli iliyofunzwa bado. Tunatumia hatari ya sheria.',
    'ml.warning.baseline':     'Modeli ya msingi tu \u2014 tunahitaji data zaidi.',
    'ml.warning.stale':        'Uzito wa modeli umechakaa. Inashauriwa kuifunza tena.',
    'ml.baseline.detailRows':  'Imejengwa juu ya mifano {count} hadi sasa.',
  },

  ha: {
    'ml.warning.placeholder':  'Babu samfurin da aka horar har yanzu. Muna amfani da ha\u01ADarin doka.',
    'ml.warning.baseline':     'Samfurin tushe kawai \u2014 ana buk\u0101tar \u01ADarin bayanai.',
    'ml.warning.stale':        'Nauyin samfurin ya tsufa. Ana ba da shawarar sake horar da shi.',
    'ml.baseline.detailRows':  'Ya dogara da misalai {count} har yanzu.',
  },

  tw: {
    'ml.warning.placeholder':  'Wonkyer\u025Bw modeli biara. Y\u025Bde mmara so ha\u02BDari na ma.',
    'ml.warning.baseline':     'Mfitiase modeli nko ara \u2014 yehia dataset bebree.',
    'ml.warning.stale':        'Modeli no nkyer\u025Bwde\u025B aky\u025Bn. Y\u025Br\u025Bk\u0254 mu kuratan kuratan ho ho.',
    'ml.baseline.detailRows':  'Egyina nhwehwemu {count} so seesei.',
  },

  hi: {
    'ml.warning.placeholder':  'अभी तक कोई मॉडल प्रशिक्षित नहीं। नियम-आधारित जोखिम का उपयोग।',
    'ml.warning.baseline':     'केवल बेसलाइन मॉडल — अधिक डेटा चाहिए।',
    'ml.warning.stale':        'मॉडल पुराना है। पुनः प्रशिक्षण की सिफारिश।',
    'ml.baseline.detailRows':  'अब तक {count} लेबल किए गए उदाहरणों पर आधारित।',
  },
});

export default ML_WARNING_TRANSLATIONS;
