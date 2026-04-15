/**
 * Localization / i18n Service
 * File-backed translation maps for multi-language support.
 * Supports: English (en), French (fr), Swahili (sw), Hausa (ha), Twi (tw)
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

  fr: {
    // App
    'app.name': 'Farroway',
    'app.tagline': 'Plateforme de Crédit Institutionnel',

    // Statuses
    'status.draft': 'Brouillon',
    'status.submitted': 'Soumis',
    'status.under_review': 'En cours d\'examen',
    'status.approved': 'Approuvé',
    'status.rejected': 'Rejeté',
    'status.conditional_approved': 'Approbation conditionnelle',
    'status.needs_more_evidence': 'Preuves requises',
    'status.field_review_required': 'Visite terrain requise',
    'status.fraud_hold': 'Suspicion de fraude',
    'status.escalated': 'Escaladé',
    'status.disbursed': 'Décaissé',

    // Roles
    'role.super_admin': 'Super administrateur',
    'role.institutional_admin': 'Administrateur institutionnel',
    'role.reviewer': 'Examinateur',
    'role.field_officer': 'Agent de terrain',
    'role.investor_viewer': 'Observateur investisseur',
    'role.farmer': 'Agriculteur',

    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.farmers': 'Agriculteurs',
    'nav.applications': 'Demandes',
    'nav.portfolio': 'Portefeuille',
    'nav.reports': 'Rapports',
    'nav.audit': 'Journal d\'audit',
    'nav.users': 'Gestion des utilisateurs',
    'nav.my_farm': 'Ma ferme',
    'nav.activities': 'Activités',
    'nav.reminders': 'Rappels',
    'nav.post_harvest': 'Post-récolte',
    'nav.notifications': 'Notifications',
    'nav.lifecycle': 'Cycle de culture',
    'nav.verification_queue': 'File de vérification',
    'nav.fraud_queue': 'File de fraude',
    'nav.control_center': 'Centre de contrôle',
    'nav.user_management': 'Gestion des utilisateurs',
    'nav.farmer_registrations': 'Inscriptions agriculteurs',
    'nav.market': 'Marché',
    'nav.storage': 'Stockage',

    // Activities
    'activity.planting': 'Plantation',
    'activity.spraying': 'Pulvérisation',
    'activity.fertilizing': 'Fertilisation',
    'activity.irrigation': 'Irrigation',
    'activity.weeding': 'Désherbage',
    'activity.harvesting': 'Récolte',
    'activity.storage': 'Stockage',
    'activity.selling': 'Vente',
    'activity.other': 'Autre',

    // Lifecycle Stages
    'lifecycle.pre_planting': 'Pré-plantation',
    'lifecycle.planting': 'Plantation',
    'lifecycle.vegetative': 'Croissance végétative',
    'lifecycle.flowering': 'Floraison',
    'lifecycle.harvest': 'Récolte',
    'lifecycle.post_harvest': 'Post-récolte',

    // Reminders
    'reminder.pending': 'En attente',
    'reminder.done': 'Terminé',
    'reminder.overdue': 'En retard',
    'reminder.upcoming': 'À venir',

    // Crops
    'crop.maize': 'Maïs',
    'crop.wheat': 'Blé',
    'crop.rice': 'Riz',
    'crop.coffee': 'Café',
    'crop.tea': 'Thé',
    'crop.beans': 'Haricots',
    'crop.sorghum': 'Sorgho',
    'crop.sugarcane': 'Canne à sucre',
    'crop.cashew': 'Cajou',
    'crop.cotton': 'Coton',
    'crop.sisal': 'Sisal',
    'crop.tobacco': 'Tabac',

    // Verification
    'engine.verification': 'Vérification',
    'engine.fraud': 'Analyse de fraude',
    'engine.decision': 'Décision',
    'engine.benchmark': 'Benchmarking',
    'engine.intelligence': 'Intelligence',

    // Actions
    'action.approve': 'Approuver',
    'action.reject': 'Rejeter',
    'action.escalate': 'Escalader',
    'action.reopen': 'Rouvrir',
    'action.request_evidence': 'Demander des preuves',
    'action.submit': 'Soumettre',
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.sign_out': 'Déconnexion',

    // Post-harvest
    'post_harvest.storage_guidance': 'Guide de stockage',
    'post_harvest.market_prices': 'Prix du marché',
    'post_harvest.buyer_interest': 'Intérêt des acheteurs',

    // Storage
    'storage.method.sealed_bags': 'Sacs scellés',
    'storage.method.hermetic_bag': 'Sac hermétique',
    'storage.method.open_air': 'Plein air',
    'storage.method.warehouse': 'Entrepôt',
    'storage.method.silo': 'Silo',
    'storage.method.traditional': 'Traditionnel',
    'storage.method.cold_storage': 'Stockage froid',
    'storage.method.other': 'Autre',
    'storage.condition.good': 'Bon',
    'storage.condition.fair': 'Moyen',
    'storage.condition.poor': 'Mauvais',
    'storage.condition.deteriorating': 'Se détériore',
    'storage.condition.unknown': 'Inconnu',

    // Fraud risk levels
    'fraud.risk.low': 'Risque faible',
    'fraud.risk.medium': 'Risque moyen',
    'fraud.risk.high': 'Risque élevé',
    'fraud.risk.critical': 'Risque critique',

    // Registration
    'registration.pending_approval': 'En attente d\'approbation',
    'registration.approved': 'Approuvé',
    'registration.rejected': 'Rejeté',
    'registration.disabled': 'Désactivé',

    // Common
    'common.loading': 'Chargement...',
    'common.no_data': 'Aucune donnée',
    'common.error': 'Une erreur est survenue',
    'common.success': 'Succès',
    'common.confirm': 'Êtes-vous sûr ?',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.date': 'Date',
    'common.amount': 'Montant',
    'common.status': 'Statut',
    'common.actions': 'Actions',
    'common.name': 'Nom',
    'common.email': 'Email',
    'common.phone': 'Téléphone',
    'common.region': 'Région',
  },

  ha: {
    // App
    'app.name': 'Farroway',
    'app.tagline': 'Dandamali na Bashi na Hukumomi',

    // Statuses
    'status.draft': 'Daftari',
    'status.submitted': 'An aika',
    'status.under_review': 'Ana duba',
    'status.approved': 'An amince',
    'status.rejected': 'An ƙi',
    'status.conditional_approved': 'Amincewar sharadi',
    'status.needs_more_evidence': 'Ana buƙatar shaida',
    'status.field_review_required': 'Ana buƙatar duba gona',
    'status.fraud_hold': 'An dakatar saboda zamba',
    'status.escalated': 'An ɗaukaka',
    'status.disbursed': 'An biya',

    // Roles
    'role.super_admin': 'Babban mai gudanarwa',
    'role.institutional_admin': 'Mai gudanar da hukuma',
    'role.reviewer': 'Mai dubawa',
    'role.field_officer': 'Jami\'in gona',
    'role.investor_viewer': 'Mai kallo na jarin',
    'role.farmer': 'Manomi',

    // Navigation
    'nav.dashboard': 'Allo',
    'nav.farmers': 'Manoma',
    'nav.applications': 'Buƙatoci',
    'nav.portfolio': 'Jaka',
    'nav.reports': 'Rahotanni',
    'nav.audit': 'Bincike',
    'nav.users': 'Gudanar da masu amfani',
    'nav.my_farm': 'Gona ta',
    'nav.activities': 'Ayyuka',
    'nav.reminders': 'Tunatarwa',
    'nav.post_harvest': 'Bayan girbi',
    'nav.notifications': 'Sanarwa',
    'nav.lifecycle': 'Zagayen amfanin gona',
    'nav.verification_queue': 'Jerin tabbatarwa',
    'nav.fraud_queue': 'Jerin zamba',
    'nav.control_center': 'Cibiyar sarrafawa',
    'nav.user_management': 'Gudanar da masu amfani',
    'nav.farmer_registrations': 'Rajista manoma',
    'nav.market': 'Kasuwa',
    'nav.storage': 'Ajiya',

    // Activities
    'activity.planting': 'Shuka',
    'activity.spraying': 'Fesa',
    'activity.fertilizing': 'Sa taki',
    'activity.irrigation': 'Ban ruwa',
    'activity.weeding': 'Cire ciyawa',
    'activity.harvesting': 'Girbi',
    'activity.storage': 'Ajiya',
    'activity.selling': 'Sayarwa',
    'activity.other': 'Wanin',

    // Lifecycle Stages
    'lifecycle.pre_planting': 'Kafin shuka',
    'lifecycle.planting': 'Shuka',
    'lifecycle.vegetative': 'Girma',
    'lifecycle.flowering': 'Fure',
    'lifecycle.harvest': 'Girbi',
    'lifecycle.post_harvest': 'Bayan girbi',

    // Reminders
    'reminder.pending': 'Yana jira',
    'reminder.done': 'An gama',
    'reminder.overdue': 'Ya wuce lokaci',
    'reminder.upcoming': 'Mai zuwa',

    // Crops
    'crop.maize': 'Masara',
    'crop.wheat': 'Alkama',
    'crop.rice': 'Shinkafa',
    'crop.coffee': 'Kofi',
    'crop.tea': 'Shayi',
    'crop.beans': 'Wake',
    'crop.sorghum': 'Dawa',
    'crop.sugarcane': 'Rake',
    'crop.cashew': 'Kaju',
    'crop.cotton': 'Auduga',
    'crop.sisal': 'Sisal',
    'crop.tobacco': 'Taba',

    // Verification
    'engine.verification': 'Tabbatarwa',
    'engine.fraud': 'Binciken zamba',
    'engine.decision': 'Yanke shawara',
    'engine.benchmark': 'Auna misali',
    'engine.intelligence': 'Hankali',

    // Actions
    'action.approve': 'Amince',
    'action.reject': 'Ƙi',
    'action.escalate': 'Ɗaukaka',
    'action.reopen': 'Buɗe sake',
    'action.request_evidence': 'Nema shaida',
    'action.submit': 'Aika',
    'action.save': 'Ajiye',
    'action.cancel': 'Soke',
    'action.sign_out': 'Fita',

    // Post-harvest
    'post_harvest.storage_guidance': 'Jagorar ajiya',
    'post_harvest.market_prices': 'Farashin kasuwa',
    'post_harvest.buyer_interest': 'Sha\'awar masu saye',

    // Storage
    'storage.method.sealed_bags': 'Jakunkuna rufaffun',
    'storage.method.hermetic_bag': 'Jakar hermetic',
    'storage.method.open_air': 'A sarari',
    'storage.method.warehouse': 'Rumbu',
    'storage.method.silo': 'Silo',
    'storage.method.traditional': 'Na gargajiya',
    'storage.method.cold_storage': 'Ajiyar sanyi',
    'storage.method.other': 'Wanin',
    'storage.condition.good': 'Mai kyau',
    'storage.condition.fair': 'Matsakaici',
    'storage.condition.poor': 'Mara kyau',
    'storage.condition.deteriorating': 'Yana lalacewa',
    'storage.condition.unknown': 'Ba a sani ba',

    // Fraud risk levels
    'fraud.risk.low': 'Ƙaramin haɗari',
    'fraud.risk.medium': 'Matsakaicin haɗari',
    'fraud.risk.high': 'Babban haɗari',
    'fraud.risk.critical': 'Haɗari mai tsanani',

    // Registration
    'registration.pending_approval': 'Yana jiran amincewa',
    'registration.approved': 'An amince',
    'registration.rejected': 'An ƙi',
    'registration.disabled': 'An kashe',

    // Common
    'common.loading': 'Ana lodi...',
    'common.no_data': 'Babu bayani',
    'common.error': 'Kuskure ya faru',
    'common.success': 'An yi nasara',
    'common.confirm': 'Ka tabbata?',
    'common.search': 'Bincika',
    'common.filter': 'Tace',
    'common.date': 'Kwanan wata',
    'common.amount': 'Adadi',
    'common.status': 'Matsayi',
    'common.actions': 'Ayyuka',
    'common.name': 'Suna',
    'common.email': 'Imel',
    'common.phone': 'Waya',
    'common.region': 'Yanki',
  },

  tw: {
    // App
    'app.name': 'Farroway',
    'app.tagline': 'Sika Bosea Ɔhyɛ',

    // Statuses
    'status.draft': 'Nhyehyɛe',
    'status.submitted': 'Wɔde abrɛ',
    'status.under_review': 'Wɔrehwɛ mu',
    'status.approved': 'Wɔapene so',
    'status.rejected': 'Wɔapo',
    'status.conditional_approved': 'Apene a nhyehyɛe wɔ mu',
    'status.needs_more_evidence': 'Ɛhia adansedie',
    'status.field_review_required': 'Ɛhia sɛ wɔhwɛ afuo no',
    'status.fraud_hold': 'Wɔagyina — nsisie',
    'status.escalated': 'Wɔde akɔ soro',
    'status.disbursed': 'Wɔatua',

    // Roles
    'role.super_admin': 'Ɔpanyin kɛse',
    'role.institutional_admin': 'Ɔhyɛ ɔpanyin',
    'role.reviewer': 'Ɔhwɛfo',
    'role.field_officer': 'Afuo mu dwumayɛfo',
    'role.investor_viewer': 'Ɔhwɛ sika to mu',
    'role.farmer': 'Okuafo',

    // Navigation
    'nav.dashboard': 'Allo',
    'nav.farmers': 'Akuafo',
    'nav.applications': 'Abisade',
    'nav.portfolio': 'Nneɛma',
    'nav.reports': 'Amanneɛbɔ',
    'nav.audit': 'Nhwehwɛmu',
    'nav.users': 'Nipa a wɔde di dwuma',
    'nav.my_farm': 'Me fuo',
    'nav.activities': 'Nneɛma a meyɛ',
    'nav.reminders': 'Nkaeɛ',
    'nav.post_harvest': 'Otwabere akyi',
    'nav.notifications': 'Nkra',
    'nav.lifecycle': 'Aduan nkɔso',
    'nav.verification_queue': 'Nhwɛso',
    'nav.fraud_queue': 'Nsisie nhwɛso',
    'nav.control_center': 'Ahwɛhwɛbea',
    'nav.user_management': 'Nipa a wɔde di dwuma',
    'nav.farmer_registrations': 'Akuafo din kyerɛw',
    'nav.market': 'Dwam',
    'nav.storage': 'Adekorabea',

    // Activities
    'activity.planting': 'Dua',
    'activity.spraying': 'Pete aduro',
    'activity.fertilizing': 'Gu nsɔhwɛ',
    'activity.irrigation': 'Gu nsuo',
    'activity.weeding': 'Tu wura',
    'activity.harvesting': 'Twa',
    'activity.storage': 'Sie',
    'activity.selling': 'Tɔn',
    'activity.other': 'Nea aka',

    // Lifecycle Stages
    'lifecycle.pre_planting': 'Ansa na woadua',
    'lifecycle.planting': 'Dua bere',
    'lifecycle.vegetative': 'Nyin bere',
    'lifecycle.flowering': 'Nhwiren bere',
    'lifecycle.harvest': 'Twa bere',
    'lifecycle.post_harvest': 'Twa bere akyi',

    // Reminders
    'reminder.pending': 'Ɛretwɛn',
    'reminder.done': 'Wɔawie',
    'reminder.overdue': 'Bere atwam',
    'reminder.upcoming': 'Ɛreba',

    // Crops
    'crop.maize': 'Aburow',
    'crop.wheat': 'Wheat',
    'crop.rice': 'Ɛmo',
    'crop.coffee': 'Kɔfe',
    'crop.tea': 'Tii',
    'crop.beans': 'Apataa',
    'crop.sorghum': 'Atooko',
    'crop.sugarcane': 'Ahwedeɛ',
    'crop.cashew': 'Cashew',
    'crop.cotton': 'Asaawa',
    'crop.sisal': 'Sisal',
    'crop.tobacco': 'Tawa',

    // Verification
    'engine.verification': 'Nhwɛso',
    'engine.fraud': 'Nsisie nhwehwɛmu',
    'engine.decision': 'Gyinaeɛ',
    'engine.benchmark': 'Nsusuwii',
    'engine.intelligence': 'Nimdeɛ',

    // Actions
    'action.approve': 'Pene so',
    'action.reject': 'Po',
    'action.escalate': 'De kɔ soro',
    'action.reopen': 'Bue bio',
    'action.request_evidence': 'Bisa adansedie',
    'action.submit': 'Fa brɛ',
    'action.save': 'Kora so',
    'action.cancel': 'Gyae',
    'action.sign_out': 'Fi mu',

    // Post-harvest
    'post_harvest.storage_guidance': 'Adekorabea akwankyerɛ',
    'post_harvest.market_prices': 'Dwam boto',
    'post_harvest.buyer_interest': 'Atɔfo pɛ',

    // Storage
    'storage.method.sealed_bags': 'Kotoku a wɔakata so',
    'storage.method.hermetic_bag': 'Kotoku a mframa nkɔ mu',
    'storage.method.open_air': 'Wim',
    'storage.method.warehouse': 'Adekorabea',
    'storage.method.silo': 'Silo',
    'storage.method.traditional': 'Amammere mu',
    'storage.method.cold_storage': 'Awɔw mu adekorabea',
    'storage.method.other': 'Nea aka',
    'storage.condition.good': 'Eye',
    'storage.condition.fair': 'Ɛyɛ kakra',
    'storage.condition.poor': 'Ɛnyɛ',
    'storage.condition.deteriorating': 'Ɛresɛe',
    'storage.condition.unknown': 'Yennim',

    // Fraud risk levels
    'fraud.risk.low': 'Asiane kakra',
    'fraud.risk.medium': 'Asiane a ɛda mfinimfini',
    'fraud.risk.high': 'Asiane kɛse',
    'fraud.risk.critical': 'Asiane a ɛyɛ den',

    // Registration
    'registration.pending_approval': 'Ɛretwɛn apene',
    'registration.approved': 'Wɔapene so',
    'registration.rejected': 'Wɔapo',
    'registration.disabled': 'Wɔadumm',

    // Common
    'common.loading': 'Ɛreloade...',
    'common.no_data': 'Data biara nni hɔ',
    'common.error': 'Mfomso bi aba',
    'common.success': 'Ɛkɔ yiye',
    'common.confirm': 'Wopɛ sɛ woyɛ?',
    'common.search': 'Hwehwɛ',
    'common.filter': 'Yi mu',
    'common.date': 'Da',
    'common.amount': 'Dodow',
    'common.status': 'Gyinabea',
    'common.actions': 'Nneɛma a woyɛ',
    'common.name': 'Din',
    'common.email': 'Email',
    'common.phone': 'Ahomatrofo',
    'common.region': 'Ɔman mu',
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

const LANG_NAMES = { en: 'English', fr: 'Français', sw: 'Kiswahili', ha: 'Hausa', tw: 'Twi' };

export function getSupportedLanguages() {
  return Object.keys(translations).map(code => ({
    code,
    name: LANG_NAMES[code] || code,
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
