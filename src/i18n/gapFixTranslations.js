/**
 * gapFixTranslations.js — translation overlay for the keys added in
 * the gap-fix pass (spec §1-§13). Full English + French; starter
 * subset for sw/ha/tw so the atomic fallback has English to land on
 * when a language hasn't been filled in yet.
 *
 * Keys added:
 *   progress.explain.*      — progress card explanation lines (§5)
 *   today.done.nextAction   — DoneStateCard CTA (§2)
 *   today.done.reviewProgress
 *   loop.did_this_help      — outcome-loop prompt (§7)
 *   loop.outcome.yes / no / not_sure
 *   alert.priority.*        — pill labels for the top alert picker
 */

export const GAP_FIX_TRANSLATIONS = Object.freeze({
  en: {
    // ── Progress explanation (gap-fix §5) ───────────────────────
    'progress.explain.ontrack_early':
      'You are in the early stage of this crop. Complete today\u2019s tasks to stay on track.',
    'progress.explain.ontrack_mid':
      'Your crop is growing well. Keep up today\u2019s checks to stay on track.',
    'progress.explain.ontrack_late':
      'You\u2019re close to harvest. Small daily checks protect the yield.',
    'progress.explain.ontrack_done':
      'You finished today\u2019s tasks. Check tomorrow\u2019s preview or review your progress.',
    'progress.explain.ontrack_default':
      'You are on track. Complete today\u2019s tasks to keep the score steady.',
    'progress.explain.slight_delay':
      'You are close to on-track. Finish today\u2019s tasks to catch up.',
    'progress.explain.highrisk_early':
      'Your crop is just getting started. Complete today\u2019s tasks to get back on track.',
    'progress.explain.highrisk_mid':
      'You have some overdue work. A few tasks today will move the score back up.',
    'progress.explain.highrisk_late':
      'Harvest stage needs attention. Finish today\u2019s checks to protect your yield.',

    // ── DoneStateCard CTAs (gap-fix §2) ─────────────────────────
    'today.done.nextAction':    'Check tomorrow\u2019s preview',
    'today.done.reviewProgress':'Review progress',

    // ── Outcome loop (gap-fix §7) ───────────────────────────────
    'loop.did_this_help':      'Did this help?',
    'loop.outcome.yes':        'Yes',
    'loop.outcome.no':         'No',
    'loop.outcome.not_sure':   'Not sure',
    'loop.outcome.thanks':     'Thanks — we\u2019ll use that to improve the advice.',

    // ── Alert priority pills (gap-fix §10) ──────────────────────
    'alert.priority.critical': 'Important',
    'alert.priority.weather':  'Weather',
    'alert.priority.reminder': 'Reminder',
  },

  fr: {
    'progress.explain.ontrack_early':
      'Votre culture est au d\u00E9but. Terminez les t\u00E2ches du jour pour rester sur la bonne voie.',
    'progress.explain.ontrack_mid':
      'Votre culture pousse bien. Continuez les v\u00E9rifications pour rester sur la bonne voie.',
    'progress.explain.ontrack_late':
      'Vous approchez de la r\u00E9colte. Les petites v\u00E9rifications prot\u00E8gent le rendement.',
    'progress.explain.ontrack_done':
      'Vous avez termin\u00E9 aujourd\u2019hui. Regardez l\u2019aper\u00E7u de demain ou revoyez vos progr\u00E8s.',
    'progress.explain.ontrack_default':
      'Vous \u00EAtes sur la bonne voie. Terminez les t\u00E2ches du jour pour garder le score stable.',
    'progress.explain.slight_delay':
      'Vous \u00EAtes presque \u00E0 jour. Terminez les t\u00E2ches du jour pour rattraper.',
    'progress.explain.highrisk_early':
      'Votre culture commence \u00E0 peine. Terminez les t\u00E2ches pour revenir sur la bonne voie.',
    'progress.explain.highrisk_mid':
      'Vous avez du retard. Quelques t\u00E2ches aujourd\u2019hui feront remonter le score.',
    'progress.explain.highrisk_late':
      'La r\u00E9colte demande de l\u2019attention. Terminez les v\u00E9rifications pour prot\u00E9ger votre rendement.',
    'today.done.nextAction':    'Voir l\u2019aper\u00E7u de demain',
    'today.done.reviewProgress':'Voir les progr\u00E8s',
    'loop.did_this_help':      'Cela vous a aid\u00E9\u00A0?',
    'loop.outcome.yes':        'Oui',
    'loop.outcome.no':         'Non',
    'loop.outcome.not_sure':   'Pas s\u00FBr',
    'loop.outcome.thanks':     'Merci \u2014 nous utiliserons ceci pour am\u00E9liorer les conseils.',
    'alert.priority.critical': 'Important',
    'alert.priority.weather':  'M\u00E9t\u00E9o',
    'alert.priority.reminder': 'Rappel',
  },

  sw: {
    'loop.did_this_help':      'Hii ilisaidia?',
    'loop.outcome.yes':        'Ndiyo',
    'loop.outcome.no':         'Hapana',
    'loop.outcome.not_sure':   'Sijui',
    'today.done.nextAction':   'Angalia kesho',
    'today.done.reviewProgress':'Angalia maendeleo',
  },

  ha: {
    'loop.did_this_help':      'Wannan ya taimaka?',
    'loop.outcome.yes':        'Ee',
    'loop.outcome.no':         'A\u02BCa',
    'loop.outcome.not_sure':   'Ban tabbata ba',
    'today.done.nextAction':   'Duba gobe',
    'today.done.reviewProgress':'Duba cigaba',
  },

  tw: {
    'loop.did_this_help':      'Eyi boaa?',
    'loop.outcome.yes':        'Aane',
    'loop.outcome.no':         'Dabi',
    'loop.outcome.not_sure':   'Mennim',
    'today.done.nextAction':   'Hw\u025B \u0254kyena',
    'today.done.reviewProgress':'San hw\u025B w\u2019anim nk\u0254so',
  },
});

export default GAP_FIX_TRANSLATIONS;
