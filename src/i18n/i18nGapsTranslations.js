/**
 * i18nGapsTranslations.js — overlay that fills the Hindi (and a few
 * other) gaps surfaced by farmer screenshots after the prior i18n
 * passes. Every entry below is a key that already exists in
 * translations.js for en/fr/sw/ha/tw but had no `hi` value, so the
 * base t() silently falls back to English (a known acknowledged
 * trade-off in strictT.js).
 *
 * Empty-slot fill via mergeManyOverlays — translator-authored values
 * in translations.js or earlier overlays still win.
 */

export const I18N_GAPS_TRANSLATIONS = Object.freeze({
  // English-only keys we ship for one new label that didn't exist
  // before this pass: a localizable default farm name. Used by
  // NewFarmScreen when the farmer leaves the farm-name field blank.
  en: {
    'farm.newFarm.defaultName':           'My New Farm',
  },

  hi: {
    // ── Tasks page chip (Tasks page, AllTasksPage.jsx) ─────────
    'camera.entry.tasksCta':              'समस्या है? स्कैन करें',

    // ── Urgency pill on TaskCard / AllTasksPage current-task ──
    'urgency.critical':                   'अत्यावश्यक',
    'urgency.today':                      'आज',
    'urgency.thisWeek':                   'इस हफ्ते',
    'urgency.optional':                   'वैकल्पिक',

    // ── Autopilot why / risk lines on the current-task card ───
    'why.landPrep.readySoil':             'बुवाई के लिए मिट्टी तैयार करें।',
    'risk.landPrep.delayedPlanting':      'जोखिम: मिट्टी तैयार न होने पर बुवाई में देरी।',
    'timing.beforePlantingWindow':        'बुवाई की अवधि बंद होने से पहले करें।',

    // ── Weather summary chip (FarmerTodayPage / Home) ─────────
    'wx.rainLater':                       'अभी सूखा है — आज बाद में बारिश',
    'wx.rainExpected':                    'अभी सूखा है — आज बाद में बारिश',
    'wx.rainLaterVoice':                  'अभी सूखा है, पर बाद में बारिश की संभावना। बारिश से पहले फसल को सुरक्षित करें।',
    'wx.rainExpectedVoice':               'अभी सूखा है, पर बाद में बारिश की संभावना। बारिश से पहले फसल को सुरक्षित करें।',

    // ── Weather "Updated X min ago" trust signal ──────────────
    'wx.updated.justNow':                 'अभी अपडेट किया',
    'wx.updated.1min':                    '1 मिनट पहले अपडेट किया',
    'wx.updated.mins':                    '{mins} मिनट पहले अपडेट किया',
    'wx.updated.1hour':                   '1 घंटे पहले अपडेट किया',
    'wx.updated.hours':                   '{hours} घंटे पहले अपडेट किया',

    // ── Default farm name when the farmer leaves it blank ─────
    'farm.newFarm.defaultName':           'मेरा नया खेत',

    // ── Critical-alert CTA on the home target-card (decisionEngine) ─
    // Different from `home.cta.actNow` — this one is fired by the
    // alert path (decisionEngine.js lines 106 / 131) for crops in
    // critical / weather-overridden state. Has en/fr/sw/ha/tw in
    // translations.js but no hi.
    'guided.alertCta':                    'अभी कार्रवाई करें',

    // ── Progress counter beneath the target-card / tasks list ──
    // Used by NextActionCard, BasicFarmerHome, and AllTasksPage.
    // Existing translations.js entry has en/fr/sw/ha/tw, no hi.
    'loop.progressToday':                 'आज {done}/{total} पूरे',
  },

  fr: {
    'farm.newFarm.defaultName':           'Ma nouvelle ferme',
  },

  sw: {
    'farm.newFarm.defaultName':           'Shamba langu jipya',
  },

  ha: {
    'farm.newFarm.defaultName':           'Sabuwar gonata',
  },

  tw: {
    'farm.newFarm.defaultName':           'M\u02BCafuo foforɔ',
  },
});

export default I18N_GAPS_TRANSLATIONS;
