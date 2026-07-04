// fix-fr-visible-leaks.mjs — repair the language-mismatch leaks visible on the live
// French UI: (B) fr entries holding English placeholder values, (A) high-traffic keys
// missing from T-fr.js. One-shot; idempotent (skips keys already present with fr text).
import fs from 'node:fs';
const FILE = 'src/i18n/columns/T-fr.js';
let src = fs.readFileSync(FILE, 'utf8');

// ── Class B: English values → French ──
const REPLACE = {
  '"farmQuality.title": "Farm readiness"': '"farmQuality.title": "Préparation de la ferme"',
  '"farmQuality.subtitle": "Complete a few steps to improve your recommendations."': '"farmQuality.subtitle": "Complétez quelques étapes pour améliorer vos recommandations."',
  '"farmTimeline.title": "Farm timeline"': '"farmTimeline.title": "Historique de la ferme"',
};
for (const [from, to] of Object.entries(REPLACE)) {
  if (src.includes(from)) src = src.replace(from, to);
}

// ── Class A: missing keys → proper French ──
const ADD = {
  'home.headline.attention': "Voici ce qui demande votre attention aujourd'hui.",
  'home.checkHealth': 'Vérifiez la santé de vos cultures ou plantes',
  'farmReadiness.viewDetails': 'Voir les détails',
  'farmTimeline.viewAll': 'Tout afficher',
  'myGrow.details.title': 'Détails de ma culture',
  'briefing.greeting.morning': 'Bonjour',
  'hero.yourArea': 'Votre région',
  'farm.newFarm.defaultName': 'Ma nouvelle ferme',
  'home.status.offline': 'Hors ligne',
  'home.mode.garden': 'JARDIN',
  'home.mode.farmer': 'AGRICULTEUR',
  'home.weather.good': "Belle journée aujourd'hui",
  'home.weather.rain': 'Pluie attendue',
  'home.weather.lightRain': 'Risque de pluie',
  'home.weather.hotDry': "Chaud et sec aujourd'hui",
  'home.weather.humid': "Temps humide aujourd'hui",
  'home.weather.windy': "Temps venteux aujourd'hui",
  'home.weather.warm': 'Doux et dégagé',
  'home.hero.done.headline': "Bravo — vous êtes à jour aujourd'hui 🌱",
  'home.hero.garden.headline': "Vérifiez votre plante aujourd'hui",
  'home.hero.farmer.headline': "Inspectez votre culture aujourd'hui",
  'home.hero.done.subtext': 'Revenez demain matin',
  'home.hero.garden.subtext': "Le sol est peut-être encore humide. Vérifiez avant d'arroser.",
  'home.hero.farmer.subtext': 'Le temps sec peut affecter votre champ.',
  'home.hero.done.cta': "Terminé pour aujourd'hui ✓",
  'home.hero.garden.cta': 'Vérifier maintenant ✓',
  'home.hero.farmer.cta': 'Inspecter maintenant ✓',
  'home.hero.done.tomorrow': 'Revenez demain matin',
  'home.cta.scanPlant': 'Scanner votre plante',
  'home.cta.scanCrop': 'Scanner la culture',
  'home.chooseCrop.ariaLabel': 'Choisissez votre culture principale',
  'home.chooseCrop.title': 'Choisissez votre culture principale',
  'home.chooseCrop.body': "Les tâches et conseils s'améliorent après le choix de la culture.",
  'home.chooseCrop.cta': 'Définir la culture',
  'home.hero.emptyGarden': 'Votre jardin',
  'home.hero.emptyFarm': 'Votre ferme',
  'home.hero.tapToAddPlant': 'Touchez pour ajouter une plante',
  'home.hero.tapToAddFarm': 'Touchez pour ajouter votre ferme',
  'home.hero.gardenWatch': "Soin quotidien · vérifiez l'humidité",
  'home.hero.farmWatch': 'Tournée du champ · vérifiez les conditions',
  'home.hero.gardenSubtitle': 'Jardin actif',
  'home.hero.farmSubtitle': 'Ferme par défaut',
  'taskActions.addNote': 'Ajouter une note',
  'taskActions.markDone': 'Marquer comme fait',
  'taskActions.skip': 'Passer',
  'taskActions.scanPlant': 'Scanner la plante',
  'dailyPlan.startGrowPlan': 'Démarrez votre plan de culture',
  'dailyPlan.criticalToday': "Urgent aujourd'hui",
  'dailyPlan.recommendedWeek': 'Recommandé cette semaine',
  'dailyPlan.watchMonitor': 'À surveiller',
  'dailyPlan.nextMilestone': 'Prochaine étape clé',
  'dailyPlan.timeframeToHarvest': 'Temps approximatif avant la récolte',
  'dailyPlan.viewFullPlan': 'Voir le plan complet',
  'home.profile.emptyGarden': 'Aucune plante ajoutée',
  'home.profile.emptyFarm': 'Aucune ferme ajoutée',
  'home.profile.emptyGardenSub': 'Touchez pour ajouter une plante',
  'home.profile.emptyFarmSub': 'Touchez pour ajouter votre ferme',
  'home.profile.loading': 'Chargement…',
  'homeSwitcher.unnamedGarden': 'Mon jardin',
  'homeSwitcher.unnamedFarm': 'Ma ferme',
  'homeSwitcher.workingOn': 'En cours :',
  'homeSwitcher.farms': 'Fermes',
  'homeSwitcher.gardens': 'Jardins',
  'homeSwitcher.kind.farm': 'ferme',
  'homeSwitcher.kind.garden': 'jardin',
  'homeSwitcher.empty': "Rien à changer pour l'instant.",
  'home.next.eyebrow': 'À faire ensuite',
  'home.next.recommended': 'Recommandé',
  'hero.bestTime.beforeRain': 'Avant la pluie',
  'hero.bestTime.coolerHours': 'Heures fraîches',
  'hero.bestTime.morning': 'Ce matin',
  'hero.bestTime.midday': 'En milieu de journée',
  'hero.bestTime.afternoon': 'Cet après-midi',
  'hero.bestTime.evening': 'Ce soir',
  'hero.defaultGarden': 'Votre jardin',
};

let added = 0;
const lines = [];
for (const [k, v] of Object.entries(ADD)) {
  if (src.includes('"' + k + '"') || src.includes("'" + k + "'")) continue; // idempotent
  lines.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
  added += 1;
}
if (lines.length) {
  const idx = src.lastIndexOf('};');
  if (idx === -1) throw new Error('T-fr.js: closing brace not found');
  src = src.slice(0, idx) + '  // ── Visible-leak fix (2026-07-01): screenshot-verified Home/readiness/timeline/MyFarm keys ──\n'
    + lines.join('\n') + '\n' + src.slice(idx);
}
fs.writeFileSync(FILE, src);
console.log('[fix-fr-visible-leaks] replaced 3 English values; added ' + added + ' French keys.');
