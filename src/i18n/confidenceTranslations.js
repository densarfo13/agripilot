/**
 * confidenceTranslations.js — overlay of the new confidence-aware
 * i18n keys in every shipped locale. This file is designed to be
 * merged into the existing translations dictionary with one line:
 *
 *   import { CONFIDENCE_TRANSLATIONS } from '@/i18n/confidenceTranslations';
 *   Object.assign(existingTranslations.en, CONFIDENCE_TRANSLATIONS.en);
 *   Object.assign(existingTranslations.hi, CONFIDENCE_TRANSLATIONS.hi);
 *   // ...etc
 *
 * Or, if your translations module has a `registerOverlay()` helper:
 *   registerOverlay(CONFIDENCE_TRANSLATIONS);
 *
 * Covered keys (each × 9 locales):
 *   recommendations.header.{high|medium|low}
 *   recommendations.sub.{high|medium|low}
 *   location.confidence.{high|medium|low}
 *   listing.freshness.{high|medium|low}
 */

export const CONFIDENCE_TRANSLATIONS = Object.freeze({
  en: {
    'recommendations.header.high':   'Best crops for your area',
    'recommendations.header.medium': 'Suggested crops for your area',
    'recommendations.header.low':    'Recommendations are limited in your region',
    'recommendations.sub.high':      'Picked from crops that do well where you are',
    'recommendations.sub.medium':    'A starting shortlist — adjust to your plot',
    'recommendations.sub.low':       'We only have partial data for your region — please review carefully',
    'location.confidence.high':      'Using your detected location',
    'location.confidence.medium':    'Confirm this is your field',
    'location.confidence.low':       'We\u2019re not sure — please pick your region',
    'listing.freshness.high':        'Fresh listing',
    'listing.freshness.medium':      'Recent',
    'listing.freshness.low':         'May be out of date',
  },
  hi: {
    'recommendations.header.high':   'आपके क्षेत्र के लिए सर्वोत्तम फ़सलें',
    'recommendations.header.medium': 'आपके क्षेत्र के लिए सुझाई गई फ़सलें',
    'recommendations.header.low':    'आपके क्षेत्र में सुझाव सीमित हैं',
    'recommendations.sub.high':      'वे फ़सलें जो आपके क्षेत्र में अच्छी होती हैं',
    'recommendations.sub.medium':    'शुरुआत के लिए सूची — अपने खेत के अनुसार तय करें',
    'recommendations.sub.low':       'आपके क्षेत्र की जानकारी सीमित है — सावधानी से चुनें',
    'location.confidence.high':      'आपका पता हुआ स्थान उपयोग हो रहा है',
    'location.confidence.medium':    'पुष्टि करें कि यह आपका खेत है',
    'location.confidence.low':       'हम सुनिश्चित नहीं हैं — कृपया अपना क्षेत्र चुनें',
    'listing.freshness.high':        'नई लिस्टिंग',
    'listing.freshness.medium':      'हाल की',
    'listing.freshness.low':         'पुरानी हो सकती है',
  },
  tw: {
    'recommendations.header.high':   'Nnɔbae a ɛyɛ ma wo mpɔtam',
    'recommendations.header.medium': 'Nnɔbae a yɛde ma wo mpɔtam',
    'recommendations.header.low':    'Nnɔbae nsɛm sua wɔ wo mpɔtam',
    'recommendations.sub.high':      'Nnɔbae a ɛba yie wɔ wo mpɔtam',
    'recommendations.sub.medium':    'Nhyehyɛe a ɛyɛ mfitiase — sesa no mma wo afuw',
    'recommendations.sub.low':       'Yɛwɔ wo mpɔtam ho nsɛm kakra — hwɛ no yie',
    'location.confidence.high':      'Yɛrede wo baabi a ɛhyɛɛ din reyɛ adwuma',
    'location.confidence.medium':    'Si so dua sɛ wo afuw ni',
    'location.confidence.low':       'Yɛnnim yie — yi wo mpɔtam',
    'listing.freshness.high':        'Lisɛn foforɔ',
    'listing.freshness.medium':      'Kane',
    'listing.freshness.low':         'Ebia ɛyɛ bere tenten',
  },
  es: {
    'recommendations.header.high':   'Mejores cultivos para tu zona',
    'recommendations.header.medium': 'Cultivos sugeridos para tu zona',
    'recommendations.header.low':    'Las recomendaciones son limitadas en tu región',
    'recommendations.sub.high':      'Seleccionados entre cultivos que funcionan bien en tu zona',
    'recommendations.sub.medium':    'Una lista inicial — ajústala a tu parcela',
    'recommendations.sub.low':       'Solo tenemos datos parciales de tu región — revisa con cuidado',
    'location.confidence.high':      'Usando tu ubicación detectada',
    'location.confidence.medium':    'Confirma que es tu campo',
    'location.confidence.low':       'No estamos seguros — elige tu región',
    'listing.freshness.high':        'Publicación reciente',
    'listing.freshness.medium':      'Reciente',
    'listing.freshness.low':         'Puede estar desactualizada',
  },
  pt: {
    'recommendations.header.high':   'Melhores culturas para a sua zona',
    'recommendations.header.medium': 'Culturas sugeridas para a sua zona',
    'recommendations.header.low':    'As recomendações são limitadas na sua região',
    'recommendations.sub.high':      'Escolhidas entre culturas que dão bem onde está',
    'recommendations.sub.medium':    'Uma lista inicial — ajuste à sua parcela',
    'recommendations.sub.low':       'Só temos dados parciais da sua região — reveja com atenção',
    'location.confidence.high':      'Usando a sua localização detetada',
    'location.confidence.medium':    'Confirme que este é o seu campo',
    'location.confidence.low':       'Não temos a certeza — escolha a sua região',
    'listing.freshness.high':        'Anúncio recente',
    'listing.freshness.medium':      'Recente',
    'listing.freshness.low':         'Pode estar desatualizado',
  },
  fr: {
    'recommendations.header.high':   'Meilleures cultures pour votre zone',
    'recommendations.header.medium': 'Cultures sugérées pour votre zone',
    'recommendations.header.low':    'Les recommandations sont limitées dans votre région',
    'recommendations.sub.high':      'Choisies parmi les cultures qui réussissent chez vous',
    'recommendations.sub.medium':    'Une liste de départ — ajustez-la à votre parcelle',
    'recommendations.sub.low':       'Nous n\u2019avons que des données partielles pour votre région — vérifiez attentivement',
    'location.confidence.high':      'Utilisation de votre position détectée',
    'location.confidence.medium':    'Confirmez que c\u2019est votre champ',
    'location.confidence.low':       'Nous ne sommes pas sûrs — choisissez votre région',
    'listing.freshness.high':        'Annonce récente',
    'listing.freshness.medium':      'Récente',
    'listing.freshness.low':         'Peut être obsolète',
  },
  ar: {
    'recommendations.header.high':   'أفضل المحاصيل لمنطقتك',
    'recommendations.header.medium': 'محاصيل مقترحة لمنطقتك',
    'recommendations.header.low':    'التوصيات محدودة في منطقتك',
    'recommendations.sub.high':      'مختارة من محاصيل تنجح في منطقتك',
    'recommendations.sub.medium':    'قائمة بداية — عدّلها حسب قطعتك',
    'recommendations.sub.low':       'لدينا بيانات جزئية فقط عن منطقتك — راجع بعناية',
    'location.confidence.high':      'نستخدم موقعك المكتشف',
    'location.confidence.medium':    'أكد أن هذا حقلك',
    'location.confidence.low':       'لسنا متأكدين — اختر منطقتك',
    'listing.freshness.high':        'إعلان حديث',
    'listing.freshness.medium':      'حديث',
    'listing.freshness.low':         'قد يكون قديماً',
  },
  sw: {
    'recommendations.header.high':   'Mazao bora kwa eneo lako',
    'recommendations.header.medium': 'Mazao yanayopendekezwa kwa eneo lako',
    'recommendations.header.low':    'Mapendekezo ni machache katika eneo lako',
    'recommendations.sub.high':      'Yaliyochaguliwa kutoka mazao yanayofanya vizuri kwako',
    'recommendations.sub.medium':    'Orodha ya kuanza — irekebishe kulingana na shamba lako',
    'recommendations.sub.low':       'Tuna data ya sehemu tu ya eneo lako — kagua kwa makini',
    'location.confidence.high':      'Tunatumia eneo lako lililogunduliwa',
    'location.confidence.medium':    'Thibitisha hili ni shamba lako',
    'location.confidence.low':       'Hatuna uhakika — chagua eneo lako',
    'listing.freshness.high':        'Tangazo jipya',
    'listing.freshness.medium':      'Hivi karibuni',
    'listing.freshness.low':         'Linaweza kuwa la zamani',
  },
  id: {
    'recommendations.header.high':   'Tanaman terbaik untuk wilayah Anda',
    'recommendations.header.medium': 'Tanaman yang disarankan untuk wilayah Anda',
    'recommendations.header.low':    'Rekomendasi terbatas di wilayah Anda',
    'recommendations.sub.high':      'Dipilih dari tanaman yang tumbuh baik di tempat Anda',
    'recommendations.sub.medium':    'Daftar awal — sesuaikan dengan lahan Anda',
    'recommendations.sub.low':       'Kami hanya punya data sebagian untuk wilayah Anda — tinjau dengan hati-hati',
    'location.confidence.high':      'Menggunakan lokasi yang terdeteksi',
    'location.confidence.medium':    'Konfirmasi bahwa ini adalah lahan Anda',
    'location.confidence.low':       'Kami tidak yakin — pilih wilayah Anda',
    'listing.freshness.high':        'Tayangan baru',
    'listing.freshness.medium':      'Terbaru',
    'listing.freshness.low':         'Mungkin kedaluwarsa',
  },
});

/**
 * applyConfidenceOverlay — merge the overlay into an existing
 * `{ [locale]: { [key]: value } }` dictionary in-place. Returns
 * the same dictionary reference so the caller can chain.
 */
export function applyConfidenceOverlay(translations) {
  if (!translations || typeof translations !== 'object') return translations;
  for (const [locale, keys] of Object.entries(CONFIDENCE_TRANSLATIONS)) {
    translations[locale] = Object.assign(translations[locale] || {}, keys);
  }
  return translations;
}

export default CONFIDENCE_TRANSLATIONS;
