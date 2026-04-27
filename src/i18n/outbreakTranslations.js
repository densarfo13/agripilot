/**
 * outbreakTranslations.js — i18n overlay for the Outbreak
 * Intelligence System v1.
 *
 * Empty-slot fill via mergeManyOverlays - translator-authored
 * values in translations.js still win.
 *
 * Keys (kept in step with the components):
 *   outbreak.reportTitle
 *   outbreak.reportButton
 *   outbreak.issuePest / outbreak.issueDisease / outbreak.issueUnknown
 *   outbreak.severityLow / .severityMedium / .severityHigh
 *   outbreak.symptomsTitle
 *   outbreak.symptomYellowLeaves / .symptomLeafHoles /
 *   outbreak.symptomWilting / .symptomSpots / .symptomInsects
 *   outbreak.notes
 *   outbreak.addPhoto
 *   outbreak.saveReport
 *   outbreak.reportSaved
 *   outbreak.nearbyRiskTitle
 *   outbreak.nearbyRiskMessage
 *   outbreak.checkCrop
 *   outbreak.watchTitle
 *   outbreak.reportCount
 *   outbreak.affectedFarms
 *   outbreak.lastReported
 *   outbreak.noClusters
 */

export const OUTBREAK_TRANSLATIONS = Object.freeze({
  en: {
    'outbreak.reportTitle':         'Report pest or disease',
    'outbreak.reportButton':        'Report pest or disease',
    'outbreak.issuePest':           'Pest',
    'outbreak.issueDisease':        'Disease',
    'outbreak.issueUnknown':        'Not sure',
    'outbreak.severityLow':         'Low',
    'outbreak.severityMedium':      'Medium',
    'outbreak.severityHigh':        'High',
    'outbreak.symptomsTitle':       'What are you seeing?',
    'outbreak.symptomYellowLeaves': 'Yellow leaves',
    'outbreak.symptomLeafHoles':    'Holes in leaves',
    'outbreak.symptomWilting':      'Wilting',
    'outbreak.symptomSpots':        'Spots',
    'outbreak.symptomInsects':      'Insects visible',
    'outbreak.notes':               'Notes (optional)',
    'outbreak.addPhoto':            'Add photo',
    'outbreak.saveReport':          'Save report',
    'outbreak.reportSaved':         'Report saved. We will warn nearby farmers if more reports appear.',
    'outbreak.nearbyRiskTitle':     'Pest risk near you',
    'outbreak.nearbyRiskMessage':   'Pest risk reported near you. Check your crop today.',
    'outbreak.checkCrop':           'Check crop',
    'outbreak.watchTitle':          'Outbreak Watch',
    'outbreak.reportCount':         'reports',
    'outbreak.affectedFarms':       'farms affected',
    'outbreak.lastReported':        'last reported',
    'outbreak.noClusters':          'No active outbreaks. Reports from farmers will appear here.',
  },

  fr: {
    'outbreak.reportTitle':         'Signaler un ravageur ou une maladie',
    'outbreak.reportButton':        'Signaler un ravageur ou une maladie',
    'outbreak.issuePest':           'Ravageur',
    'outbreak.issueDisease':        'Maladie',
    'outbreak.issueUnknown':        'Pas s\u00FBr',
    'outbreak.severityLow':         'Faible',
    'outbreak.severityMedium':      'Moyenne',
    'outbreak.severityHigh':        '\u00C9lev\u00E9e',
    'outbreak.symptomsTitle':       'Que voyez-vous ?',
    'outbreak.symptomYellowLeaves': 'Feuilles jaunes',
    'outbreak.symptomLeafHoles':    'Trous dans les feuilles',
    'outbreak.symptomWilting':      'Fl\u00E9trissement',
    'outbreak.symptomSpots':        'Taches',
    'outbreak.symptomInsects':      'Insectes visibles',
    'outbreak.notes':               'Notes (facultatif)',
    'outbreak.addPhoto':            'Ajouter une photo',
    'outbreak.saveReport':          'Enregistrer le rapport',
    'outbreak.reportSaved':         'Rapport enregistr\u00E9. Nous alerterons les voisins si d\u2019autres rapports apparaissent.',
    'outbreak.nearbyRiskTitle':     'Risque de ravageur \u00E0 proximit\u00E9',
    'outbreak.nearbyRiskMessage':   'Risque de ravageur signal\u00E9 pr\u00E8s de chez vous. V\u00E9rifiez votre culture aujourd\u2019hui.',
    'outbreak.checkCrop':           'V\u00E9rifier la culture',
    'outbreak.watchTitle':          'Surveillance des foyers',
    'outbreak.reportCount':         'rapports',
    'outbreak.affectedFarms':       'fermes concern\u00E9es',
    'outbreak.lastReported':        'dernier signalement',
    'outbreak.noClusters':          'Aucun foyer actif. Les rapports des agriculteurs appara\u00EEtront ici.',
  },

  hi: {
    'outbreak.reportTitle':         'कीट या रोग की रिपोर्ट करें',
    'outbreak.reportButton':        'कीट या रोग की रिपोर्ट करें',
    'outbreak.issuePest':           'कीट',
    'outbreak.issueDisease':        'रोग',
    'outbreak.issueUnknown':        'पता नहीं',
    'outbreak.severityLow':         'कम',
    'outbreak.severityMedium':      'मध्यम',
    'outbreak.severityHigh':        'अधिक',
    'outbreak.symptomsTitle':       'आप क्या देख रहे हैं?',
    'outbreak.symptomYellowLeaves': 'पीले पत्ते',
    'outbreak.symptomLeafHoles':    'पत्तों में छेद',
    'outbreak.symptomWilting':      'मुरझाना',
    'outbreak.symptomSpots':        'धब्बे',
    'outbreak.symptomInsects':      'कीट दिख रहे हैं',
    'outbreak.notes':               'टिप्पणियाँ (वैकल्पिक)',
    'outbreak.addPhoto':            'फ़ोटो जोड़ें',
    'outbreak.saveReport':          'रिपोर्ट सहेजें',
    'outbreak.reportSaved':         'रिपोर्ट सहेजी गई। यदि और रिपोर्ट आती हैं तो हम पास के किसानों को सूचित करेंगे।',
    'outbreak.nearbyRiskTitle':     'आपके पास कीट जोखिम',
    'outbreak.nearbyRiskMessage':   'आपके पास कीट जोखिम बताया गया है। आज अपनी फसल देखें।',
    'outbreak.checkCrop':           'फसल देखें',
    'outbreak.watchTitle':          'प्रकोप निगरानी',
    'outbreak.reportCount':         'रिपोर्ट',
    'outbreak.affectedFarms':       'खेत प्रभावित',
    'outbreak.lastReported':        'अंतिम रिपोर्ट',
    'outbreak.noClusters':          'अभी कोई प्रकोप नहीं। किसानों की रिपोर्ट यहाँ दिखेगी।',
  },

  sw: {
    'outbreak.reportTitle':         'Ripoti wadudu au ugonjwa',
    'outbreak.reportButton':        'Ripoti wadudu au ugonjwa',
    'outbreak.issuePest':           'Wadudu',
    'outbreak.issueDisease':        'Ugonjwa',
    'outbreak.issueUnknown':        'Sijui',
    'outbreak.severityLow':         'Chini',
    'outbreak.severityMedium':      'Wastani',
    'outbreak.severityHigh':        'Juu',
    'outbreak.symptomsTitle':       'Unaona nini?',
    'outbreak.symptomYellowLeaves': 'Majani ya manjano',
    'outbreak.symptomLeafHoles':    'Mashimo kwenye majani',
    'outbreak.symptomWilting':      'Kunyauka',
    'outbreak.symptomSpots':        'Madoa',
    'outbreak.symptomInsects':      'Wadudu wanaonekana',
    'outbreak.notes':               'Maelezo (hiari)',
    'outbreak.addPhoto':            'Ongeza picha',
    'outbreak.saveReport':          'Hifadhi ripoti',
    'outbreak.reportSaved':         'Ripoti imehifadhiwa. Tutawatahadharisha wakulima wa karibu ikiwa ripoti nyingi zitafika.',
    'outbreak.nearbyRiskTitle':     'Hatari ya wadudu karibu nawe',
    'outbreak.nearbyRiskMessage':   'Hatari ya wadudu imeripotiwa karibu nawe. Angalia zao lako leo.',
    'outbreak.checkCrop':           'Angalia zao',
    'outbreak.watchTitle':          'Ufuatiliaji wa milipuko',
    'outbreak.reportCount':         'ripoti',
    'outbreak.affectedFarms':       'mashamba yameathiriwa',
    'outbreak.lastReported':        'imeripotiwa mwisho',
    'outbreak.noClusters':          'Hakuna milipuko hai. Ripoti za wakulima zitaonekana hapa.',
  },

  ha: {
    'outbreak.reportTitle':         'Bayar da rahoton kwari ko cuta',
    'outbreak.reportButton':        'Bayar da rahoton kwari ko cuta',
    'outbreak.issuePest':           'Kwari',
    'outbreak.issueDisease':        'Cuta',
    'outbreak.issueUnknown':        'Ban tabbata ba',
    'outbreak.severityLow':         '\u1E62a\u0257an\u0257aici',
    'outbreak.severityMedium':      'Matsakaici',
    'outbreak.severityHigh':        'Babba',
    'outbreak.symptomsTitle':       'Me kake gani?',
    'outbreak.symptomYellowLeaves': 'Ganye masu launin rawaya',
    'outbreak.symptomLeafHoles':    'Ramuka a ganye',
    'outbreak.symptomWilting':      '\u01B6auka',
    'outbreak.symptomSpots':        'Tabo',
    'outbreak.symptomInsects':      'Ana ganin kwari',
    'outbreak.notes':               'Bayanai (na zabi)',
    'outbreak.addPhoto':            '\u01B6ara hoto',
    'outbreak.saveReport':          'Ajiye rahoto',
    'outbreak.reportSaved':         'An ajiye rahoto. Za mu sanar da man\u014Doman da ke kusa idan a ka samu \u0257an rahotanni.',
    'outbreak.nearbyRiskTitle':     'Ha\u0257arin kwari kusa da kai',
    'outbreak.nearbyRiskMessage':   'An ba da rahoton ha\u0257arin kwari kusa da kai. Duba shukarka yau.',
    'outbreak.checkCrop':           'Duba shuka',
    'outbreak.watchTitle':          'Sa ido kan barkewa',
    'outbreak.reportCount':         'rahotanni',
    'outbreak.affectedFarms':       'gonaki sun shafa',
    'outbreak.lastReported':        'rahoto na karshe',
    'outbreak.noClusters':          'Babu barkewa mai aiki. Rahotanni daga man\u014Doma za su bayyana a nan.',
  },

  tw: {
    'outbreak.reportTitle':         'B\u0254 amane\u025B kw\u0254 mmoawa anaa yare\u025B',
    'outbreak.reportButton':        'B\u0254 amane\u025B kw\u0254 mmoawa anaa yare\u025B',
    'outbreak.issuePest':           'Mmoawa',
    'outbreak.issueDisease':        'Yare\u025B',
    'outbreak.issueUnknown':        'Mennim',
    'outbreak.severityLow':         'K\u0254mma',
    'outbreak.severityMedium':      'Mfinfini',
    'outbreak.severityHigh':        '\u0190s\u0254',
    'outbreak.symptomsTitle':       'D\u025Bn na worehu?',
    'outbreak.symptomYellowLeaves': 'Nhaban a ay\u025B akok\u0254sradeb\u025B',
    'outbreak.symptomLeafHoles':    'Atokuro w\u0254 nhaban mu',
    'outbreak.symptomWilting':      'Aw\u014D',
    'outbreak.symptomSpots':        'Nkyer\u025Bnnee',
    'outbreak.symptomInsects':      'Mmoawa rehunu',
    'outbreak.notes':               'Nsenkyer\u025B (\u025Awo p\u025B a)',
    'outbreak.addPhoto':            'Fa mfonini ka ho',
    'outbreak.saveReport':          'Kora amane\u025B no',
    'outbreak.reportSaved':         'W\u0254akora amane\u025B no. S\u025B amane\u025B foforo ba a, y\u025Bb\u025Bb\u0254 akuafo a w\u0254b\u025Bn ho amane\u025B.',
    'outbreak.nearbyRiskTitle':     'Mmoawa asiane b\u025Bn wo',
    'outbreak.nearbyRiskMessage':   'W\u0254ab\u0254 mmoawa asiane ho amane\u025B b\u025Bn wo. Hw\u025B w\'aduane nn\u025B.',
    'outbreak.checkCrop':           'Hw\u025B aduane no',
    'outbreak.watchTitle':          'Mmoawa Hwehw\u025Bmu',
    'outbreak.reportCount':         'amane\u025B',
    'outbreak.affectedFarms':       'mfuw \u025Aaka',
    'outbreak.lastReported':        'amane\u025B a etwa to',
    'outbreak.noClusters':          '\u00D8 mmoawa biara nni h\u0254 nn\u025B. Akuafo amane\u025B beba ha.',
  },
});

export default OUTBREAK_TRANSLATIONS;
