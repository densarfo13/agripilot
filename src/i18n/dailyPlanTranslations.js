/**
 * dailyPlanTranslations.js — i18n overlay for the Daily Farm Plan system.
 *
 * Shape matches the central dictionary T (`key → { locale: value }`) so the
 * mergePacks() step in index.js fills only EMPTY slots — any translator-
 * authored value in a locale column always wins.
 *
 * English is the canonical source. Other locales (tw/ha/fr/sw/hi) fall back to
 * English and are flagged for translator review — we do NOT invent agronomy
 * terms in those languages. Render sites still pass an English default to
 * tSafe so a missing key never leaks.
 *
 * Namespaces: dailyPlan, lifecycle, postHarvest, taskActions, gardenCare.
 */

export const DAILY_PLAN_TRANSLATION_NAMESPACES = Object.freeze([
  'dailyPlan', 'lifecycle', 'postHarvest', 'taskActions', 'gardenCare',
]);

/** Disclaimer carried by all daily-plan guidance. */
export const DAILY_PLAN_DISCLAIMER = 'Decision support, not a guarantee.';

const en = (s) => Object.freeze({ en: s });

export const DAILY_PLAN_TRANSLATIONS = Object.freeze({
  // ── dailyPlan ──────────────────────────────────────────────
  'dailyPlan.title': en("Today's Farm Plan"),
  'dailyPlan.titleGarden': en("Today's Garden Plan"),
  'dailyPlan.topPriority': en('Top priority'),
  'dailyPlan.startGrowPlan': en('Start your grow plan'),
  'dailyPlan.whatGrowing': en('What are you growing?'),
  'dailyPlan.whenPlant': en('When did or will you plant?'),
  'dailyPlan.size': en('Farm or garden size'),
  'dailyPlan.goal': en('Your goal'),
  'dailyPlan.criticalToday': en('Critical today'),
  'dailyPlan.recommendedWeek': en('Recommended this week'),
  'dailyPlan.watchMonitor': en('Watch / monitor'),
  'dailyPlan.upcomingHarvest': en('Upcoming harvest'),
  'dailyPlan.nextMilestone': en('Next milestone'),
  'dailyPlan.timeframeToHarvest': en('Approximate time to harvest'),
  'dailyPlan.notEnoughData': en('Not enough data yet — general guidance shown.'),
  'dailyPlan.viewFullPlan': en('View full plan'),
  'dailyPlan.scanReminder': en('Scan a plant to keep your plan up to date.'),

  // ── lifecycle (12 stages) ──────────────────────────────────
  'lifecycle.pre_planting': en('Preparing to plant'),
  'lifecycle.planting': en('Planting'),
  'lifecycle.germination': en('Germination'),
  'lifecycle.seedling': en('Seedling'),
  'lifecycle.vegetative': en('Growing (vegetative)'),
  'lifecycle.flowering': en('Flowering'),
  'lifecycle.fruiting': en('Fruiting'),
  'lifecycle.maturity': en('Maturing'),
  'lifecycle.harvest_ready': en('Ready to harvest'),
  'lifecycle.post_harvest': en('After harvest'),
  'lifecycle.storage': en('Storage'),
  'lifecycle.selling_ready': en('Ready to sell'),

  // ── postHarvest ────────────────────────────────────────────
  'postHarvest.checklist': en('Harvest checklist'),
  'postHarvest.sortGrade': en('Sort and grade your harvest'),
  'postHarvest.dryCure': en('Dry or cure if your crop needs it'),
  'postHarvest.storage': en('Store in a cool, dry, clean place'),
  'postHarvest.spoilage': en('Watch for spoilage'),
  'postHarvest.sellReady': en('Check selling readiness'),

  // ── taskActions ────────────────────────────────────────────
  'taskActions.markDone': en('Mark done'),
  'taskActions.skip': en('Skip'),
  'taskActions.addNote': en('Add note'),
  'taskActions.scanPlant': en('Scan plant'),
  'taskActions.followUpScan': en('Take a follow-up scan in a few days'),
  'taskActions.inspectLeaves': en('Check the underside of the leaves'),
  'taskActions.checkSoilMoisture': en('Check soil and watering'),
  'taskActions.continueCare': en('Continue your normal care routine'),

  // ── gardenCare (gardener wording — never farm-only) ────────
  'gardenCare.watering': en('Watering'),
  'gardenCare.pruning': en('Pruning'),
  'gardenCare.sunlight': en('Sunlight'),
  'gardenCare.soilMoisture': en('Soil moisture'),
  'gardenCare.repotting': en('Repotting'),
  'gardenCare.pestMonitoring': en('Pest monitoring'),
  'gardenCare.deadheading': en('Deadhead spent flowers'),
  'gardenCare.containerDrainage': en('Check container drainage'),
});
