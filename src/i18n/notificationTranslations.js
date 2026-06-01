/**
 * notificationTranslations.js — i18n overlay for the notification system.
 *
 * Shape matches the central dictionary T (`key → { locale: value }`) so the
 * mergePacks() step in index.js fills only EMPTY slots — any translator-
 * authored value in a locale column always wins.
 *
 * English is the canonical source. Other locales (tw / ha / fr / sw / hi)
 * fall back to English at render time via tSafe and are flagged for
 * translator review — we do NOT invent agricultural terms in those
 * languages. Render sites still pass an English default so a missing key
 * never leaks.
 *
 * Namespaces: notifications, dailyPlan (notification keys),
 * tasks (notification keys), weather, harvest, ngo, buyer.
 */

export const NOTIFICATION_TRANSLATION_NAMESPACES = Object.freeze([
  'notifications', 'dailyPlanNotif', 'tasksNotif', 'weatherNotif',
  'harvestNotif', 'ngoNotif', 'buyerNotif',
]);

const en = (s) => Object.freeze({ en: s });

export const NOTIFICATION_TRANSLATIONS = Object.freeze({
  // ── notifications.* (settings UI) ──────────────────────────
  'notifications.title': en('Notifications'),
  'notifications.subtitle': en('Reminders work even when the app is closed. They are optional — the app works without them.'),
  'notifications.enable': en('Enable notifications'),
  'notifications.permissionPrompt': en('Allow notifications in your browser'),
  'notifications.permissionDenied': en('Notifications are blocked in your browser. The app still works without them.'),
  'notifications.reminderTime': en('Reminder time'),
  'notifications.timezone': en('Timezone'),
  'notifications.quietHours': en('Quiet hours'),
  'notifications.quietHoursStart': en('Quiet from'),
  'notifications.quietHoursEnd': en('Quiet until'),
  'notifications.perTypeHeading': en('Types of reminders'),
  'notifications.savedToast': en('Saved.'),
  'notifications.optionalDisclaimer': en('Notifications are optional. The app works without them.'),

  // Per-type toggles (settings UI labels)
  'notifications.type.daily_farm_plan': en("Today's Farm Plan"),
  'notifications.type.task_reminder': en('Task reminders'),
  'notifications.type.follow_up_scan': en('Follow-up scans'),
  'notifications.type.weather_alert': en('Weather alerts'),
  'notifications.type.harvest_alert': en('Harvest alerts'),
  'notifications.type.post_harvest_alert': en('Post-harvest alerts'),
  'notifications.type.ngo_field_officer_alert': en('Field officer alerts'),
  'notifications.type.buyer_interest_alert': en('Buyer interest alerts'),

  // ── dailyPlanNotif.* — body templates for §3 ───────────────
  'dailyPlanNotif.title': en("Today's Farm Plan"),
  'dailyPlanNotif.bodyCount': en('You have {count} actions for today.'),
  'dailyPlanNotif.bodyOneCritical': en('High priority: {action} today.'),
  'dailyPlanNotif.gardenTitle': en("Today's Garden Plan"),

  // ── tasksNotif.* — §4 ──────────────────────────────────────
  'tasksNotif.dueToday': en('{count} tasks due today'),
  'tasksNotif.overdue': en('{count} tasks overdue'),
  'tasksNotif.critical': en('Important task waiting'),
  'tasksNotif.postHarvest': en('Post-harvest checklist is ready'),

  // ── §5 follow-up scan ──────────────────────────────────────
  'tasksNotif.followUp': en('Time for a follow-up scan.'),

  // ── weatherNotif.* — §6 ────────────────────────────────────
  'weatherNotif.heavyRain': en('Heavy rain expected — check coverage'),
  'weatherNotif.extremeHeat': en('Extreme heat — water plants today'),
  'weatherNotif.drySpell': en('Long dry spell — plan watering'),
  'weatherNotif.coldRisk': en('Cold weather risk — protect sensitive plants'),
  'weatherNotif.diseaseRisk': en('High humidity — disease risk is up'),

  // ── harvestNotif.* — §7 (approximate only) ─────────────────
  'harvestNotif.almostReady': en('Your {crop} may be ready soon (approximate).'),
  'harvestNotif.ready': en('Your {crop} appears ready to harvest (approximate).'),
  'harvestNotif.postNeeded': en('Post-harvest checklist is ready.'),
  'harvestNotif.storageRisk': en('Storage check needed soon.'),

  // ── ngoNotif.* — §8 (organization-scoped only) ─────────────
  'ngoNotif.summary': en('{count} farmers need follow-up'),
  'ngoNotif.highRisk': en('{count} high-risk farms need attention'),
  'ngoNotif.overdueIntervention': en('Overdue interventions in your program'),
  'ngoNotif.worseningOutcome': en('Worsening outcomes detected'),
  'ngoNotif.missingEvidence': en('Evidence missing on recent visits'),

  // ── buyerNotif.* — §9 (no private farmer data) ─────────────
  'buyerNotif.sellerResponded': en('A seller responded to your interest'),
  'buyerNotif.interestUpdate': en('Your buyer interest was updated'),
  'buyerNotif.listingUpdated': en('A crop listing you follow was updated'),
  'buyerNotif.harvestReady': en('A harvest-ready listing is available'),
});
