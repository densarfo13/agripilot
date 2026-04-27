/**
 * ngoControlTranslations.js — i18n overlay for the NGO Outbreak
 * Control Panel + the actionableInsights hint texts.
 *
 * Empty-slot fill via mergeManyOverlays.
 *
 * Keys:
 *   ngo.control.title / sub
 *   ngo.control.totalFarms / highRiskFarms / activeOutbreaks
 *   ngo.control.mapTitle / mapLoading / mapFallback
 *   ngo.control.alertsTitle / empty
 *   ngo.action.pestSendAgents / pestWatch
 *   ngo.action.droughtIrrigation / droughtMonitor
 *   ngo.action.farmersInactive
 *   common.crop / common.region / common.severity / common.listen /
 *   common.dismiss
 *   outbreak.unknownRegion
 */

export const NGO_CONTROL_TRANSLATIONS = Object.freeze({
  en: {
    'ngo.control.title':              'Outbreak Control Panel',
    'ngo.control.sub':                'Live view of outbreak clusters + recommended actions.',
    'ngo.control.totalFarms':         'Total farms',
    'ngo.control.highRiskFarms':      'High-risk farms',
    'ngo.control.activeOutbreaks':    'Active outbreaks',
    'ngo.control.mapTitle':           'Cluster map',
    'ngo.control.mapLoading':         'Loading map\u2026',
    'ngo.control.mapFallback':        'Map unavailable \u2014 showing list view below.',
    'ngo.control.alertsTitle':        'Alerts',
    'ngo.control.empty':              'No active outbreaks match your filters.',
    'ngo.action.pestSendAgents':      'Send field agents to inspect farms',
    'ngo.action.pestWatch':           'Watch for pest spread; advise farmer scouting',
    'ngo.action.droughtIrrigation':   'Advise irrigation or water support',
    'ngo.action.droughtMonitor':      'Monitor rainfall; remind farmers to water',
    'ngo.action.farmersInactive':     'Farmers are not checking crops; reach out',
    'common.crop':                    'Crop',
    'common.region':                  'Region',
    'common.severity':                'Severity',
    'common.listen':                  'Listen',
    'common.dismiss':                 'Dismiss',
    'outbreak.unknownRegion':         'Unknown region',
  },

  fr: {
    'ngo.control.title':              'Tableau de contr\u00F4le des foyers',
    'ngo.control.sub':                'Vue en direct des foyers + actions recommand\u00E9es.',
    'ngo.control.totalFarms':         'Total des fermes',
    'ngo.control.highRiskFarms':      'Fermes \u00E0 haut risque',
    'ngo.control.activeOutbreaks':    'Foyers actifs',
    'ngo.control.mapTitle':           'Carte des foyers',
    'ngo.control.mapLoading':         'Chargement de la carte\u2026',
    'ngo.control.mapFallback':        'Carte indisponible \u2014 vue en liste ci-dessous.',
    'ngo.control.alertsTitle':        'Alertes',
    'ngo.control.empty':              'Aucun foyer actif ne correspond \u00E0 vos filtres.',
    'ngo.action.pestSendAgents':      'Envoyez des agents de terrain inspecter les fermes',
    'ngo.action.pestWatch':           'Surveillez la propagation; conseillez la prospection',
    'ngo.action.droughtIrrigation':   'Conseillez l\u2019irrigation ou un appui en eau',
    'ngo.action.droughtMonitor':      'Surveillez la pluie; rappelez d\u2019arroser',
    'ngo.action.farmersInactive':     'Les agriculteurs ne v\u00E9rifient plus; contactez-les',
    'common.crop':                    'Culture',
    'common.region':                  'R\u00E9gion',
    'common.severity':                'S\u00E9v\u00E9rit\u00E9',
    'common.listen':                  '\u00C9couter',
    'common.dismiss':                 'Fermer',
    'outbreak.unknownRegion':         'R\u00E9gion inconnue',
  },

  hi: {
    'ngo.control.title':              'प्रकोप नियंत्रण पैनल',
    'ngo.control.sub':                'प्रकोप क्लस्टर का लाइव दृश्य + सुझावित कार्रवाई।',
    'ngo.control.totalFarms':         'कुल खेत',
    'ngo.control.highRiskFarms':      'उच्च जोखिम वाले खेत',
    'ngo.control.activeOutbreaks':    'सक्रिय प्रकोप',
    'ngo.control.mapTitle':           'क्लस्टर मानचित्र',
    'ngo.control.mapLoading':         'मानचित्र लोड हो रहा है…',
    'ngo.control.mapFallback':        'मानचित्र उपलब्ध नहीं — नीचे सूची दिखाई जा रही है।',
    'ngo.control.alertsTitle':        'अलर्ट',
    'ngo.control.empty':              'आपके फ़िल्टर से मेल खाते कोई सक्रिय प्रकोप नहीं हैं।',
    'ngo.action.pestSendAgents':      'खेत निरीक्षण के लिए फ़ील्ड एजेंट भेजें',
    'ngo.action.pestWatch':           'फैलाव पर नज़र रखें; किसानों को निगरानी की सलाह दें',
    'ngo.action.droughtIrrigation':   'सिंचाई या जल सहायता की सलाह दें',
    'ngo.action.droughtMonitor':      'बारिश पर नज़र रखें; पानी देने की याद दिलाएँ',
    'ngo.action.farmersInactive':     'किसान फसल नहीं देख रहे; संपर्क करें',
    'common.crop':                    'फसल',
    'common.region':                  'क्षेत्र',
    'common.severity':                'गंभीरता',
    'common.listen':                  'सुनें',
    'common.dismiss':                 'बंद करें',
    'outbreak.unknownRegion':         'अज्ञात क्षेत्र',
  },

  sw: {
    'ngo.control.title':              'Paneli ya Udhibiti wa Milipuko',
    'ngo.control.sub':                'Mwonekano wa wakati halisi wa milipuko + hatua zinazopendekezwa.',
    'ngo.control.totalFarms':         'Jumla ya mashamba',
    'ngo.control.highRiskFarms':      'Mashamba yenye hatari kubwa',
    'ngo.control.activeOutbreaks':    'Milipuko hai',
    'ngo.control.mapTitle':           'Ramani ya milipuko',
    'ngo.control.mapLoading':         'Inapakia ramani\u2026',
    'ngo.control.mapFallback':        'Ramani haipatikani \u2014 inaonyeshwa orodha hapa chini.',
    'ngo.control.alertsTitle':        'Tahadhari',
    'ngo.control.empty':              'Hakuna milipuko inayolingana na vichujio vyako.',
    'ngo.action.pestSendAgents':      'Tuma maafisa wa shamba kukagua mashamba',
    'ngo.action.pestWatch':           'Fuatilia kuenea; washauri wakulima kufanya ukaguzi',
    'ngo.action.droughtIrrigation':   'Pendekeza umwagiliaji au msaada wa maji',
    'ngo.action.droughtMonitor':      'Fuatilia mvua; wakumbushe wakulima kunyunyizia maji',
    'ngo.action.farmersInactive':     'Wakulima hawakagui mazao; wasiliana nao',
    'common.crop':                    'Zao',
    'common.region':                  'Kanda',
    'common.severity':                'Ukali',
    'common.listen':                  'Sikiliza',
    'common.dismiss':                 'Funga',
    'outbreak.unknownRegion':         'Kanda isiyojulikana',
  },

  ha: {
    'ngo.control.title':              'Faifan Sarrafa Barkewa',
    'ngo.control.sub':                'Hangen kai tsaye na barkewa + matakai da aka ba da shawara.',
    'ngo.control.totalFarms':         'Jimillar gonaki',
    'ngo.control.highRiskFarms':      'Gonaki masu babban ha\u0257ari',
    'ngo.control.activeOutbreaks':    'Barkewa masu aiki',
    'ngo.control.mapTitle':           'Taswirar barkewa',
    'ngo.control.mapLoading':         'Ana \u0257aukar taswira\u2026',
    'ngo.control.mapFallback':        'Taswira ba ta samuwa \u2014 ana nuna jeri a \u0257asa.',
    'ngo.control.alertsTitle':        'Fa\u0257akarwa',
    'ngo.control.empty':              'Babu barkewa mai aiki da ya dace da matatun ku.',
    'ngo.action.pestSendAgents':      'Aika wakilai don bincika gonaki',
    'ngo.action.pestWatch':           'Sa ido kan ya\u0257u; ba shawarar binciken man\u014Foma',
    'ngo.action.droughtIrrigation':   'Ba shawarar ban ruwa ko taimakon ruwa',
    'ngo.action.droughtMonitor':      'Sa ido kan ruwa; tunatar da man\u014Doma ba ruwa',
    'ngo.action.farmersInactive':     'Man\u014Doma ba sa duba shukoki; tu\u1E63a su',
    'common.crop':                    'Shuka',
    'common.region':                  'Yanki',
    'common.severity':                'Tsanani',
    'common.listen':                  'Saurara',
    'common.dismiss':                 'Rufe',
    'outbreak.unknownRegion':         'Yankin da ba a sani ba',
  },

  tw: {
    'ngo.control.title':              'Mmoawa Hwehw\u025Bmu Faifa',
    'ngo.control.sub':                'Mmoawa nhwehwemu daa hwe + akwankyer\u025B a yet\u025B b\u0254.',
    'ngo.control.totalFarms':         'Mfuw nyinaa',
    'ngo.control.highRiskFarms':      'Mfuw a w\u0254w\u0254 asiane k\u025Bse mu',
    'ngo.control.activeOutbreaks':    'Mmoawa a wɔrekɔ so',
    'ngo.control.mapTitle':           'Mmoawa kyerɛw mfonini',
    'ngo.control.mapLoading':         'Kyer\u025Bw mfonini reba\u2026',
    'ngo.control.mapFallback':        'Mfonini no nni h\u0254 \u2014 nhwehw\u025Bmu w\u0254 fam.',
    'ngo.control.alertsTitle':        'K\u0254k\u0254b\u0254',
    'ngo.control.empty':              '\u00D8 mmoawa a w\u0254ne wo dwumadie hyia ho.',
    'ngo.action.pestSendAgents':      'Soma adwumayɛfoɔ ma w\u0254nhwehw\u025B mfuw',
    'ngo.action.pestWatch':           'Hw\u025B s\u025B \u025Btr\u025Bw; ka kyer\u025B akuafo s\u025B w\u0254nhwehw\u025B',
    'ngo.action.droughtIrrigation':   'Tu fo s\u025B w\u0254ngugu nsuo',
    'ngo.action.droughtMonitor':      'Hw\u025B osuo; kae akuafo s\u025B w\u0254ngugu nsuo',
    'ngo.action.farmersInactive':     'Akuafo nhw\u025B aduane; di hwehw\u025B w\u0254n',
    'common.crop':                    'Aduane',
    'common.region':                  '\u0186man',
    'common.severity':                'Asiane k\u025Bse',
    'common.listen':                  'Tie',
    'common.dismiss':                 'To mu',
    'outbreak.unknownRegion':         '\u0186man a yenni ho ahunu',
  },
});

export default NGO_CONTROL_TRANSLATIONS;
