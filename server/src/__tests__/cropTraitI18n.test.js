/**
 * cropTraitI18n.test.js — verifies the 6 new crop-trait + fit keys
 * resolve correctly per language, and that missing locales fall
 * back to English rather than breaking the UI.
 *
 * Keys covered:
 *   fit.high / fit.medium / fit.low
 *   cropTraits.beginnerFriendly
 *   cropTraits.lowWater
 *   cropTraits.droughtTolerant
 *
 * Hausa ('ha') is intentionally absent from these entries — the
 * reviewer hasn't supplied it yet — so every `ha` lookup should
 * fall back to English without breaking.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../../../src/i18n/index.js';

const EXPECTED = {
  'fit.high': {
    en: 'High fit', hi: 'उच्च उपयुक्तता', tw: 'Ɛfata paa',
    es: 'Alta compatibilidad', pt: 'Alta compatibilidade', fr: 'Très adapté',
    ar: 'ملاءمة عالية', sw: 'Ulinganifu wa juu', id: 'Sangat cocok',
  },
  'fit.medium': {
    en: 'Medium fit', hi: 'मध्यम उपयुक्तता', tw: 'Ɛfata kakra',
    es: 'Compatibilidad media', pt: 'Compatibilidade média', fr: 'Adaptation moyenne',
    ar: 'ملاءمة متوسطة', sw: 'Ulinganifu wa kati', id: 'Cukup cocok',
  },
  'fit.low': {
    en: 'Low fit', hi: 'कम उपयुक्तता', tw: 'Ɛmfata paa',
    es: 'Baja compatibilidad', pt: 'Baixa compatibilidade', fr: 'Faible adaptation',
    ar: 'ملاءمة منخفضة', sw: 'Ulinganifu mdogo', id: 'Kurang cocok',
  },
  'cropTraits.beginnerFriendly': {
    en: 'Beginner-friendly', hi: 'शुरुआती के लिए उपयुक्त', tw: 'Ɛfata wɔn a wɔrefi ase',
    es: 'Apto para principiantes', pt: 'Bom para iniciantes', fr: 'Adapté aux débutants',
    ar: 'مناسب للمبتدئين', sw: 'Inafaa kwa wanaoanza', id: 'Cocok untuk pemula',
  },
  'cropTraits.lowWater': {
    en: 'Low water needs', hi: 'कम पानी की जरूरत', tw: 'Nsuo kakra na ehia',
    es: 'Necesita poca agua', pt: 'Precisa de pouca água', fr: 'Faible besoin en eau',
    ar: 'يحتاج ماء قليل', sw: 'Inahitaji maji kidogo', id: 'Kebutuhan air rendah',
  },
  'cropTraits.droughtTolerant': {
    en: 'Drought tolerant', hi: 'सूखा सहनशील', tw: 'Egyina ɔpɛ so',
    es: 'Resistente a la sequía', pt: 'Tolerante à seca', fr: 'Tolérant à la sécheresse',
    ar: 'يتحمل الجفاف', sw: 'Inastahimili ukame', id: 'Tahan kekeringan',
  },
  'cropTraits.fastGrowing': {
    en: 'Fast growing', hi: 'तेजी से बढ़ने वाली', tw: 'Ɛnyini ntɛm',
    es: 'Crecimiento rápido', pt: 'Crescimento rápido', fr: 'Croissance rapide',
    ar: 'سريع النمو', sw: 'Hukua haraka', id: 'Cepat tumbuh',
  },
  'cropTraits.smallFarmFriendly': {
    en: 'Good for small farms', hi: 'छोटे खेतों के लिए अच्छा', tw: 'Ɛyɛ ma afuw nketewa',
    es: 'Bueno para fincas pequeñas', pt: 'Bom para pequenas fazendas', fr: 'Bon pour les petites fermes',
    ar: 'مناسب للمزارع الصغيرة', sw: 'Nzuri kwa mashamba madogo', id: 'Cocok untuk lahan kecil',
  },
  'cropTraits.backyardFriendly': {
    en: 'Good for backyard farming', hi: 'घर या पिछवाड़े की खेती के लिए अच्छा', tw: 'Ɛfata fie afuw mu',
    es: 'Bueno para huertos caseros', pt: 'Bom para quintais', fr: 'Bon pour les jardins familiaux',
    ar: 'مناسب للزراعة المنزلية', sw: 'Nzuri kwa bustani ya nyumbani', id: 'Cocok untuk kebun rumah',
  },
  'cropTraits.commercialFriendly': {
    en: 'Good for commercial farms', hi: 'व्यावसायिक खेती के लिए अच्छा', tw: 'Ɛfata aguadifo afuw mu',
    es: 'Bueno para fincas comerciales', pt: 'Bom para fazendas comerciais', fr: 'Bon pour les fermes commerciales',
    ar: 'مناسب للمزارع التجارية', sw: 'Nzuri kwa mashamba ya kibiashara', id: 'Cocok untuk pertanian komersial',
  },
  'cropTraits.heatTolerant': {
    en: 'Heat tolerant', hi: 'गर्मी सहनशील', tw: 'Egyina ahuhuro/ɔhyew so',
    es: 'Tolera el calor', pt: 'Resistente ao calor', fr: 'Tolère la chaleur',
    ar: 'يتحمل الحرارة', sw: 'Inastahimili joto', id: 'Tahan panas',
  },
  'cropTraits.coolSeason': {
    en: 'Cool-season crop', hi: 'ठंडे मौसम की फसल', tw: 'Bere a ɛyɛ nwini mu afifideɛ',
    es: 'Cultivo de clima fresco', pt: 'Cultura de clima frio', fr: 'Culture de saison fraîche',
    ar: 'محصول موسم بارد', sw: 'Zao la msimu wa baridi', id: 'Tanaman musim sejuk',
  },
  'cropTraits.warmSeason': {
    en: 'Warm-season crop', hi: 'गर्म मौसम की फसल', tw: 'Bere a ɛyɛ hyew mu afifideɛ',
    es: 'Cultivo de clima cálido', pt: 'Cultura de clima quente', fr: 'Culture de saison chaude',
    ar: 'محصول موسم دافئ', sw: 'Zao la msimu wa joto', id: 'Tanaman musim panas',
  },
  'confidence.high': {
    en: 'High confidence', hi: 'उच्च भरोसा', tw: 'Ahotɔ kɛse',
    es: 'Alta confianza', pt: 'Alta confiança', fr: 'Confiance élevée',
    ar: 'ثقة عالية', sw: 'Uhakika wa juu', id: 'Keyakinan tinggi',
  },
  'confidence.medium': {
    en: 'Medium confidence', hi: 'मध्यम भरोसा', tw: 'Ahotɔ kakra',
    es: 'Confianza media', pt: 'Confiança média', fr: 'Confiance moyenne',
    ar: 'ثقة متوسطة', sw: 'Uhakika wa kati', id: 'Keyakinan sedang',
  },
  'confidence.low': {
    en: 'Low confidence', hi: 'कम भरोसा', tw: 'Ahotɔ sua',
    es: 'Baja confianza', pt: 'Baixa confiança', fr: 'Faible confiance',
    ar: 'ثقة منخفضة', sw: 'Uhakika mdogo', id: 'Keyakinan rendah',
  },
  'support.full': {
    en: 'Fully guided', hi: 'पूरी मार्गदर्शिका उपलब्ध', tw: 'Akwankyerɛ a edi mu',
    es: 'Guía completa', pt: 'Orientação completa', fr: 'Guidage complet',
    ar: 'إرشاد كامل', sw: 'Mwongozo kamili', id: 'Panduan lengkap',
  },
  'support.partial': {
    en: 'Partial guidance', hi: 'आंशिक मार्गदर्शन', tw: 'Akwankyerɛ kakra',
    es: 'Guía parcial', pt: 'Orientação parcial', fr: 'Guidage partiel',
    ar: 'إرشاد جزئي', sw: 'Mwongozo wa sehemu', id: 'Panduan sebagian',
  },
  'support.browse': {
    en: 'Browse only', hi: 'केवल देखें', tw: 'Hwɛ nko ara',
    es: 'Solo explorar', pt: 'Somente explorar', fr: 'Navigation seulement',
    ar: 'تصفح فقط', sw: 'Angalia tu', id: 'Lihat saja',
  },
  'recommendation.goodForRegion': {
    en: 'Good for your region', hi: 'आपके क्षेत्र के लिए उपयुक्त', tw: 'Ɛfata wo mpɔtam hɔ',
    es: 'Bueno para tu región', pt: 'Bom para sua região', fr: 'Bon pour votre région',
    ar: 'مناسب لمنطقتك', sw: 'Nzuri kwa eneo lako', id: 'Cocok untuk wilayah Anda',
  },
  'recommendation.goodForSmallFarms': {
    en: 'Good for small farms in your region', hi: 'आपके क्षेत्र के छोटे खेतों के लिए अच्छा', tw: 'Ɛyɛ ma afuw nketewa wɔ wo mpɔtam hɔ',
    es: 'Bueno para fincas pequeñas en tu región', pt: 'Bom para pequenas fazendas na sua região', fr: 'Bon pour les petites fermes de votre région',
    ar: 'مناسب للمزارع الصغيرة في منطقتك', sw: 'Nzuri kwa mashamba madogo katika eneo lako', id: 'Cocok untuk lahan kecil di wilayah Anda',
  },
  'recommendation.goodForBackyard': {
    en: 'Good for backyard growing', hi: 'घर या पिछवाड़े में उगाने के लिए अच्छा', tw: 'Ɛyɛ ma fie afuw mu',
    es: 'Bueno para cultivo en casa', pt: 'Bom para cultivo em casa', fr: 'Bon pour la culture à domicile',
    ar: 'مناسب للزراعة المنزلية', sw: 'Nzuri kwa kilimo cha nyumbani', id: 'Cocok untuk kebun rumah',
  },
  'recommendation.plantingOpen': {
    en: 'Planting window is open now', hi: 'अभी बुवाई का सही समय है', tw: 'Bere pa a wobɛdua no abue',
    es: 'La ventana de siembra está abierta', pt: 'A janela de plantio está aberta', fr: 'La fenêtre de plantation est ouverte',
    ar: 'نافذة الزراعة مفتوحة الآن', sw: 'Dirisha la kupanda liko wazi', id: 'Waktu tanam sedang terbuka',
  },
  'recommendation.beginnerReason': {
    en: 'Suitable for beginners', hi: 'शुरुआती किसानों के लिए उपयुक्त', tw: 'Ɛfata wɔn a wɔrefi ase',
    es: 'Adecuado para principiantes', pt: 'Adequado para iniciantes', fr: 'Convient aux débutants',
    ar: 'مناسب للمبتدئين', sw: 'Inafaa kwa wanaoanza', id: 'Cocok untuk pemula',
  },
  'recommendation.lowFitWarning': {
    en: 'Not recommended for your area', hi: 'आपके क्षेत्र के लिए अनुशंसित नहीं', tw: 'Yɛnkamfo nkyerɛ mma wo mpɔtam hɔ',
    es: 'No recomendado para tu zona', pt: 'Não recomendado para sua área', fr: 'Non recommandé pour votre région',
    ar: 'غير موصى به لمنطقتك', sw: 'Haipendekezwi kwa eneo lako', id: 'Tidak disarankan untuk wilayah Anda',
  },
  'recommendation.limitedSupport': {
    en: 'Guidance is limited for this crop', hi: 'इस फसल के लिए मार्गदर्शन सीमित है', tw: 'Akwankyerɛ no sua ma saa afifideɛ yi',
    es: 'La guía para este cultivo es limitada', pt: 'A orientação para esta cultura é limitada', fr: 'Le guidage pour cette culture est limité',
    ar: 'الإرشاد لهذا المحصول محدود', sw: 'Mwongozo wa zao hili ni mdogo', id: 'Panduan untuk tanaman ini terbatas',
  },
  'recommendation.experimental': {
    en: 'Experimental for your location', hi: 'आपके स्थान के लिए प्रयोगात्मक', tw: 'Wɔresɔ ahwɛ ama wo baabi',
    es: 'Experimental para tu ubicación', pt: 'Experimental para sua localização', fr: 'Expérimental pour votre localisation',
    ar: 'تجريبي لموقعك', sw: 'Ni ya majaribio kwa eneo lako', id: 'Eksperimental untuk lokasi Anda',
  },
  'status.plantNow': {
    en: 'Plant now', hi: 'अभी लगाएँ', tw: 'Dua seesei',
    es: 'Plantar ahora', pt: 'Plantar agora', fr: 'Planter maintenant',
    ar: 'ازرع الآن', sw: 'Panda sasa', id: 'Tanam sekarang',
  },
  'status.plantSoon': {
    en: 'Plant soon', hi: 'जल्द लगाएँ', tw: 'Dua ntɛm ara',
    es: 'Plantar pronto', pt: 'Plantar em breve', fr: 'Planter bientôt',
    ar: 'ازرع قريبًا', sw: 'Panda karibuni', id: 'Tanam segera',
  },
  'status.wait': {
    en: 'Wait', hi: 'रुकें', tw: 'Twɛn',
    es: 'Esperar', pt: 'Esperar', fr: 'Attendre',
    ar: 'انتظر', sw: 'Subiri', id: 'Tunggu',
  },
  'status.avoid': {
    en: 'Avoid for now', hi: 'अभी न लगाएँ', tw: 'Mma nnɛyi',
    es: 'Evitar por ahora', pt: 'Evitar por enquanto', fr: 'Éviter pour le moment',
    ar: 'تجنب الآن', sw: 'Epuka kwa sasa', id: 'Hindari dulu',
  },
};

describe('crop trait + fit keys — all 9 locales resolve correctly', () => {
  for (const [key, map] of Object.entries(EXPECTED)) {
    describe(key, () => {
      for (const [lang, expected] of Object.entries(map)) {
        it(`${lang} → ${expected}`, () => {
          expect(t(key, lang)).toBe(expected);
        });
      }
    });
  }
});

describe('Hausa fallback', () => {
  it('falls back to English for every new trait key', () => {
    for (const key of Object.keys(EXPECTED)) {
      expect(t(key, 'ha')).toBe(EXPECTED[key].en);
    }
  });
});

describe('Unknown locale fallback', () => {
  it.each(['zz', '', null, undefined])(
    'locale %p falls back to English',
    (lang) => {
      expect(t('fit.high', lang)).toBe('High fit');
      expect(t('cropTraits.beginnerFriendly', lang)).toBe('Beginner-friendly');
    },
  );
});
