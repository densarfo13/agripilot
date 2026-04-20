/**
 * completionTranslations.js — overlay for the §6 completion
 * bridge (title/encouragement/next). Covers every key
 * buildCompletionBridge can emit so the UI never falls back
 * to English in a non-English locale.
 *
 * English + Hindi + French full coverage; sw/tw/ha carry a
 * core subset and fall back to English for the long tail.
 */

export const COMPLETION_TRANSLATIONS = Object.freeze({
  en: {
    'completion.title.all_done_for_now':         'All done for now',
    'completion.encouragement.great_work':       'Great work!',
    'completion.encouragement.back_on_track':    'Welcome back — let\u2019s get rolling',
    'completion.encouragement.harvest_done':     'Harvest complete — a big milestone',
    'completion.next.check_tomorrow':            'Next: check tomorrow\u2019s task',
    'completion.next.prepare_next_cycle':        'Next: prepare for the next cycle',
    'completion.next.post_harvest_steps':        'Next: dry and store your harvest',
    'completion.next.monitor_germination':       'Next: watch for seedlings coming up',
    'completion.next.watch_pests':               'Next: scout for pests and disease',
    'completion.next.ensure_pollination':        'Next: help pollination along',
    'completion.next.plan_harvest':              'Next: plan your harvest window',
    'completion.next.thin_seedlings':            'Next: thin weak seedlings',
    'completion.next.start_planting_soon':       'Next: get ready to plant',
    'completion.next.complete_plan':             'Next: finish your plan',
  },

  hi: {
    'completion.title.all_done_for_now':         'अभी के लिए सब पूरा',
    'completion.encouragement.great_work':       'बहुत बढ़िया काम!',
    'completion.encouragement.back_on_track':    'फिर से स्वागत है — आइए शुरू करें',
    'completion.encouragement.harvest_done':     'कटाई पूरी — बड़ी उपलब्धि',
    'completion.next.check_tomorrow':            'अगला: कल का कार्य देखें',
    'completion.next.prepare_next_cycle':        'अगला: अगले चक्र की तैयारी करें',
    'completion.next.post_harvest_steps':        'अगला: फसल सुखाएँ और भंडारण करें',
    'completion.next.monitor_germination':       'अगला: अंकुरण पर ध्यान दें',
    'completion.next.watch_pests':               'अगला: कीट और रोग की जाँच करें',
    'completion.next.ensure_pollination':        'अगला: परागण में मदद करें',
    'completion.next.plan_harvest':              'अगला: कटाई की योजना बनाएँ',
    'completion.next.thin_seedlings':            'अगला: कमज़ोर पौधे हटाएँ',
    'completion.next.start_planting_soon':       'अगला: बुवाई की तैयारी करें',
    'completion.next.complete_plan':             'अगला: अपनी योजना पूरी करें',
  },

  fr: {
    'completion.title.all_done_for_now':         'Tout est fait pour l\u2019instant',
    'completion.encouragement.great_work':       'Excellent travail !',
    'completion.encouragement.back_on_track':    'Content de vous revoir — on y retourne',
    'completion.encouragement.harvest_done':     'Récolte terminée — un beau moment',
    'completion.next.check_tomorrow':            'Ensuite : consultez la tâche de demain',
    'completion.next.prepare_next_cycle':        'Ensuite : préparez le prochain cycle',
    'completion.next.post_harvest_steps':        'Ensuite : séchez et stockez votre récolte',
    'completion.next.monitor_germination':       'Ensuite : surveillez la levée des semis',
    'completion.next.watch_pests':               'Ensuite : inspectez les nuisibles et maladies',
    'completion.next.ensure_pollination':        'Ensuite : aidez à la pollinisation',
    'completion.next.plan_harvest':              'Ensuite : planifiez la récolte',
    'completion.next.thin_seedlings':            'Ensuite : éclaircissez les plants faibles',
    'completion.next.start_planting_soon':       'Ensuite : préparez les semis',
    'completion.next.complete_plan':             'Ensuite : terminez votre plan',
  },

  sw: {
    'completion.title.all_done_for_now':         'Yote yamekamilika kwa sasa',
    'completion.encouragement.great_work':       'Kazi nzuri!',
    'completion.next.check_tomorrow':            'Inayofuata: angalia kazi ya kesho',
  },

  tw: {
    'completion.title.all_done_for_now':         'Ɛnnɛ deɛ wo ayɛ awie',
    'completion.encouragement.great_work':       'Adwuma paa!',
    'completion.next.check_tomorrow':            'Nea ɛdi hɔ: hwɛ ɔkyena adwuma',
  },

  ha: {
    'completion.title.all_done_for_now':         'An gama komai a yanzu',
    'completion.encouragement.great_work':       'Aikin nagari!',
    'completion.next.check_tomorrow':            'Na gaba: duba aikin gobe',
  },
});

export default COMPLETION_TRANSLATIONS;
