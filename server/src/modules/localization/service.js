/**
 * Localization / i18n Service
 * File-backed translation maps for multi-language support.
 * Currently supports: English (en), Swahili (sw)
 * Extensible to any language by adding a new key to `translations`.
 */

const translations = {
  en: {
    // App
    'app.name': 'Farroway',
    'app.tagline': 'Institutional Credit Platform',

    // Statuses
    'status.draft': 'Draft',
    'status.submitted': 'Submitted',
    'status.under_review': 'Under Review',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.conditional_approved': 'Conditional Approval',
    'status.needs_more_evidence': 'Needs Evidence',
    'status.field_review_required': 'Field Review Required',
    'status.fraud_hold': 'Fraud Hold',
    'status.escalated': 'Escalated',
    'status.disbursed': 'Disbursed',

    // Roles
    'role.super_admin': 'Super Admin',
    'role.institutional_admin': 'Institutional Admin',
    'role.reviewer': 'Reviewer',
    'role.field_officer': 'Field Officer',
    'role.investor_viewer': 'Investor Viewer',
    'role.farmer': 'Farmer',

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
    'nav.lifecycle': 'Crop Lifecycle',
    'nav.verification_queue': 'Verification Queue',
    'nav.fraud_queue': 'Fraud Queue',
    'nav.control_center': 'Control Center',
    'nav.user_management': 'User Management',
    'nav.farmer_registrations': 'Farmer Registrations',
    'nav.market': 'Market',
    'nav.storage': 'Storage',

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

    // Lifecycle Stages
    'lifecycle.pre_planting': 'Pre-Planting',
    'lifecycle.planting': 'Planting',
    'lifecycle.vegetative': 'Vegetative Growth',
    'lifecycle.flowering': 'Flowering',
    'lifecycle.harvest': 'Harvest',
    'lifecycle.post_harvest': 'Post-Harvest',

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

    // Storage
    'storage.method.sealed_bags': 'Sealed Bags',
    'storage.method.hermetic_bag': 'Hermetic Bag',
    'storage.method.open_air': 'Open Air',
    'storage.method.warehouse': 'Warehouse',
    'storage.method.silo': 'Silo',
    'storage.method.traditional': 'Traditional',
    'storage.method.cold_storage': 'Cold Storage',
    'storage.method.other': 'Other',
    'storage.condition.good': 'Good',
    'storage.condition.fair': 'Fair',
    'storage.condition.poor': 'Poor',
    'storage.condition.deteriorating': 'Deteriorating',
    'storage.condition.unknown': 'Unknown',

    // Fraud risk levels
    'fraud.risk.low': 'Low Risk',
    'fraud.risk.medium': 'Medium Risk',
    'fraud.risk.high': 'High Risk',
    'fraud.risk.critical': 'Critical Risk',

    // Registration
    'registration.pending_approval': 'Pending Approval',
    'registration.approved': 'Approved',
    'registration.rejected': 'Rejected',
    'registration.disabled': 'Disabled',

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
    'app.name': 'Farroway',
    'app.tagline': 'Jukwaa la Mikopo ya Taasisi',

    // Statuses
    'status.draft': 'Rasimu',
    'status.submitted': 'Imewasilishwa',
    'status.under_review': 'Inakaguliwa',
    'status.approved': 'Imeidhinishwa',
    'status.rejected': 'Imekataliwa',
    'status.conditional_approved': 'Idhini ya Masharti',
    'status.needs_more_evidence': 'Inahitaji Ushahidi',
    'status.field_review_required': 'Inahitaji Ukaguzi wa Shamba',
    'status.fraud_hold': 'Imesimamishwa kwa Ulaghai',
    'status.escalated': 'Imepandishwa',
    'status.disbursed': 'Imetolewa',

    // Roles
    'role.super_admin': 'Msimamizi Mkuu',
    'role.institutional_admin': 'Msimamizi wa Taasisi',
    'role.reviewer': 'Mkaguzi',
    'role.field_officer': 'Afisa wa Shamba',
    'role.investor_viewer': 'Mtazamaji wa Uwekezaji',
    'role.farmer': 'Mkulima',

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
    'nav.lifecycle': 'Mzunguko wa Mazao',
    'nav.verification_queue': 'Foleni ya Uthibitishaji',
    'nav.fraud_queue': 'Foleni ya Ulaghai',
    'nav.control_center': 'Kituo cha Udhibiti',
    'nav.user_management': 'Usimamizi wa Watumiaji',
    'nav.farmer_registrations': 'Usajili wa Wakulima',
    'nav.market': 'Soko',
    'nav.storage': 'Hifadhi',

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

    // Lifecycle Stages
    'lifecycle.pre_planting': 'Kabla ya Kupanda',
    'lifecycle.planting': 'Kupanda',
    'lifecycle.vegetative': 'Kukua kwa Mimea',
    'lifecycle.flowering': 'Kuchanua',
    'lifecycle.harvest': 'Mavuno',
    'lifecycle.post_harvest': 'Baada ya Mavuno',

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

    // Storage
    'storage.method.sealed_bags': 'Mifuko Iliyofungwa',
    'storage.method.hermetic_bag': 'Mfuko wa Hemetiki',
    'storage.method.open_air': 'Hewani',
    'storage.method.warehouse': 'Ghala',
    'storage.method.silo': 'Silo',
    'storage.method.traditional': 'Jadi',
    'storage.method.cold_storage': 'Baridi',
    'storage.method.other': 'Nyingine',
    'storage.condition.good': 'Nzuri',
    'storage.condition.fair': 'Wastani',
    'storage.condition.poor': 'Mbaya',
    'storage.condition.deteriorating': 'Inazorota',
    'storage.condition.unknown': 'Haijulikani',

    // Fraud risk levels
    'fraud.risk.low': 'Hatari Ndogo',
    'fraud.risk.medium': 'Hatari ya Wastani',
    'fraud.risk.high': 'Hatari Kubwa',
    'fraud.risk.critical': 'Hatari Kali',

    // Registration
    'registration.pending_approval': 'Inasubiri Idhini',
    'registration.approved': 'Imeidhinishwa',
    'registration.rejected': 'Imekataliwa',
    'registration.disabled': 'Imezimwa',

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
