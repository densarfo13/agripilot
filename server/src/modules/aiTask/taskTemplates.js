/**
 * aiTask/taskTemplates.js — localized rule templates for the
 * AI Task Engine v1.
 *
 *   import { TASK_TEMPLATES } from './taskTemplates.js';
 *
 * Each template exposes both farmer + backyard variants per the
 * spec's strict no-mixing rule. Every text field carries all 6
 * launch languages (en / fr / sw / ha / tw / hi); the engine's
 * `tr(field)` falls back to English when a locale is absent so
 * the response always has a non-empty string.
 *
 * Template shape
 *   {
 *     <ruleId>: {
 *       <userType>: {
 *         title:           { en, fr, sw, ha, tw, hi },
 *         reason:          { … },
 *         safetyNote:      { … } | null,
 *         completionPrompt:{ … },
 *         nextRecommended: { … },
 *         urgency:         'low' | 'medium' | 'high',
 *         estimatedTime:   '<n> min',
 *       },
 *     },
 *   }
 *
 * Strict-rule audit
 *   • Farmer wording centres on yield / income / harvest /
 *     pest prevention / sell-readiness (spec rule §1).
 *   • Backyard wording centres on home growing / plant health /
 *     watering / scanning / harvesting for home use (spec
 *     rule §2). Never mention yield or sell.
 *   • Every line under 80 chars so it fits a phone screen on
 *     low-density displays.
 *   • Pure data — no I/O, no mutation.
 */

// Final-polish spec §4 — CTA-by-action map. Every rule below
// carries a `ctaLabel` field that matches the action's verb.
// Wording rules:
//   • Imperative voice ("Check now", "Log cost", "Scan now")
//   • Trailing "✓" reinforces the daily-loop completion vibe
//   • Both farmer + backyard variants get tailored wording when
//     the verb differs (e.g. farmer = "Log cost ✓", backyard
//     = "Done ✓")
//   • All 6 launch languages — falls back to English when a
//     locale is missing per the engine's `tr()` helper

// Helper: build the universal "completion prompt" line in 6 langs.
const COMPLETION_PROMPT_FARMER = {
  en: 'Great job. Next task will update soon.',
  fr: 'Bon travail. La prochaine t\u00e2che s\u2019affichera bient\u00f4t.',
  sw: 'Vizuri sana. Kazi inayofuata itasasishwa hivi karibuni.',
  ha: 'Aiki mai kyau. Aiki na gaba zai sabunta nan ba da jimawa ba.',
  tw: 'Wo y\u025b adwuma pa. Adwuma a edi h\u0254 b\u025bba kakra.',
  hi: '\u0936\u093e\u092c\u093e\u0936! \u0905\u0917\u0932\u093e \u0915\u093e\u092e \u091c\u0932\u094d\u0926 \u0905\u092a\u0921\u0947\u091f \u0939\u094b\u0917\u093e\u0964',
};
const COMPLETION_PROMPT_BACKYARD = COMPLETION_PROMPT_FARMER; // same wording works

// ─── Templates ────────────────────────────────────────────
export const TASK_TEMPLATES = Object.freeze({

  // ─── 1. Profile missing (fallback per spec §5) ─────────
  profile_missing: {
    farmer: {
      title: {
        en: 'Complete your farm profile',
        fr: 'Compl\u00e9tez votre profil de ferme',
        sw: 'Kamilisha wasifu wa shamba lako',
        ha: 'Kammala bayanin gonarka',
        tw: 'Wie wo afuo ho nsedie',
        hi: '\u0905\u092a\u0928\u0940 \u0916\u0947\u0924\u0940 \u0915\u0940 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u092a\u0942\u0930\u0940 \u0915\u0930\u0947\u0902',
      },
      reason: {
        en: 'We need your crop and growth stage to give the right task.',
        fr: 'Nous avons besoin de votre culture et de votre stade pour proposer la bonne t\u00e2che.',
        sw: 'Tunahitaji zao na hatua yake ili kukupa kazi sahihi.',
        ha: 'Muna bukatar amfanin gona da matakin girma don ba ka aikin da ya dace.',
        tw: 'Y\u025bhwehw\u025b wo afude ne ne mfiase na yagye wo nsamane pa.',
        hi: '\u0938\u0939\u0940 \u0915\u093e\u092e \u0926\u0947\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092a\u094d\u0930\u091f\u093f\u0936\u0924 \u0935\u0930\u094d\u0930\u0935\u0942 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u091a\u093e\u0939\u093f\u090f\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: {
        en: 'Add planting date for tailored advice.',
        fr: 'Ajoutez la date de plantation pour des conseils adapt\u00e9s.',
        sw: 'Ongeza tarehe ya kupanda kupata ushauri sahihi.',
        ha: 'Ka kara kwanan shukar don shawara da ta dace.',
        tw: 'F\u025b m\u025bn\u025b a wud\u0254w no ho da no.',
        hi: '\u0938\u093f\u0916\u093e\u0908 \u0915\u0940 \u0924\u093e\u0930\u0940\u0916 \u0921\u093e\u0932\u0947\u0902\u0964',
      },
      ctaLabel: {
        en: 'Add details \u2713', fr: 'Ajouter \u2713', sw: 'Ongeza maelezo \u2713',
        ha: 'Kara bayanai \u2713', tw: 'F\u025b nkyer\u025b\u025bmu \u2713', hi: '\u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u091c\u094b\u0921\u093c\u0947\u0902 \u2713',
      },
      urgency:       'high',
      estimatedTime: '2 min',
    },
    backyard: {
      title: {
        en: 'Tell us what you\u2019re growing',
        fr: 'Dites-nous ce que vous cultivez',
        sw: 'Tuambie unachopanda',
        ha: 'Gaya mana abin da kake shukawa',
        tw: 'Ka kyer\u025b y\u025bn nea woreyiw\u025b',
        hi: '\u092c\u0924\u093e\u090f\u0902 \u0906\u092a \u0915\u094d\u092f\u093e \u0909\u0917\u093e \u0930\u0939\u0947 \u0939\u0948\u0902',
      },
      reason: {
        en: 'A few details help us suggest one simple task each day.',
        fr: 'Quelques d\u00e9tails nous aident \u00e0 proposer une t\u00e2che simple chaque jour.',
        sw: 'Maelezo machache hutusaidia kupendekeza kazi rahisi kila siku.',
        ha: 'Bayanai kadan suna taimakawa mu ba da \u0257aya mai sauki kowace rana.',
        tw: 'Nkyer\u025b\u025b kakra b\u025bma yatumi ma wo adwuma a \u025by\u025b mmer\u025bw da biara.',
        hi: '\u0915\u0941\u091b \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0938\u0947 \u0939\u092e \u0930\u094b\u091c\u093c \u0938\u093e\u0926\u093e \u0915\u093e\u092e \u091c\u094b\u0921\u093c \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: {
        en: 'Add a photo of your plant for better tips.',
        fr: 'Ajoutez une photo de votre plante pour de meilleurs conseils.',
        sw: 'Ongeza picha ya mmea wako kupata mwongozo bora.',
        ha: 'Kara hoton shukarka don shawara mai inganci.',
        tw: 'F\u025b w\u0254 dua mfonin so na yatumi b\u025boa wo yiye.',
        hi: '\u092c\u0947\u0939\u0924\u0930 \u0938\u0941\u091d\u093e\u0935 \u0915\u0947 \u0932\u093f\u090f \u092a\u094c\u0927\u0947 \u0915\u0940 \u090f\u0915 \u0924\u0938\u094d\u0935\u0940\u0930 \u091c\u094b\u0921\u093c\u0947\u0902\u0964',
      },
      ctaLabel: {
        en: 'Add details \u2713', fr: 'Ajouter \u2713', sw: 'Ongeza \u2713',
        ha: 'Kara \u2713', tw: 'F\u025b nkyer\u025b\u025bmu \u2713', hi: '\u091c\u094b\u0921\u093c\u0947\u0902 \u2713',
      },
      urgency:       'high',
      estimatedTime: '2 min',
    },
  },

  // ─── 2. Heavy rain warning (spec §4 weather adaptation) ─
  heavy_rain_warning: {
    farmer: {
      title: {
        en: 'Skip outdoor work today',
        fr: 'Pas de travail ext\u00e9rieur aujourd\u2019hui',
        sw: 'Ruka kazi ya nje leo',
        ha: 'Ka tsallake aikin waje yau',
        tw: 'Gyae akuayuie nn\u025b',
        hi: '\u0906\u091c \u092c\u093e\u0939\u0930 \u0915\u093e \u0915\u093e\u092e \u091b\u094b\u0921\u093c\u0947\u0902',
      },
      reason: {
        en: 'Heavy rain is forecast. Spraying or weeding now wastes inputs.',
        fr: 'De fortes pluies sont pr\u00e9vues. Pulv\u00e9riser maintenant gaspille les intrants.',
        sw: 'Mvua kubwa inatarajiwa. Kunyunyiza sasa kunaharibu pembejeo.',
        ha: 'Ana hasashen ruwan sama mai \u017aafi. Fesa yanzu ya rasa kaya.',
        tw: 'W\u0254bra os\u0254ne kakra. Sika gu nn\u025b s\u025b ny\u025b nimde\u025b.',
        hi: '\u0906\u091c \u092d\u093e\u0930\u0940 \u092c\u093e\u0930\u093f\u0936 \u0939\u094b\u0917\u0940\u0964 \u091b\u093f\u0921\u093c\u0915\u093e\u0935 \u0915\u093e \u092a\u0948\u0938\u093e \u092c\u091a\u093e\u090f\u0902\u0964',
      },
      safetyNote: {
        en: 'Stay away from open fields during lightning.',
        fr: 'Restez \u00e0 l\u2019\u00e9cart des champs ouverts pendant la foudre.',
        sw: 'Epuka shamba wazi wakati wa radi.',
        ha: 'Ka guji filaye a lokacin walƙiya.',
        tw: 'Twe wo ho fi mfide-mfide ho s\u025b ekyer\u025b agude\u025b.',
        hi: '\u092c\u093f\u091c\u0932\u0940 \u0915\u0947 \u0926\u094c\u0930\u093e\u0928 \u0916\u0941\u0932\u0947 \u0916\u0947\u0924 \u092e\u0947\u0902 \u0928 \u091c\u093e\u090f\u0902\u0964',
      },
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: {
        en: 'Tomorrow: check fields for waterlogging.',
        fr: 'Demain : v\u00e9rifiez les champs pour l\u2019engorgement.',
        sw: 'Kesho: angalia shamba kwa maji yaliyojaa.',
        ha: 'Gobe: duba gona don ruwa ya tsaya.',
        tw: 'Ɔkyena: hwehw\u025b mfi\u025b mu ahonom.',
        hi: '\u0915\u0932: \u0916\u0947\u0924\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932\u092d\u0930\u093e\u0935 \u0926\u0947\u0916\u0947\u0902\u0964',
      },
      urgency:       'high',
      estimatedTime: '5 min',
    },
    backyard: {
      title: {
        en: 'Bring pots under cover today',
        fr: 'Mettez vos pots \u00e0 l\u2019abri aujourd\u2019hui',
        sw: 'Hifadhi vyungu chini ya paa leo',
        ha: 'Kawo tukwane karkashin rufi yau',
        tw: 'Ma w\u0254 nkukura ahin\u00ec nn\u025b',
        hi: '\u0917\u092e\u0932\u0947 \u0906\u091c \u091b\u093e\u090f \u092e\u0947\u0902 \u0930\u0916\u0947\u0902',
      },
      reason: {
        en: 'Heavy rain is coming — pots and seedlings can drown.',
        fr: 'De fortes pluies arrivent — les pots et semis peuvent se noyer.',
        sw: 'Mvua kubwa inakuja \u2014 vyungu na mche zinaweza kufa.',
        ha: 'Ruwan sama mai \u017aafi yana zuwa \u2014 tukwane na iya nutsewa.',
        tw: 'Os\u0254ne kakra reba \u2014 nkukura ne nyiwa b\u025bnsoa.',
        hi: '\u092d\u093e\u0930\u0940 \u092c\u093e\u0930\u093f\u0936 \u0906\u090f\u0917\u0940 \u2014 \u092a\u094c\u0927\u0947 \u0921\u0942\u092c \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: {
        en: 'Tomorrow: check for soggy soil.',
        fr: 'Demain : v\u00e9rifiez si la terre est d\u00e9tremp\u00e9e.',
        sw: 'Kesho: angalia udongo uliotota.',
        ha: 'Gobe: duba kasar da ta tsuma.',
        tw: 'Ɔkyena: hwehw\u025b dua nsuo so.',
        hi: '\u0915\u0932: \u0917\u0940\u0932\u0940 \u092e\u093f\u091f\u094d\u091f\u0940 \u0926\u0947\u0916\u0947\u0902\u0964',
      },
      urgency:       'high',
      estimatedTime: '5 min',
    },
  },

  // ─── 3. Heat stress warning ────────────────────────────
  heat_stress_warning: {
    farmer: {
      title: {
        en: 'Water early or after sunset',
        fr: 'Arrosez t\u00f4t ou apr\u00e8s le coucher du soleil',
        sw: 'Mwagilia mapema au jioni',
        ha: 'Ba da ruwa da safe ko bayan rana',
        tw: 'Gu nsuo any\u025bm\u00e9 anaa awia akyiri',
        hi: '\u0938\u0941\u092c\u0939 \u092f\u093e \u0938\u0942\u0930\u094d\u092f\u093e\u0938\u094d\u0924 \u0915\u0947 \u092c\u093e\u0926 \u092a\u093e\u0928\u0940 \u0926\u0947\u0902',
      },
      reason: {
        en: 'High heat scorches roots. Watering at midday loses 60% to evaporation.',
        fr: 'La forte chaleur br\u00fble les racines. Arroser \u00e0 midi perd 60 % en \u00e9vaporation.',
        sw: 'Joto kali huchoma mizizi. Kumwagilia mchana huingia kwa mvuke.',
        ha: 'Zafi mai \u017aafi yana \u0263onawa saiwa. Ba da ruwa rana da rana ya rasa 60%.',
        tw: 'Ɔhyew kakra hye nhini. Nsuo a wugu awia gu kwa.',
        hi: '\u0917\u0930\u094d\u092e\u0940 \u091c\u0921\u093c\u094b\u0902 \u0915\u094b \u091c\u0932\u093e\u0924\u0940 \u0939\u0948\u0964 \u0926\u094b\u092a\u0939\u0930 \u092e\u0947\u0902 \u092a\u093e\u0928\u0940 \u0915\u093e 60% \u0935\u093e\u0937\u094d\u092a \u0939\u094b\u0924\u093e \u0939\u0948\u0964',
      },
      safetyNote: {
        en: 'Wear a hat and drink water often.',
        fr: 'Portez un chapeau et buvez de l\u2019eau souvent.',
        sw: 'Vaa kofia na kunywa maji mara nyingi.',
        ha: 'Saka hula kuma sha ruwa akai-akai.',
        tw: 'Hy\u025b kyew na nom nsuo wo h\u00f4.',
        hi: '\u091f\u094b\u092a\u0940 \u092a\u0939\u0928\u0947\u0902 \u0914\u0930 \u092a\u093e\u0928\u0940 \u092a\u093f\u090f\u0902\u0964',
      },
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: {
        en: 'Mulch around base to hold moisture.',
        fr: 'Paillez autour de la base pour retenir l\u2019humidit\u00e9.',
        sw: 'Funika udongo karibu na shina kuhifadhi unyevu.',
        ha: 'Rufa kasa kewaye da tushen don ajiye danshi.',
        tw: 'Kata nhini ho na ode nsuo akyer\u025b.',
        hi: '\u091c\u0921\u093c \u0915\u0947 \u091a\u093e\u0930\u094b\u0902 \u0913\u0930 \u092e\u0932\u094d\u091a \u0915\u0930\u0947\u0902\u0964',
      },
      urgency:       'high',
      estimatedTime: '10 min',
    },
    backyard: {
      title: {
        en: 'Water plants early today',
        fr: 'Arrosez les plantes t\u00f4t aujourd\u2019hui',
        sw: 'Mwagilia mimea mapema leo',
        ha: 'Ba da ruwa ga shukoki da safe yau',
        tw: 'Gu wo afude\u025b nsuo any\u025bm\u00e9 nn\u025b',
        hi: '\u092a\u094c\u0927\u094b\u0902 \u0915\u094b \u0906\u091c \u091c\u0932\u094d\u0926\u0940 \u092a\u093e\u0928\u0940 \u0926\u0947\u0902',
      },
      reason: {
        en: 'Hot weather stresses leaves. Morning watering helps the most.',
        fr: 'La chaleur stresse les feuilles. L\u2019arrosage du matin aide le plus.',
        sw: 'Joto huchosha majani. Maji ya asubuhi husaidia zaidi.',
        ha: 'Zafi yana matsa ganye. Ruwan safe yana taimaka sosai.',
        tw: 'Ɔhyew yi nhaban no. Nsuo a wogu any\u025bm\u00e9 ye papa.',
        hi: '\u0917\u0930\u094d\u092e\u0940 \u092a\u0924\u094d\u0924\u094b\u0902 \u0915\u094b \u0928\u0941\u0915\u0938\u093e\u0928 \u0915\u0930\u0924\u0940 \u0939\u0948\u0964 \u0938\u0941\u092c\u0939 \u0915\u093e \u092a\u093e\u0928\u0940 \u0938\u092c\u0938\u0947 \u092c\u0947\u0939\u0924\u0930\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: {
        en: 'Move pots to shade if possible.',
        fr: 'D\u00e9placez les pots \u00e0 l\u2019ombre si possible.',
        sw: 'Hamisha vyungu kwenye kivuli kama inawezekana.',
        ha: 'Mai matsayin tukwane zuwa inuwa.',
        tw: 'Tu nkukura k\u0254 ahomayie\u025b mu.',
        hi: '\u0917\u092e\u0932\u094b\u0902 \u0915\u094b \u091b\u093e\u090f \u092e\u0947\u0902 \u0930\u0916\u0947\u0902\u0964',
      },
      urgency:       'medium',
      estimatedTime: '5 min',
    },
  },

  // ─── 4. Cold stress (highland / temperate) ─────────────
  cold_stress_warning: {
    farmer: {
      title: {
        en: 'Protect crop from cold tonight',
        fr: 'Prot\u00e9gez la culture du froid ce soir',
        sw: 'Linda zao kutokana na baridi usiku huu',
        ha: 'Kare amfanin gona daga sanyi yau da daddare',
        tw: 'Bo afude\u025b ho ban fi ahuhuro nn\u025b anwummer\u025b',
        hi: '\u0906\u091c \u0930\u093e\u0924 \u0920\u0902\u0921 \u0938\u0947 \u092b\u093c\u0938\u0932 \u092c\u091a\u093e\u090f\u0902',
      },
      reason: {
        en: 'Low temperatures slow growth and damage flowers.',
        fr: 'Les basses temp\u00e9ratures ralentissent la croissance et ab\u00eement les fleurs.',
        sw: 'Joto la chini hupunguza ukuaji na kuharibu maua.',
        ha: 'Sanyi yana rage girma kuma yana lalata furanni.',
        tw: 'Ahuhuro tew nyini\u025b na \u025bsɛe nhwiren.',
        hi: '\u0915\u092e \u0924\u093e\u092a\u092e\u093e\u0928 \u0935\u0943\u0926\u094d\u0927\u093f \u0930\u094b\u0915\u0924\u093e \u0939\u0948 \u0914\u0930 \u092b\u0942\u0932 \u0916\u0930\u093e\u092c \u0915\u0930\u0924\u093e \u0939\u0948\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: {
        en: 'Tomorrow: inspect for frost damage.',
        fr: 'Demain : v\u00e9rifiez les d\u00e9g\u00e2ts du gel.',
        sw: 'Kesho: angalia uharibifu wa baridi.',
        ha: 'Gobe: duba lalacewar sanyi.',
        tw: 'Ɔkyena: hwehw\u025b dwer\u025b a ahuhuro de aba.',
        hi: '\u0915\u0932: \u092a\u093e\u0932\u093e \u0928\u0941\u0915\u0938\u093e\u0928 \u091c\u093e\u0902\u091a\u0947\u0902\u0964',
      },
      urgency:       'medium',
      estimatedTime: '10 min',
    },
    backyard: {
      title: {
        en: 'Cover plants tonight',
        fr: 'Couvrez les plantes ce soir',
        sw: 'Funika mimea usiku huu',
        ha: 'Rufa shukoki yau da daddare',
        tw: 'Kata afude\u025b nn\u025b anwummer\u025b',
        hi: '\u0906\u091c \u0930\u093e\u0924 \u092a\u094c\u0927\u094b\u0902 \u0915\u094b \u0922\u0915\u0947\u0902',
      },
      reason: {
        en: 'A simple cloth keeps cold off seedlings.',
        fr: 'Un simple tissu prot\u00e8ge les semis du froid.',
        sw: 'Kitambaa rahisi kinazuia baridi kwa mche.',
        ha: 'Tufa mai sauki tana hana sanyi a kan tsire.',
        tw: 'Ntoma\u025bma\u025b kakra ka ahuhuro fi nyiwa.',
        hi: '\u0938\u093e\u0926\u093e \u0915\u092a\u0921\u093c\u093e \u0920\u0902\u0921 \u0938\u0947 \u092a\u094c\u0927\u094b\u0902 \u0915\u094b \u092c\u091a\u093e\u090f\u0917\u093e\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: {
        en: 'Remove cover in the morning.',
        fr: 'Retirez la couverture le matin.',
        sw: 'Ondoa kifuniko asubuhi.',
        ha: 'Cire rufi da safe.',
        tw: 'Yi nkata\u025bma\u025b no any\u025bm\u00e9.',
        hi: '\u0938\u0941\u092c\u0939 \u0922\u0915\u094d\u0915\u0928 \u0939\u091f\u093e\u090f\u0902\u0964',
      },
      urgency:       'low',
      estimatedTime: '3 min',
    },
  },

  // ─── 5. Dry-spell irrigation reminder ──────────────────
  dry_irrigation: {
    farmer: {
      title: {
        en: 'Irrigate today',
        fr: 'Irriguer aujourd\u2019hui',
        sw: 'Mwagilia leo',
        ha: 'Ba da ruwa yau',
        tw: 'Gu nsuo nn\u025b',
        hi: '\u0906\u091c \u0938\u093f\u0902\u091a\u093e\u0908 \u0915\u0930\u0947\u0902',
      },
      reason: {
        en: 'No rain in the forecast. Dry stress now hurts your yield.',
        fr: 'Pas de pluie pr\u00e9vue. Le stress hydrique r\u00e9duit votre rendement.',
        sw: 'Hakuna mvua. Ukame sasa unapunguza mavuno.',
        ha: 'Babu hasashen ruwan sama. Bushewa yanzu na rage amfani.',
        tw: 'Os\u0254ne nni h\u0254 nn\u025b. Bonk\u0254 yi te wo nnuaba.',
        hi: '\u092c\u093e\u0930\u093f\u0936 \u0928\u0939\u0940\u0902 \u0939\u094b\u0917\u0940\u0964 \u0938\u0942\u0916\u0947 \u0938\u0947 \u0909\u092a\u091c \u0918\u091f\u0924\u0940 \u0939\u0948\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: {
        en: 'Mulch base to hold moisture longer.',
        fr: 'Paillez la base pour retenir l\u2019humidit\u00e9.',
        sw: 'Funika udongo kuhifadhi unyevu.',
        ha: 'Rufa kasa don ajiye danshi.',
        tw: 'Kata nhini ho.',
        hi: '\u091c\u0921\u093c \u0915\u0947 \u092a\u093e\u0938 \u092e\u0932\u094d\u091a \u0915\u0930\u0947\u0902\u0964',
      },
      urgency:       'high',
      estimatedTime: '15 min',
    },
    backyard: {
      title: {
        en: 'Water plants well today',
        fr: 'Arrosez bien les plantes aujourd\u2019hui',
        sw: 'Mwagilia mimea vizuri leo',
        ha: 'Ba da ruwa sosai yau',
        tw: 'Gu wo afude\u025b\u00e8 nsuo papa nn\u025b',
        hi: '\u0906\u091c \u092a\u094c\u0927\u094b\u0902 \u0915\u094b \u0905\u091a\u094d\u091b\u0940 \u0924\u0930\u0939 \u092a\u093e\u0928\u0940 \u0926\u0947\u0902',
      },
      reason: {
        en: 'Dry weather drains pots fast. A good soak now lasts 2 days.',
        fr: 'Le temps sec dess\u00e8che les pots vite. Un bon arrosage tient 2 jours.',
        sw: 'Hali ya ukame inakausha vyungu haraka. Maji mengi sasa hutoa siku 2.',
        ha: 'Bushewa tana sa tukwane bushewa da sauri. Ruwa sosai zai dauki kwana 2.',
        tw: 'Ahuhuro tew nkukura nsuo ntem. Nsuo a woagu papa b\u025bd\u025b nna 2.',
        hi: '\u0938\u0942\u0916\u0947 \u092e\u0947\u0902 \u0917\u092e\u0932\u0947 \u091c\u0932\u094d\u0926\u0940 \u0938\u0942\u0916\u0924\u0947 \u0939\u0948\u0902\u0964 \u0905\u091a\u094d\u091b\u093e \u092a\u093e\u0928\u0940 2 \u0926\u093f\u0928 \u091a\u0932\u0947\u0917\u093e\u0964',
      },
      safetyNote: null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: {
        en: 'Add a saucer under each pot.',
        fr: 'Mettez une soucoupe sous chaque pot.',
        sw: 'Weka sahani chini ya kila chungu.',
        ha: 'Sanya farantin a kasa kowane tukunya.',
        tw: 'Fa awoa\u025b si nkukura biara ase.',
        hi: '\u0939\u0930 \u0917\u092e\u0932\u0947 \u0915\u0947 \u0928\u0940\u091a\u0947 \u0925\u093e\u0932\u0940 \u0930\u0916\u0947\u0902\u0964',
      },
      urgency:       'medium',
      estimatedTime: '8 min',
    },
  },

  // ─── 6. Stage-default templates ────────────────────────
  // A small, curated set covering the most common stages.
  // The decision engine falls back here whenever no weather
  // signal applies.

  stage_planning: {
    farmer: {
      title:           { en: 'Plan your planting today',         fr: 'Planifiez votre plantation', sw: 'Panga upandaji wako', ha: 'Tsara shukar ka', tw: 'Yɛ wo dua\u025b ho nhyehy\u025b\u025b', hi: '\u0905\u092a\u0928\u0940 \u092c\u0941\u0935\u093e\u0908 \u0915\u093e \u092f\u094b\u091c\u0928\u093e \u092c\u0928\u093e\u090f\u0902' },
      reason:          { en: 'Picking the right time + variety lifts yield 20%.', fr: 'Choisir le bon moment et la bonne vari\u00e9t\u00e9 augmente le rendement de 20%.', sw: 'Kuchagua wakati na aina sahihi huinua mavuno kwa 20%.', ha: 'Zaben lokaci da iri yana kara amfanin 20%.', tw: 'Bere ne afude\u025b a w\u025fak\u025feka mma nnuaba foforo 20%.', hi: '\u0938\u0939\u0940 \u0938\u092e\u092f \u0914\u0930 \u0915\u093f\u0938\u094d\u092e \u0938\u0947 20% \u0905\u0927\u093f\u0915 \u0909\u092a\u091c\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Buy or borrow seeds for sowing.', fr: 'Achetez ou empruntez les semences.', sw: 'Nunua au kopa mbegu.', ha: 'Saya ko aro irin shuka.', tw: 'T\u0254 anaas\u025b f\u025b aba.', hi: '\u092c\u0940\u091c \u0916\u0930\u0940\u0926\u0947\u0902 \u092f\u093e \u0909\u0927\u093e\u0930 \u0932\u0947\u0902\u0964' },
      urgency:       'medium',
      estimatedTime: '10 min',
    },
    backyard: {
      title:           { en: 'Pick what to grow this season', fr: 'Choisissez quoi cultiver cette saison', sw: 'Chagua cha kupanda msimu huu', ha: 'Zabi abin shukawa wannan lokacin', tw: 'Yi ade\u025b a wob\u025bdua w\u0254 wei\u025b mu', hi: '\u0907\u0938 \u092e\u094c\u0938\u092e \u092e\u0947\u0902 \u0915\u094d\u092f\u093e \u0909\u0917\u093e\u090f\u0901 \u091a\u0941\u0928\u0947\u0902' },
      reason:          { en: 'Easy starters: tomato, lettuce, herbs, pepper.', fr: 'Faciles : tomate, laitue, herbes, piment.', sw: 'Rahisi: nyanya, lettuce, mboga, pilipili.', ha: 'Masu sauki: tomato, salata, ganyaye, barkono.', tw: 'Ade\u025b a \u025by\u025b mmer\u025bw: tomato, lettuce, ganyen wura, pepper.', hi: '\u0906\u0938\u093e\u0928: \u091f\u092e\u093e\u091f\u0930, \u0938\u0932\u093e\u0926, \u091c\u0921\u093c\u0940-\u092c\u0942\u091f\u093f\u092f\u093e\u0901, \u092e\u093f\u0930\u094d\u091a\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Find sunny spots for pots.', fr: 'Trouvez des endroits ensoleill\u00e9s.', sw: 'Tafuta sehemu zenye jua.', ha: 'Nemo wuraren rana.', tw: 'Hwehw\u025b baabi a awia w\u0254.', hi: '\u0927\u0942\u092a\u0935\u093e\u0932\u0940 \u091c\u0917\u0939\u0947\u0902 \u091a\u0941\u0928\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '5 min',
    },
  },

  stage_planting: {
    farmer: {
      title:           { en: 'Sow seeds at correct spacing', fr: 'Semez aux bons espacements', sw: 'Panda mbegu kwa nafasi sahihi', ha: 'Shuka iri tare da daidaitaccen sarari', tw: 'Dua aba w\u0254 baabi a \u025by\u025b papa', hi: '\u0938\u0939\u0940 \u0926\u0942\u0930\u0940 \u092a\u0930 \u092c\u0940\u091c \u0921\u093e\u0932\u0947\u0902' },
      reason:          { en: 'Right spacing now means stronger plants in 4 weeks.', fr: 'Le bon espacement donne des plantes fortes en 4 semaines.', sw: 'Nafasi sahihi sasa, mimea imara baada ya wiki 4.', ha: 'Sarari mai kyau yanzu yana ba da shuka mai \u017aafi a cikin makonni 4.', tw: 'Baabi a \u025by\u025b papa ma afude\u025b denden b\u025be\u025b nnaw\u0254twe 4.', hi: '\u0938\u0939\u0940 \u0926\u0942\u0930\u0940 \u0938\u0947 4 \u0939\u092b\u093c\u094d\u0924\u094b\u0902 \u092e\u0947\u0902 \u092e\u091c\u093c\u092c\u0942\u0924 \u092a\u094c\u0927\u0947\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Mark planting date for your records.', fr: 'Notez la date de plantation.', sw: 'Andika tarehe ya kupanda.', ha: 'Yi alama da kwanan shuka.', tw: 'Twer\u025bw da a wud\u0254w no.', hi: '\u092c\u0941\u0935\u093e\u0908 \u0915\u0940 \u0924\u093e\u0930\u0940\u0916 \u0928\u094b\u091f \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'high',
      estimatedTime: '30 min',
    },
    backyard: {
      title:           { en: 'Plant your seedlings today', fr: 'Plantez vos semis aujourd\u2019hui', sw: 'Panda mche zako leo', ha: 'Shuka tsiren ka yau', tw: 'Dua wo nyiwa\u025b nn\u025b', hi: '\u0906\u091c \u0905\u092a\u0928\u0947 \u092a\u094c\u0927\u0947 \u0932\u0917\u093e\u090f\u0902' },
      reason:          { en: 'Soil is ready. Press gently and water lightly.', fr: 'Le sol est pr\u00eat. Pressez doucement et arrosez l\u00e9g\u00e8rement.', sw: 'Udongo uko tayari. Bonyeza polepole na mwagilia kidogo.', ha: 'Kasa ta shirya. Latsa hankali kuma ka ba ruwa kadan.', tw: 'Asaase no ay\u025b krado. Mia no br\u025bo na gu nsuo kakra.', hi: '\u092e\u093f\u091f\u094d\u091f\u0940 \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0964 \u0927\u0940\u0930\u0947 \u0926\u092c\u093e\u090f\u0902, \u0939\u0932\u094d\u0915\u093e \u092a\u093e\u0928\u0940\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Water once, then again tomorrow.', fr: 'Arrosez une fois, puis demain.', sw: 'Mwagilia mara moja, kisha kesho.', ha: 'Ba da ruwa sau \u0257aya, gobe kuma.', tw: 'Gu nsuo p\u025bnk\u0254 ho, na \u025fkyena bio.', hi: '\u090f\u0915 \u092c\u093e\u0930 \u092a\u093e\u0928\u0940 \u0926\u0947\u0902, \u092b\u093f\u0930 \u0915\u0932\u0964' },
      urgency:       'medium',
      estimatedTime: '15 min',
    },
  },

  stage_germination: {
    farmer: {
      title:           { en: 'Check germination this morning',         fr: 'V\u00e9rifiez la germination ce matin',     sw: 'Angalia uoteaji asubuhi hii',     ha: 'Duba tsiro yau da safe',           tw: 'Hwehw\u025b nyiwa\u025b any\u025bm\u00e9 nn\u025b', hi: '\u0906\u091c \u0938\u0941\u092c\u0939 \u0905\u0902\u0915\u0941\u0930\u0923 \u091c\u093e\u0902\u091a\u0947\u0902' },
      reason:          { en: 'Gaps mean replanting now to avoid yield loss.',  fr: 'Des trous signifient replanter maintenant.', sw: 'Mahali pasipo mche unahitaji kupanda upya.', ha: 'Wuraren da babu tsiro suna bukatar shuka kuma.', tw: 'M\u025fdesa\u025f a \u025by\u025b dunsin ma replant nn\u025b.',   hi: '\u0938\u094d\u0925\u093e\u0928 \u0916\u093e\u0932\u0940 \u0939\u094b \u0924\u094b \u0926\u094b\u092c\u093e\u0930\u093e \u092c\u094b\u090f\u0902\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Replant gaps from spare seeds.',          fr: 'Replantez les trous avec des semences de r\u00e9serve.', sw: 'Panda upya kwa mbegu za akiba.', ha: 'Sake shuka da sauran iri.', tw: 'Dua aba\u025b a aka.', hi: '\u092c\u091a\u0947 \u092c\u0940\u091c \u0938\u0947 \u0926\u094b\u092c\u093e\u0930\u093e \u092c\u094b\u090f\u0902\u0964' },
      urgency:       'high',
      estimatedTime: '20 min',
    },
    backyard: {
      title:           { en: 'Look at your seedlings today', fr: 'Regardez vos semis aujourd\u2019hui', sw: 'Angalia mche wako leo', ha: 'Duba tsiranka yau', tw: 'Hw\u025b wo nyiwa\u025b nn\u025b', hi: '\u0906\u091c \u0905\u092a\u0928\u0947 \u092a\u094c\u0927\u094b\u0902 \u0926\u0947\u0916\u0947\u0902' },
      reason:          { en: 'Tiny green shoots? You\u2019re on track.', fr: 'Des petites pousses vertes ? Tout va bien.', sw: 'Maua madogo ya kijani? Uko sawa.', ha: 'Ƙananan ganye kore? Kana kan hanya.', tw: 'Nhwiren akɔk\u0254 nketewa? Wo h\u0254 ye.', hi: '\u091b\u094b\u091f\u0947 \u0939\u0930\u0947 \u0905\u0902\u0915\u0941\u0930? \u0938\u092c \u0920\u0940\u0915\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Take a photo to track growth.', fr: 'Prenez une photo pour suivre.', sw: 'Piga picha kufuatilia.', ha: 'Dauki hoto don bibiya.', tw: 'Twa mfonin na hwehw\u025b nyini.', hi: '\u0935\u0943\u0926\u094d\u0927\u093f \u091f\u094d\u0930\u0948\u0915 \u0915\u0947 \u0932\u093f\u090f \u092b\u094b\u091f\u094b \u0932\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '3 min',
    },
  },

  stage_vegetative: {
    farmer: {
      title:           { en: 'Check for pests on leaves',  fr: 'V\u00e9rifiez les ravageurs sur les feuilles', sw: 'Angalia wadudu kwenye majani', ha: 'Duba kwari a kan ganye', tw: 'Hwehw\u025b mfonyini wo nhaban so', hi: '\u092a\u0924\u094d\u0924\u094b\u0902 \u092a\u0930 \u0915\u0940\u091f \u0926\u0947\u0916\u0947\u0902' },
      reason:          { en: 'Catching pests early saves your yield.', fr: 'Rep\u00e9rer t\u00f4t sauve le rendement.', sw: 'Kugundua mapema kunaokoa mavuno.', ha: 'Gano da wuri yana ceton amfani.', tw: 'Wuhwehwɛ ntɛm a no kanyini\u025b nyim\u00e1.', hi: '\u091c\u0932\u094d\u0926\u0940 \u092a\u0939\u091a\u093e\u0928\u0928\u093e \u0909\u092a\u091c \u092c\u091a\u093e\u0924\u093e \u0939\u0948\u0964' },
      safetyNote:      { en: 'Wear gloves if spraying.',  fr: 'Portez des gants si vous pulv\u00e9risez.', sw: 'Vaa glavu ukinyunyiza.', ha: 'Saka safofin hannu idan kana fesa.', tw: 'Hy\u025b nsa-tu\u025b s\u025b worepetew.', hi: '\u091b\u093f\u0921\u093c\u0915\u093e\u0935 \u0938\u0947 \u092a\u0939\u0932\u0947 \u0926\u0938\u094d\u0924\u093e\u0928\u0947 \u092a\u0939\u0928\u0947\u0902\u0964' },
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Apply organic pesticide if needed.', fr: 'Appliquez un pesticide bio si n\u00e9cessaire.', sw: 'Tumia dawa ya asili ikiwa lazima.', ha: 'Yi amfani da magani na halitta idan ya wajaba.', tw: 'Fa nfase\u025b a \u025by\u025b natural di dwuma s\u025b ho hia.', hi: '\u091c\u093c\u0930\u0942\u0930\u0924 \u0939\u094b \u0924\u094b \u091c\u0948\u0935\u093f\u0915 \u0915\u0940\u091f\u0928\u093e\u0936\u0915 \u0921\u093e\u0932\u0947\u0902\u0964' },
      urgency:       'medium',
      estimatedTime: '10 min',
    },
    backyard: {
      title:           { en: 'Look at the underside of leaves', fr: 'Regardez sous les feuilles', sw: 'Angalia chini ya majani', ha: 'Duba ƙarƙashin ganye', tw: 'Hw\u025b nhaban ase', hi: '\u092a\u0924\u094d\u0924\u094b\u0902 \u0915\u0947 \u0928\u0940\u091a\u0947 \u0926\u0947\u0916\u0947\u0902' },
      reason:          { en: 'Tiny bugs hide under leaves. Wipe with soapy water.', fr: 'De minuscules insectes se cachent sous les feuilles.', sw: 'Wadudu wadogo hujificha. Futa kwa maji ya sabuni.', ha: 'Kwari kanana suna boyewa. Goga da ruwan sabulu.', tw: 'Mfonyini nketewa hint\u00e1 nhaban ase. P\u025bw fa nsuo a samina w\u0254 mu.', hi: '\u091b\u094b\u091f\u0947 \u0915\u0940\u0921\u093c\u0947 \u091b\u093f\u092a\u0924\u0947 \u0939\u0948\u0902\u0964 \u0938\u093e\u092c\u0941\u0928 \u0935\u093e\u0932\u0947 \u092a\u093e\u0928\u0940 \u0938\u0947 \u092a\u094b\u0902\u091b\u0947\u0902\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Try the scan tool if you see spots.', fr: 'Utilisez le scan si vous voyez des taches.', sw: 'Tumia scan ikiwa unaona alama.', ha: 'Yi amfani da scan idan ka ga tabo.', tw: 'S\u025b wuhu nsensanee\u025b a, fa scan no.', hi: '\u0926\u093e\u0917 \u0926\u093f\u0916\u0947\u0902 \u0924\u094b \u0938\u094d\u0915\u0948\u0928 \u0907\u0938\u094d\u0924\u0947\u092e\u093e\u0932 \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '5 min',
    },
  },

  stage_flowering: {
    farmer: {
      title:           { en: 'Apply flowering-stage fertilizer', fr: 'Appliquez l\u2019engrais de floraison', sw: 'Weka mbolea ya hatua ya maua', ha: 'Sa takin furen', tw: 'Fa nhwiren-bere ade\u025b si', hi: '\u092b\u0942\u0932 \u0905\u0935\u0938\u094d\u0925\u093e \u0915\u0940 \u0916\u093e\u0926 \u0921\u093e\u0932\u0947\u0902' },
      reason:          { en: 'Phosphorus + potassium now boosts fruit set.', fr: 'Phosphore + potassium augmentent la fructification.', sw: 'Fosforasi na potasiamu sasa huinua matunda.', ha: 'Phosphorus da potassium yanzu na kara \u201d\u017a\u017aaitaccen \u201Dyaa.', tw: 'Phosphorus ne potassium nn\u025b ma aba foforo.', hi: '\u092b\u0949\u0938\u094d\u092b\u094b\u0930\u0938 \u0914\u0930 \u092a\u094b\u091f\u0948\u0936\u093f\u092f\u092e \u092b\u0932 \u092c\u0922\u093c\u093e\u0924\u0947 \u0939\u0948\u0902\u0964' },
      safetyNote:      { en: 'Use the spreader to apply evenly.', fr: 'Utilisez l\u2019\u00e9pandeur pour une r\u00e9partition uniforme.', sw: 'Tumia kifaa cha kueneza kwa usawa.', ha: 'Yi amfani da na\'urar yadawa.', tw: 'Fa spreader y\u025bd\u025b sɛsie\u025b.', hi: '\u0938\u092e\u093e\u0928 \u0930\u0942\u092a \u0938\u0947 \u091b\u093f\u0921\u093c\u0915\u0928\u0947 \u0915\u093e \u0909\u092a\u0915\u0930\u0923 \u0907\u0938\u094d\u0924\u0947\u092e\u093e\u0932 \u0915\u0930\u0947\u0902\u0964' },
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Tomorrow: monitor for flower drop.', fr: 'Demain : surveillez la chute des fleurs.', sw: 'Kesho: angalia kupukutika kwa maua.', ha: 'Gobe: duba faduwar fure.', tw: 'Ɔkyena: hw\u025b s\u025b nhwiren b\u025bt\u0254 fam.', hi: '\u0915\u0932: \u092b\u0942\u0932 \u0917\u093f\u0930\u0928\u093e \u0926\u0947\u0916\u0947\u0902\u0964' },
      urgency:       'high',
      estimatedTime: '20 min',
    },
    backyard: {
      title:           { en: 'Help your plant flower well', fr: 'Aidez votre plante \u00e0 bien fleurir', sw: 'Saidia mmea wako kuchanua', ha: 'Taimaka shukarka ta yi fure', tw: 'Boa wo afude\u025b ma \u025bnnyini nhwiren', hi: '\u092a\u094c\u0927\u0947 \u0915\u094b \u092b\u0942\u0932\u0928\u0947 \u092e\u0947\u0902 \u092e\u0926\u0926 \u0915\u0930\u0947\u0902' },
      reason:          { en: 'Add a little compost to the pot today.', fr: 'Ajoutez un peu de compost aujourd\u2019hui.', sw: 'Ongeza mboji kidogo leo.', ha: 'Kara takin gida kadan yau.', tw: 'F\u025b\u0254 ade\u025b si kakra nn\u025b.', hi: '\u0906\u091c \u0925\u094b\u0921\u093c\u0940 \u0915\u0902\u092a\u094b\u0938\u094d\u091f \u0921\u093e\u0932\u0947\u0902\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Take a photo when first flower opens.', fr: 'Prenez une photo \u00e0 la premi\u00e8re fleur.', sw: 'Piga picha ya ua la kwanza.', ha: 'Dauki hoto a furen farko.', tw: 'Twa mfonin nhwiren a edi kan.', hi: '\u092a\u0939\u0932\u0947 \u092b\u0942\u0932 \u092a\u0930 \u092b\u094b\u091f\u094b \u0932\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '5 min',
    },
  },

  stage_maturity: {
    farmer: {
      title:           { en: 'Check ripeness markers',           fr: 'V\u00e9rifiez les indices de maturit\u00e9',     sw: 'Angalia alama za kukomaa',          ha: 'Duba alamomin nuna girma',          tw: 'Hw\u025b mmer\u025b\u00e8 a edi nso h\u0254',      hi: '\u092a\u0915\u0928\u0947 \u0915\u0940 \u0928\u093f\u0936\u093e\u0928\u0940 \u091c\u093e\u0902\u091a\u0947\u0902' },
      reason:          { en: 'Harvest 1\u20132 days late drops your sale price.', fr: '1\u20132 jours de retard fait baisser le prix.', sw: 'Kuvuna kuchelewa siku 1-2 hupunguza bei.', ha: 'Kwana 1-2 jinkiri yana saukar farashin sayarwa.', tw: 'Wo nnaw\u0254twe 1-2 a wo dum\u00ec ma boom\u00e9 ho mu br\u025b.',  hi: '1-2 \u0926\u093f\u0928 \u0926\u0947\u0930\u0940 \u092a\u0930 \u092e\u0942\u0932\u094d\u092f \u0918\u091f\u0924\u093e \u0939\u0948\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Plan harvest team for next 2 days.',  fr: 'Planifiez l\u2019\u00e9quipe de r\u00e9colte.',           sw: 'Panga timu ya mavuno.',           ha: 'Tsara tawagar girbi.',           tw: 'Yɛ kuw a wob\u025bdum nnipa nhyehy\u025b\u025b.',  hi: '\u0905\u0917\u0932\u0947 2 \u0926\u093f\u0928 \u092e\u0947\u0902 \u0915\u091f\u093e\u0908 \u091f\u0940\u092e \u0924\u092f \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'high',
      estimatedTime: '15 min',
    },
    backyard: {
      title:           { en: 'See if anything is ready to pick',  fr: 'Voyez s\u2019il y a quelque chose \u00e0 cueillir',     sw: 'Angalia kama kuna kitu cha kuvuna', ha: 'Duba in akwai abin tsamuwa',         tw: 'Hw\u025b s\u025b ade\u025b bi b\u025bdua',      hi: '\u0926\u0947\u0916\u0947\u0902 \u0915\u0941\u091b \u0924\u094b\u0921\u093c\u0928\u0947 \u0932\u093e\u092f\u0915 \u0939\u0948' },
      reason:          { en: 'Pick when colour is full and skin is firm.',   fr: 'Cueillez quand la couleur est pleine.',         sw: 'Vuna rangi imekamilika na ngozi imara.', ha: 'Tsamo idan launi ya cika kuma fata ta yi tauri.', tw: 'Tum\u00ec s\u025b kɔla aboa na honam ay\u025b den.', hi: '\u0930\u0902\u0917 \u092a\u0942\u0930\u093e \u0939\u094b \u0914\u0930 \u091b\u093f\u0932\u0915\u093e \u0915\u0921\u093c\u093e \u0939\u094b \u0924\u094b \u0924\u094b\u0921\u093c\u0947\u0902\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Use what you pick within 2 days.',     fr: 'Utilisez votre r\u00e9colte sous 2 jours.',         sw: 'Tumia kilichovunwa ndani ya siku 2.', ha: 'Yi amfani da abin tsamowa cikin kwana 2.', tw: 'Fa di adwuma nnaw\u0254twe 2 mu.',     hi: '2 \u0926\u093f\u0928 \u092e\u0947\u0902 \u0907\u0938\u094d\u0924\u0947\u092e\u093e\u0932 \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'medium',
      estimatedTime: '10 min',
    },
  },

  stage_harvest: {
    farmer: {
      title:           { en: 'Harvest mature plots today', fr: 'R\u00e9coltez les parcelles m\u00fbres aujourd\u2019hui', sw: 'Vuna mashamba yaliyokomaa leo', ha: 'Girbe gonakin da suka nuna girma yau', tw: 'Tw\u025b nso afuo nn\u025b', hi: '\u0906\u091c \u092a\u0915\u0940 \u092b\u093c\u0938\u0932 \u0915\u0940 \u0915\u091f\u093e\u0908 \u0915\u0930\u0947\u0902' },
      reason:          { en: 'Late harvest reduces grade. Sell-ready in 1 day.', fr: 'R\u00e9colte tardive r\u00e9duit la qualit\u00e9.', sw: 'Mavuno yamechelewa hupunguza ubora.', ha: 'Jinkirin girbi yana saukar inganci.', tw: 'Akyiri girbi te\u025b boom\u00e9 ho.', hi: '\u0926\u0947\u0930\u0940 \u0938\u0947 \u0917\u0941\u0923\u0935\u0924\u094d\u0924\u093e \u0918\u091f\u0924\u0940 \u0939\u0948\u0964' },
      safetyNote:      { en: 'Hydrate; harvest in cool hours if possible.', fr: 'Hydratez-vous; r\u00e9coltez aux heures fra\u00eeches.', sw: 'Kunywa maji; vuna saa za baridi.', ha: 'Sha ruwa; girba a sanyaye.', tw: 'Nom nsuo; tw\u025b ahuma w\u0254 mmer\u025b a ahuhuro w\u0254 mu.', hi: '\u092a\u093e\u0928\u0940 \u092a\u093f\u090f\u0902; \u0920\u0902\u0921\u0947 \u0938\u092e\u092f \u092e\u0947\u0902 \u0915\u091f\u093e\u0908\u0964' },
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Weigh and record yield for sell page.', fr: 'Pesez et enregistrez le rendement.', sw: 'Pima na rekodi mavuno.', ha: 'Auna kuma yi rikodin amfani.', tw: 'San hwehw\u025b nnuaba na twer\u025bw.', hi: '\u0909\u092a\u091c \u0924\u094c\u0932\u0947\u0902 \u0914\u0930 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'high',
      estimatedTime: '30 min',
    },
    backyard: {
      title:           { en: 'Pick what\u2019s ready today', fr: 'Cueillez ce qui est pr\u00eat aujourd\u2019hui', sw: 'Vuna kilichoiva leo', ha: 'Tsamo abin da ya nuna girma yau', tw: 'Tw\u025b ade\u025b a\u00ec aboa nn\u025b', hi: '\u0906\u091c \u091c\u094b \u0924\u0948\u092f\u093e\u0930 \u0939\u0948 \u0935\u094b \u0924\u094b\u0921\u093c\u0947\u0902' },
      reason:          { en: 'Fresh from your plant beats the store any day.', fr: 'Fra\u00eechement r\u00e9colt\u00e9 vaut toujours mieux qu\u2019achet\u00e9.', sw: 'Safi kutoka mmea wako ni bora kuliko duka.', ha: 'Sabo daga shukarka ya fi shago.', tw: 'Foforo fi wo afude\u025b ho ye sen sotɔɔ\u00ec.', hi: '\u0905\u092a\u0928\u0947 \u092a\u094c\u0927\u0947 \u0938\u0947 \u0924\u093e\u091c\u093e \u0939\u092e\u0947\u0936\u093e \u092c\u0947\u0939\u0924\u0930\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Plant your next seedlings now.', fr: 'Plantez vos prochains semis maintenant.', sw: 'Panda mche zifuatazo sasa.', ha: 'Shuka tsiren gaba yanzu.', tw: 'Dua wo nyiwa\u025b foforo nn\u025b.', hi: '\u0905\u092c \u0905\u0917\u0932\u0947 \u092a\u094c\u0927\u0947 \u0932\u0917\u093e\u090f\u0902\u0964' },
      urgency:       'medium',
      estimatedTime: '15 min',
    },
  },

  stage_post_harvest: {
    farmer: {
      title:           { en: 'Dry and store today\u2019s harvest', fr: 'S\u00e9chez et stockez la r\u00e9colte du jour', sw: 'Kausha na hifadhi mavuno ya leo', ha: 'Bushe ka adana girbin yau', tw: 'Si ah\u00fa nnuaba nn\u025b', hi: '\u0906\u091c \u0915\u0940 \u0909\u092a\u091c \u0938\u0941\u0916\u093e\u090f\u0902 \u0914\u0930 \u0938\u094d\u091f\u094b\u0930 \u0915\u0930\u0947\u0902' },
      reason:          { en: 'Bad storage costs more than the harvest itself.', fr: 'Mauvais stockage co\u00fbte plus que la r\u00e9colte.', sw: 'Hifadhi mbaya ni gharama kubwa.', ha: 'Mummunan adana ya fi tsada fiye da girbi.', tw: 'Sɔw a \u025by\u025b bone te\u025b ka sen girbi no.', hi: '\u0916\u0930\u093e\u092c \u092d\u0902\u0921\u093e\u0930\u0923 \u092b\u093c\u0938\u0932 \u0938\u0947 \u092e\u0939\u0902\u0917\u093e \u0939\u0948\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'List ready supply on the Sell tab.', fr: 'Listez le stock pr\u00eat sur l\u2019onglet Vendre.', sw: 'Orodhesha hifadhi kwa Sell.', ha: 'Lissafa hajojinka a Sell.', tw: 'Twer\u025bw nnoɔma w\u0254 Sell mu.', hi: '\u0938\u0947\u0932 \u091f\u0948\u092c \u092e\u0947\u0902 \u0938\u0942\u091a\u0940\u092c\u0926\u094d\u0927 \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'medium',
      estimatedTime: '20 min',
    },
    backyard: {
      title:           { en: 'Save the best for next planting', fr: 'Gardez les meilleures graines', sw: 'Hifadhi mbegu bora', ha: 'Adana iri mafi kyau', tw: 'Sɔ aba pa', hi: '\u0905\u0917\u0932\u0940 \u092c\u093e\u0930 \u0915\u0947 \u0932\u093f\u090f \u0938\u092c\u0938\u0947 \u0905\u091a\u094d\u091b\u0947 \u092c\u0940\u091c \u092c\u091a\u093e\u090f\u0902' },
      reason:          { en: 'Free seeds for next season.', fr: 'Graines gratuites pour la prochaine saison.', sw: 'Mbegu za bure msimu ujao.', ha: 'Iri kyauta na lokaci na gaba.', tw: 'Aba\u025b a w\u025fanto sika a\u025fo h\u025f wo bere a edi h\u025f.', hi: '\u0905\u0917\u0932\u0947 \u092e\u094c\u0938\u092e \u0915\u0947 \u0932\u093f\u090f \u092e\u0941\u092b\u093c\u094d\u0924 \u092c\u0940\u091c\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Dry seeds in shade for 2 days.', fr: 'S\u00e9chez les graines \u00e0 l\u2019ombre 2 jours.', sw: 'Kausha mbegu kivulini siku 2.', ha: 'Bushe iri a inuwa kwana 2.', tw: 'Si aba\u025b ah\u00fa a no nnaw\u0254twe 2.', hi: '\u091b\u093e\u090f \u092e\u0947\u0902 2 \u0926\u093f\u0928 \u0938\u0941\u0916\u093e\u090f\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '5 min',
    },
  },

  // ─── 7. Fallback (last resort, never blank) ──────────────
  fallback_check: {
    farmer: {
      title:           { en: 'Walk your farm and look',    fr: 'Faites un tour de votre ferme',     sw: 'Tembea shamba uangalie',         ha: 'Ka yi yawo gonarka ka duba',       tw: 'Tow w\u0254 afuo no na hwehw\u025b',     hi: '\u0905\u092a\u0928\u0940 \u0916\u0947\u0924\u0940 \u0918\u0942\u092e\u0947\u0902 \u0914\u0930 \u0926\u0947\u0916\u0947\u0902' },
      reason:          { en: 'A 10-minute walk catches early problems before they cost money.', fr: 'Une marche de 10 min rep\u00e8re les probl\u00e8mes t\u00f4t.', sw: 'Matembezi ya dakika 10 hugundua matatizo mapema.', ha: 'Tafiya minti 10 tana kama matsalolin da wuri.', tw: 'Mfonin 10 mu, hwehw\u025b ahokyer\u025b\u025b a ese\u025b w\u025fhwehw\u025b.', hi: '10 \u092e\u093f\u0928\u091f \u091a\u0932\u0928\u093e \u0938\u092e\u0938\u094d\u092f\u093e\u090f\u0902 \u091c\u0932\u094d\u0926\u0940 \u092a\u0915\u0921\u093c\u0924\u093e \u0939\u0948\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_FARMER,
      nextRecommended: { en: 'Note anything unusual to scan tomorrow.', fr: 'Notez ce qui semble inhabituel \u00e0 scanner demain.', sw: 'Andika chochote cha ajabu kuchanganua kesho.', ha: 'Yi rubutu da abin da ya bambanta don scan gobe.', tw: 'Twer\u025bw ade\u025b a \u025bnte s\u025b deɛ ɛy\u025b daa na fa scan ɔkyena.', hi: '\u0915\u0941\u091b \u0905\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u0939\u094b \u0924\u094b \u0915\u0932 \u0938\u094d\u0915\u0948\u0928 \u0915\u0947 \u0932\u093f\u090f \u0928\u094b\u091f \u0915\u0930\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '10 min',
    },
    backyard: {
      title:           { en: 'Look at your plants today',  fr: 'Regardez vos plantes aujourd\u2019hui', sw: 'Angalia mimea yako leo',          ha: 'Duba shukokinka yau',              tw: 'Hw\u025b w\u0254 afude\u025b nn\u025b',         hi: '\u0906\u091c \u0905\u092a\u0928\u0947 \u092a\u094c\u0927\u094b\u0902 \u0915\u094b \u0926\u0947\u0916\u0947\u0902' },
      reason:          { en: 'A quick look every day keeps plants healthy.', fr: 'Un coup d\u2019\u0153il quotidien garde les plantes en sant\u00e9.', sw: 'Kuangalia kila siku kunaweka mimea afya.', ha: 'Duba kullum yana sa shukoki cikin koshin lafiya.', tw: 'Hwehwɛ daa ma afude\u025b\u00e8 ho y\u025b den.', hi: '\u0930\u094b\u091c\u093c \u090f\u0915 \u0928\u091c\u093c\u0930 \u0938\u0947 \u092a\u094c\u0927\u0947 \u0938\u094d\u0935\u0938\u094d\u0925 \u0930\u0939\u0924\u0947 \u0939\u0948\u0902\u0964' },
      safetyNote:      null,
      completionPrompt: COMPLETION_PROMPT_BACKYARD,
      nextRecommended: { en: 'Take a photo if anything looks odd.', fr: 'Prenez une photo si quelque chose para\u00eet \u00e9trange.', sw: 'Piga picha kama unaona kitu cha ajabu.', ha: 'Dauki hoto idan wani abu ya yi mamaki.', tw: 'Twa mfonin s\u025b ade\u025b bi y\u025b daa.', hi: '\u0905\u091c\u0940\u092c \u0926\u093f\u0916\u0947 \u0924\u094b \u092b\u094b\u091f\u094b \u0932\u0947\u0902\u0964' },
      urgency:       'low',
      estimatedTime: '3 min',
    },
  },
});
