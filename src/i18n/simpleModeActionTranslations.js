/**
 * simpleModeActionTranslations.js — i18n overlay for the action-first
 * Simple Mode UI. Same `key → { locale: value }` shape as the other
 * dictionary overlays (homeTranslations, dailyPlanTranslations, etc.);
 * empty-slot merge contract — translator-authored values always win.
 *
 * English-only base. Other locales (tw / ha / fr / sw / hi) fall back at
 * render time via tSafe and are flagged for translator review — we do NOT
 * invent agricultural copy in those languages.
 *
 * All copy here honors the §9 length rules:
 *   - actions   ≤ 12 words
 *   - reasons   ≤ 10 words
 *   - when      ≤  4 words
 *   - buttons   ≤  4 words
 *   - voice     ≤ 30 words
 */

const en = (s) => Object.freeze({ en: s });

export const SIMPLE_MODE_ACTION_NAMESPACES = Object.freeze(['simple']);

export const SIMPLE_MODE_ACTION_TRANSLATIONS = Object.freeze({
  // ── headings + eyebrows ──────────────────────────────────
  'simple.home.eyebrow': en("Today's Action"),
  'simple.home.secondaryEyebrow': en('Also today'),

  // ── labels (used on every card) ──────────────────────────
  'simple.label.doThisNow': en('Do this now'),
  'simple.label.why': en('Why'),
  'simple.label.when': en('When'),

  // ── when labels (≤ 4 words) ──────────────────────────────
  'simple.when.today': en('Today'),
  'simple.when.tomorrow': en('Tomorrow'),
  'simple.when.in_3_days': en('In 3 days'),
  'simple.when.this_week': en('This week'),
  'simple.when.overdue': en('Overdue'),

  // ── priority chips (≤ 4 words) ───────────────────────────
  'simple.priority.doNow': en('Do now'),
  'simple.priority.doSoon': en('Do soon'),
  'simple.priority.good': en('Good'),
  'simple.priority.scan': en('Scan'),

  // ── buttons (≤ 4 words) ──────────────────────────────────
  'simple.button.done': en('Done'),
  'simple.button.skip': en('Skip'),
  'simple.button.remindLater': en('Remind me'),
  'simple.button.scan': en('Scan plant'),
  'simple.button.callHelper': en('Call helper'),

  // ── voice ────────────────────────────────────────────────
  'simple.voice.play': en('Play voice'),

  // ── home empty state ─────────────────────────────────────
  'simple.home.empty.action': en('Add a plant to start your daily plan.'),
  'simple.home.empty.reason': en('You get a daily action when a plant is added.'),
  'simple.home.empty.voice': en('Add a plant today. Your daily action will start tomorrow.'),

  // ── §8 listen button ─────────────────────────────────────
  'simple.home.listen': en('Listen'),
  'simple.home.listen.aria': en('Listen to today’s action'),
  'simple.home.voice.daily': en('Today, check your plants. Tap Done after each step.'),

  // ── §7 post-harvest copy (short, low-literacy) ───────────
  'simple.post.title': en('Harvest soon'),
  'simple.post.action.pickRipe': en('Pick ripe fruits today.'),
  'simple.post.reason.fresh': en('Pick when ripe to stay fresh.'),
  'simple.post.voice.full': en('Harvest soon. Pick ripe fruits. Sort bad ones. Store in a cool place.'),
  'simple.post.step.do': en('Do this'),
  'simple.post.step.do.body': en('Pick ripe fruits.'),
  'simple.post.step.next': en('Next'),
  'simple.post.step.next.body': en('Sort bad ones.'),
  'simple.post.step.then': en('Then'),
  'simple.post.step.then.body': en('Store in a cool place.'),
  'simple.post.button.markHarvested': en('Mark Harvested'),
  'simple.post.button.createListing': en('Create Sell Listing'),
  'simple.post.button.remindMe': en('Remind Me'),

  // ── canonical sample actions (≤ 12 words each) ───────────
  'simple.action.checkPlants': en('Check on your plants today.'),
  'simple.action.checkLeaves': en('Check your tomato leaves today.'),
  'simple.action.removeBadLeaves': en('Remove sick leaves today.'),
  'simple.action.waterMaize': en('Water maize today.'),
  'simple.action.doNotWater': en('Do not water. Rain expected.'),
  'simple.action.scanPepper': en('Scan pepper plant tomorrow.'),
  'simple.action.harvestToday': en('Harvest your crop today or soon.'),
  'simple.action.sortBadFruit': en('Sort bad fruit after harvest.'),
  'simple.action.storeCool': en('Store in a cool, dry place.'),

  // ── canonical reasons (≤ 10 words) ───────────────────────
  'simple.reason.spotsSpread': en('Spots may spread.'),
  'simple.reason.soilDry': en('Soil may be dry.'),
  'simple.reason.diseaseSpread': en('Disease can spread fast.'),
  'simple.reason.followUpNeeded': en('Follow-up scan is needed.'),
  'simple.reason.harvestRipe': en('Fruits are ready to pick.'),
  'simple.reason.keepFresh': en('Keeps harvest fresh longer.'),

  // ── scan result (§3) ─────────────────────────────────────
  'simple.scan.eyebrow': en('Scan result'),
  'simple.scan.plant': en('Plant'),
  'simple.scan.plantFallback': en('Your plant'),
  'simple.scan.problem': en('Problem'),
  'simple.scan.problemFallback': en('Possible plant issue'),
  'simple.scan.doThis': en('Do this'),
  'simple.scan.doThisFallback': en('Check your plant today.'),
  'simple.scan.next': en('Next'),
  'simple.scan.nextFallback': en('Scan again in 3 days.'),
  'simple.scan.savePlant': en('Save Plant'),
  'simple.scan.createTask': en('Create Task'),
  'simple.scan.scanAgain': en('Scan Again'),

  // ── post-harvest (§6) ────────────────────────────────────
  'simple.post.title': en('Harvest today or soon.'),
  'simple.post.doThis': en('Pick ripe fruits.'),
  'simple.post.next': en('Sort bad ones.'),
  'simple.post.then': en('Store in a cool place.'),
  'simple.post.markHarvested': en('Mark harvested'),
  'simple.post.createListing': en('Create sell listing'),

  // ── settings toggle (action-first variant) ───────────────
  'simple.settings.label': en('Simple Mode'),
  'simple.settings.help': en('Big actions, short words. Voice-friendly.'),
});
