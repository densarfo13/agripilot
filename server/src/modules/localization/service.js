/**
 * Localization / i18n Service
 * File-backed translation maps for multi-language support.
 * Currently supports: English (en), Swahili (sw)
 * Extensible to any language by adding a new key to `translations`.
 */

const translations = {
  en: {
    // App
    'app.name': 'AgriPilot',
    'app.tagline': 'Institutional Credit Platform',

    // Statuses
    'status.draft': 'Draft',
    'status.submitted': 'Submitted',
    'status.under_review': 'Under Review',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.conditional_approved': 'Conditional Approval',
    'status.needs_more_evidence': 'Needs Evidence',
    'status.escalated': 'Escalated',
    'status.on_hold': 'On Hold',
    'status.disbursed': 'Disbursed',

    // Roles
    'role.super_admin': 'Super Admin',
    'role.institutional_admin': 'Institutional Admin',
    'role.reviewer': 'Reviewer',
    'role.field_officer': 'Field Officer',
    'role.investor_viewer': 'Investor Viewer',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.farmers': 'Farmers',
    'nav.applications': 'Applications',
    'nav.portfolio': 'Portfolio',
    'nav.reports': 'Reports',
    'nav.audit': 'Audit Trail',
    'nav.users': 'User Management',
    'nav.my_farm': 'My Farm',
    'nav.activities': 'Activities',
    'nav.reminders': 'Reminders',
    'nav.post_harvest': 'Post-Harvest',
    'nav.notifications': 'Notifications',

    // Activities
    'activity.planting': 'Planting',
    'activity.spraying': 'Spraying',
    'activity.fertilizing': 'Fertilizing',
    'activity.irrigation': 'Irrigation',
    'activity.weeding': 'Weeding',
    'activity.harvesting': 'Harvesting',
    'activity.storage': 'Storage',
    'activity.selling': 'Selling',
    'activity.other': 'Other',

    // Reminders
    'reminder.pending': 'Pending',
    'reminder.done': 'Done',
    'reminder.overdue': 'Overdue',
    'reminder.upcoming': 'Upcoming',

    // Crops
    'crop.maize': 'Maize',
    'crop.wheat': 'Wheat',
    'crop.rice': 'Rice',
    'crop.coffee': 'Coffee',
    'crop.tea': 'Tea',
    'crop.beans': 'Beans',
    'crop.sorghum': 'Sorghum',
    'crop.sugarcane': 'Sugarcane',
    'crop.cashew': 'Cashew',
    'crop.cotton': 'Cotton',
    'crop.sisal': 'Sisal',
    'crop.tobacco': 'Tobacco',

    // Verification
    'engine.verification': 'Verification',
    'engine.fraud': 'Fraud Analysis',
    'engine.decision': 'Decision',
    'engine.benchmark': 'Benchmarking',
    'engine.intelligence': 'Intelligence',

    // Actions
    'action.approve': 'Approve',
    'action.reject': 'Reject',
    'action.escalate': 'Escalate',
    'action.reopen': 'Reopen',
    'action.request_evidence': 'Request Evidence',
    'action.submit': 'Submit',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.sign_out': 'Sign Out',

    // Post-harvest
    'post_harvest.storage_guidance': 'Storage Guidance',
    'post_harvest.market_prices': 'Market Prices',
    'post_harvest.buyer_interest': 'Buyer Interest',

    // Common
    'common.loading': 'Loading...',
    'common.no_data': 'No data available',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.confirm': 'Are you sure?',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.date': 'Date',
    'common.amount': 'Amount',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.name': 'Name',
    'common.email': 'Email',
    'common.phone': 'Phone',
    'common.region': 'Region',
  },

  sw: {
    // App
    'app.name': 'AgriPilot',
    'app.tagline': 'Jukwaa la Mikopo ya Taasisi',

    // Statuses
    'status.draft': 'Rasimu',
    'status.submitted': 'Imewasilishwa',
    'status.under_review': 'Inakaguliwa',
    'status.approved': 'Imeidhinishwa',
    'status.rejected': 'Imekataliwa',
    'status.conditional_approved': 'Idhini ya Masharti',
    'status.needs_more_evidence': 'Inahitaji Ushahidi',
    'status.escalated': 'Imepandishwa',
    'status.on_hold': 'Imesimamishwa',
    'status.disbursed': 'Imetolewa',

    // Roles
    'role.super_admin': 'Msimamizi Mkuu',
    'role.institutional_admin': 'Msimamizi wa Taasisi',
    'role.reviewer': 'Mkaguzi',
    'role.field_officer': 'Afisa wa Shamba',
    'role.investor_viewer': 'Mtazamaji wa Uwekezaji',

    // Navigation
    'nav.dashboard': 'Dashibodi',
    'nav.farmers': 'Wakulima',
    'nav.applications': 'Maombi',
    'nav.portfolio': 'Kwingineko',
    'nav.reports': 'Ripoti',
    'nav.audit': 'Ukaguzi',
    'nav.users': 'Usimamizi wa Watumiaji',
    'nav.my_farm': 'Shamba Langu',
    'nav.activities': 'Shughuli',
    'nav.reminders': 'Vikumbusho',
    'nav.post_harvest': 'Baada ya Mavuno',
    'nav.notifications': 'Arifa',

    // Activities
    'activity.planting': 'Kupanda',
    'activity.spraying': 'Kunyunyizia',
    'activity.fertilizing': 'Kuweka Mbolea',
    'activity.irrigation': 'Umwagiliaji',
    'activity.weeding': 'Kupalilia',
    'activity.harvesting': 'Kuvuna',
    'activity.storage': 'Kuhifadhi',
    'activity.selling': 'Kuuza',
    'activity.other': 'Nyingine',

    // Reminders
    'reminder.pending': 'Zinazosubiri',
    'reminder.done': 'Zimekamilika',
    'reminder.overdue': 'Zimechelewa',
    'reminder.upcoming': 'Zinazokuja',

    // Crops
    'crop.maize': 'Mahindi',
    'crop.wheat': 'Ngano',
    'crop.rice': 'Mchele',
    'crop.coffee': 'Kahawa',
    'crop.tea': 'Chai',
    'crop.beans': 'Maharage',
    'crop.sorghum': 'Mtama',
    'crop.sugarcane': 'Miwa',
    'crop.cashew': 'Korosho',
    'crop.cotton': 'Pamba',
    'crop.sisal': 'Katani',
    'crop.tobacco': 'Tumbaku',

    // Verification
    'engine.verification': 'Uthibitishaji',
    'engine.fraud': 'Uchambuzi wa Ulaghai',
    'engine.decision': 'Uamuzi',
    'engine.benchmark': 'Ulinganisho',
    'engine.intelligence': 'Akili',

    // Actions
    'action.approve': 'Idhinisha',
    'action.reject': 'Kataa',
    'action.escalate': 'Pandisha',
    'action.reopen': 'Fungua Tena',
    'action.request_evidence': 'Omba Ushahidi',
    'action.submit': 'Wasilisha',
    'action.save': 'Hifadhi',
    'action.cancel': 'Ghairi',
    'action.sign_out': 'Toka',

    // Post-harvest
    'post_harvest.storage_guidance': 'Mwongozo wa Kuhifadhi',
    'post_harvest.market_prices': 'Bei za Soko',
    'post_harvest.buyer_interest': 'Maslahi ya Mnunuzi',

    // Common
    'common.loading': 'Inapakia...',
    'common.no_data': 'Hakuna data',
    'common.error': 'Hitilafu imetokea',
    'common.success': 'Imefanikiwa',
    'common.confirm': 'Una uhakika?',
    'common.search': 'Tafuta',
    'common.filter': 'Chuja',
    'common.date': 'Tarehe',
    'common.amount': 'Kiasi',
    'common.status': 'Hali',
    'common.actions': 'Vitendo',
    'common.name': 'Jina',
    'common.email': 'Barua pepe',
    'common.phone': 'Simu',
    'common.region': 'Mkoa',
  },
};

export function translate(key, lang = 'en') {
  return translations[lang]?.[key] || translations.en?.[key] || key;
}

export function translateBatch(keys, lang = 'en') {
  const result = {};
  for (const key of keys) {
    result[key] = translate(key, lang);
  }
  return result;
}

export function getTranslations(lang = 'en') {
  return translations[lang] || translations.en;
}

export function getSupportedLanguages() {
  return Object.keys(translations).map(code => ({
    code,
    name: code === 'en' ? 'English' : code === 'sw' ? 'Kiswahili' : code,
    keyCount: Object.keys(translations[code]).length,
  }));
}

export function getTranslationsByPrefix(lang = 'en', prefix = '') {
  const all = translations[lang] || translations.en;
  if (!prefix) return all;
  const result = {};
  for (const [key, val] of Object.entries(all)) {
    if (key.startsWith(prefix)) result[key] = val;
  }
  return result;
}
