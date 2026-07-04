/**
 * agricultureGlossary — canonical agricultural terms per locale (P2). The single
 * reference translators and batch scripts consult so core terms stay consistent
 * across every screen ("shamba" never becomes "konde" on one page). Data-only today;
 * automated glossary-drift checking is a documented follow-up in the farmer gate.
 */
export const AGRICULTURE_GLOSSARY: Record<string, Record<string, string>> = Object.freeze({
  farm:        { en: 'Farm', fr: 'Ferme', sw: 'Shamba', ha: 'Gona', tw: 'Afuo', hi: 'खेत' },
  farmer:      { en: 'Farmer', fr: 'Agriculteur', sw: 'Mkulima', ha: 'Manomi', tw: 'Okuafo', hi: 'किसान' },
  crop:        { en: 'Crop', fr: 'Culture', sw: 'Zao', ha: 'Amfanin gona', tw: 'Nnɔbae', hi: 'फ़सल' },
  plant:       { en: 'Plant', fr: 'Plante', sw: 'Mmea', ha: 'Shuka', tw: 'Afifide', hi: 'पौधा' },
  flower:      { en: 'Flower', fr: 'Fleur', sw: 'Ua', ha: 'Fure', tw: 'Nhwiren', hi: 'फूल' },
  fruit:       { en: 'Fruit', fr: 'Fruit', sw: 'Tunda', ha: "Ya'yan itace", tw: 'Aduaba', hi: 'फल' },
  vegetable:   { en: 'Vegetable', fr: 'Légume', sw: 'Mboga', ha: 'Kayan lambu', tw: 'Atosode', hi: 'सब्ज़ी' },
  weed:        { en: 'Weed', fr: 'Mauvaise herbe', sw: 'Gugu', ha: 'Ciyawa', tw: 'Nwura', hi: 'खरपतवार' },
  tree:        { en: 'Tree', fr: 'Arbre', sw: 'Mti', ha: 'Bishiya', tw: 'Dua', hi: 'पेड़' },
  garden:      { en: 'Garden', fr: 'Jardin', sw: 'Bustani', ha: 'Lambu', tw: 'Turo', hi: 'बग़ीचा' },
  harvest:     { en: 'Harvest', fr: 'Récolte', sw: 'Mavuno', ha: 'Girbi', tw: 'Otwabere', hi: 'फ़सल कटाई' },
  disease:     { en: 'Disease', fr: 'Maladie', sw: 'Ugonjwa', ha: 'Cuta', tw: 'Yare', hi: 'रोग' },
  pest:        { en: 'Pest', fr: 'Ravageur', sw: 'Mdudu waharibifu', ha: 'Kwaro', tw: 'Mmoawa', hi: 'कीट' },
  soil:        { en: 'Soil', fr: 'Sol', sw: 'Udongo', ha: 'Kasa', tw: 'Dɔte', hi: 'मिट्टी' },
  water:       { en: 'Water', fr: 'Eau', sw: 'Maji', ha: 'Ruwa', tw: 'Nsu', hi: 'पानी' },
  irrigation:  { en: 'Irrigation', fr: 'Irrigation', sw: 'Umwagiliaji', ha: 'Ban ruwa', tw: 'Nsugugu', hi: 'सिंचाई' },
  fertilizer:  { en: 'Fertilizer', fr: 'Engrais', sw: 'Mbolea', ha: 'Taki', tw: 'Nnɔbae aduru', hi: 'उर्वरक' },
  market:      { en: 'Market', fr: 'Marché', sw: 'Soko', ha: 'Kasuwa', tw: 'Gua', hi: 'बाज़ार' },
  buyer:       { en: 'Buyer', fr: 'Acheteur', sw: 'Mnunuzi', ha: 'Mai siye', tw: 'Otɔfo', hi: 'ख़रीदार' },
  sell:        { en: 'Sell', fr: 'Vendre', sw: 'Uza', ha: 'Sayar', tw: 'Tɔn', hi: 'बेचें' },
  funding:     { en: 'Funding', fr: 'Financement', sw: 'Ufadhili', ha: 'Tallafi', tw: 'Sika', hi: 'वित्त सहायता' },
  insurance:   { en: 'Insurance', fr: 'Assurance', sw: 'Bima', ha: 'Inshora', tw: 'Insurance', hi: 'बीमा' },
  loan:        { en: 'Loan', fr: 'Prêt', sw: 'Mkopo', ha: 'Lamuni', tw: 'Bosea', hi: 'ऋण' },
  task:        { en: 'Task', fr: 'Tâche', sw: 'Kazi', ha: 'Aiki', tw: 'Adwuma', hi: 'कार्य' },
  scan:        { en: 'Scan', fr: 'Scanner', sw: 'Scan', ha: 'Scan', tw: 'Scan', hi: 'स्कैन' },
  recommendation: { en: 'Recommendation', fr: 'Recommandation', sw: 'Pendekezo', ha: 'Shawara', tw: 'Afotu', hi: 'सुझाव' },
  confidence:  { en: 'Confidence', fr: 'Confiance', sw: 'Uhakika', ha: 'Tabbaci', tw: 'Ahotoso', hi: 'विश्वास स्तर' },
  risk:        { en: 'Risk', fr: 'Risque', sw: 'Hatari', ha: 'Hadari', tw: 'Asiane', hi: 'जोखिम' },
});
export default AGRICULTURE_GLOSSARY;
