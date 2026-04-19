/**
 * Twi translation pack (beta) — core farmer screens only.
 *
 * Scope:
 *   nav, common, actionHome, tasks, progress, support, offline,
 *   completion, time-relative, issue, cropFit warning.
 *
 * The main translations.js already ships Twi for many strings; this
 * module only supplies entries the main dictionary hasn't covered,
 * mirroring the hi.js pattern. Keys present here overwrite empty
 * `tw` slots in the main dictionary at module load time.
 *
 * Mark for review — ship these to a native speaker before promoting
 * Twi out of "beta".
 */

const TW = {
  // ─── Common ─────────────────────────────────────────
  'common.continue': 'Toa so',
  'common.ready': 'Krado',
  'common.next': 'Nea edi so',
  'common.back': 'San bra',
  'common.cancel': 'Gyae',
  'common.save': 'Kora',
  'common.saving': 'Ɛrekora...',
  'common.done': 'Awie',
  'common.loading': 'Ɛrefa aba...',
  'common.retry': 'San hwehwɛ',
  'common.yes': 'Aane',
  'common.no': 'Dabi',
  'common.logout': 'Fi mu',

  // ─── Navigation ─────────────────────────────────────
  'nav.home': 'Fie',
  'nav.myFarm': 'Afuo',
  'nav.tasks': 'Adwuma',
  'nav.progress': 'Nkɔso',

  // ─── Action-first home ──────────────────────────────
  'actionHome.primary.title': 'Nnɛ dwumadi titiriw',
  'actionHome.primary.why': 'Deɛ enti',
  'actionHome.primary.eta': 'Berɛ a ɛbɛfa',
  'actionHome.primary.minutes': 'Simma {n}',
  'actionHome.primary.markComplete': 'Fa sɛ yɛawie',
  'actionHome.primary.markingDone': 'Yɛrehwɛ...',
  'actionHome.primary.noTask': 'Adwuma biara nni hɔ',
  'actionHome.primary.noTaskHint': 'Wɔawie ne nyinaa mprempren.',
  'actionHome.secondary.title': 'Nea edi so',
  'actionHome.secondary.empty': 'Biribi nso nni hɔ.',
  'actionHome.risks.title': 'Asiane nkra',
  'actionHome.risks.none': 'Asiane biara nni hɔ.',
  'actionHome.progress.title': 'Wo nkɔso',
  'actionHome.progress.tasksDone': 'Adwuma a wɔawie',
  'actionHome.progress.cyclesActive': 'Afudeɛ adwuma',
  'actionHome.progress.seeMore': 'Hwɛ pii',
  'actionHome.stage.title': 'Afudeɛ mu berɛ',
  'actionHome.stage.none': 'Afudeɛ adwuma nni hɔ',
  'actionHome.motivation.title': 'Woreyɛ yie',
  'actionHome.motivation.body': 'Anammɔn biara ma w\'afuo mu yɛ den.',

  // Risk alert one-liners
  'actionHome.risks.overdueCount': 'Adwuma {n} a atwam',
  'actionHome.risks.overdue': 'Adwuma bi atwam',
  'actionHome.risks.inactive': 'Wontɔɔ adwuma biara wɔ berɛ tiaa',
  'actionHome.risks.highSeverityIssue': 'Wowɔ ɔhaw kɛseɛ bi a ahunahuna',
  'actionHome.risks.missedWindow': 'Ebia woatwa dua berɛ akyi',

  // Task title translations used by TITLE_KEY_MAP
  'actionHome.task.prepBed': 'Siesie mpa anaa asenaa',
  'actionHome.task.plantSeeds': 'Dua aba anaa mfifire',
  'actionHome.task.checkMoisture': 'Hwɛ asase nsuo da biara',
  'actionHome.task.thinSeedlings': 'Te mfifire a ɛyɛ pii no',
  'actionHome.task.pestScout': 'Mmoawa ho nhwehwɛmu a edi kan',
  'actionHome.task.feedMulch': 'Mema aduane na katasoɔ',
  'actionHome.task.weekWeeds': 'Yi nwura fi hɔ dapɛn biara',
  'actionHome.task.harvestPrep': 'Siesie wo ho ma otwa',

  // ─── Tasks ──────────────────────────────────────────
  'tasks.currentTask': 'Seesei',
  'tasks.nextUp': 'Nea edi so',
  'tasks.viewAll': 'Hwɛ adwuma nyinaa',
  'tasks.hideAll': 'Fa sie',
  'tasks.allCaughtUp': 'Wɔawie ne nyinaa!',
  'tasks.noMoreTasks': 'Adwuma nni hɔ mprempren',
  'tasks.backHome': 'San kɔ fie',

  // ─── Progress ───────────────────────────────────────
  'progress.title': 'Me nkɔso',
  'progress.complete': 'awie',
  'progress.remaining': 'aka',
  'progress.allDone': 'Wɔawie ne nyinaa!',
  'progress.done': 'Awie',
  'progress.pending': 'Aka ɛnnɛ',
  'progress.rate': 'Dodow',
  'progress.cropProgress': 'Nnɔbae nkɔso',

  // ─── Support ────────────────────────────────────────
  'support.title': 'Wohia mmoa?',
  'support.desc': 'Fa nkra brɛ yɛn na yɛn kuw bɛyi ano ntɛm.',
  'support.sent': 'Wɔde mmoa abisadeɛ akɔ. Yɛbɛsan wo nkyɛn ntɛm.',
  'support.failed': 'Entumi amfa abisadeɛ ankɔ',
  'support.subject': 'Asɛm tiawa',
  'support.describe': 'Ka wo ɔhaw ho nsɛm...',
  'support.sending': 'Ɛrede kɔ...',
  'support.sendRequest': 'Fa abisadeɛ kɔ',

  // ─── Farmer ID ──────────────────────────────────────
  'farmerUuid': 'Okuafoɔ ID',
  'farmerId.copy': 'Kɔpi',
  'farmerId.copied': 'Yɛakɔpi',

  // ─── Offline ────────────────────────────────────────
  'offline.showingCached': 'Wonni intanɛt — yɛrekyerɛ wo nnwuma a etwa toɔ',
  'offline.showingCachedStale': 'Yɛrekyerɛ nnwuma a ɛtwa toɔ — ebia aberɛw',
  'offline.syncOnReconnect': 'Nsesaeɛ bɛkɔ so bere a wosan ba intanɛt so',
  'offline.rightNow': 'Wonni intanɛt seesei',
  'offline.stillOffline': 'Woda so nni intanɛt',
  'offline.stillOfflineShort': 'Nni intanɛt',
  'offline.tryAgain': 'San hwehwɛ',
  'offline.retrying': 'Yɛresan hwehwɛ...',
  'offline.lastSaved': 'Nnwuma a ɛtwa toɔ',

  // ─── Completion card ────────────────────────────────
  'completion.done': 'Awie',
  'completion.continue': 'Toa so',
  'completion.later': 'Akyire',
  'completion.backToHome': 'San kɔ fie',
  'completion.nextStep': 'Anammɔn a ɛdi so',
  'completion.greatProgressToday': 'Nnɛ nkɔso pa!',
  'completion.doneForNow': 'Awie mprempren',
  'completion.oneLeft': 'Dwumadi 1 aka',
  'completion.tasksLeft': 'Adwuma {count} aka',

  // ─── Time / relative ────────────────────────────────
  'time.updated_just_now': 'Wasesa no seesei ara',
  'time.updated_minutes_ago': 'Wasesa no simma {n} a atwam',
  'time.updated_hours_ago': 'Wasesa no nnɔnhwerew {n} a atwam',
  'time.last_saved_yesterday': 'Wɔakora ɛnnora',
  'time.updated_days_ago': 'Wasesa no nna {n} a atwam',

  // ─── Issue form ─────────────────────────────────────
  'issue.title': 'Ka ɔhaw',
  'issue.category': 'Su',
  'issue.severity': 'Emu den',
  'issue.description': 'Nkyerɛmu',
  'issue.descriptionPlaceholder': 'Dɛn na asi? Ka yie.',
  'issue.submit': 'Fa bra',
  'issue.submittedAck': 'Wɔafa.',

  // ─── First-launch confirmation ─────────────────────
  'firstLaunch.title': 'Ma yɛnhyehyɛ Farroway mma wo',
  'firstLaunch.subtitle': 'Fa wo kasa, wo man, ne wo man mu si',
  'firstLaunch.language': 'Kasa',
  'firstLaunch.country': 'Ɔman',
  'firstLaunch.state': 'Ɔman mu si',
  'firstLaunch.confirm': 'Toa so',
  'firstLaunch.skip': 'Twa mu',
  'firstLaunch.detecting': 'Yɛrehwɛ...',

  // ─── Crop-fit warning ──────────────────────────────
  'cropFit.warning.lowFit': 'Saa afudeɛ yi mfa wo man ho.',
  'cropFit.warning.consider': 'Susuw wɔ yeinom ho:',
  'cropFit.warning.reason': 'Wo mu ewim tebea mfa saa afudeɛ yi ho.',
};

export default TW;
