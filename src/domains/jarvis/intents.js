/**
 * intents.js — Jarvis MVP intent table (honest kernel, 2026-07-05).
 *
 * LOCAL keyword/pattern matching only — no cloud NLP, no generation. Keywords are
 * merged across en/fr/sw/ha/tw/hi so a farmer is understood in any supported
 * language without locale detection. Pure data; the classifier scores against it.
 */

export const INTENTS = Object.freeze([
  'SCAN_PLANT', 'TODAY_TASKS', 'FARM_STATUS', 'WEATHER_ADVICE', 'MARKETPLACE_SELL',
  'FUNDING_SEARCH', 'INSURANCE_SEARCH', 'JOURNAL_ADD', 'LANGUAGE_CHANGE', 'HELP', 'UNKNOWN',
]);

// Multilingual keyword sets. Weight 2 = strong (near-unambiguous), 1 = supporting.
export const KEYWORDS = Object.freeze({
  SCAN_PLANT: Object.freeze([
    ['scan', 2], ['photo', 1], ['picture', 1], ['leaf', 1], ['plant', 1], ['check my plant', 2],
    ['scanner', 2], ['analyser', 1], ['feuille', 1], ['plante', 1],           // fr
    ['piga picha', 2], ['skani', 2], ['mmea', 1], ['jani', 1],                // sw
    ['duba', 1], ['hoto', 2], ['ganye', 1], ['shuka', 1],                     // ha
    ['hwehwɛ', 1], ['mfoni', 2], ['ahaban', 1], ['afifideɛ', 1],              // tw
    ['स्कैन', 2], ['पत्ता', 1], ['पौधा', 1],                                     // hi
  ]),
  TODAY_TASKS: Object.freeze([
    ['today', 2], ['task', 2], ['what should i do', 2], ['to do', 1], ['plan', 1],
    ["aujourd'hui", 2], ['tâche', 2], ['que faire', 2],
    ['leo', 2], ['kazi', 2], ['nifanye nini', 2],
    ['yau', 2], ['aiki', 2], ['me zan yi', 2],
    ['ɛnnɛ', 2], ['adwuma', 2], ['menyɛ deɛn', 2],
    ['आज', 2], ['काम', 2], ['क्या करूं', 2],
  ]),
  FARM_STATUS: Object.freeze([
    ['my farm', 2], ['farm health', 2], ['how is my farm', 2], ['status', 1], ['healthy', 1],
    ['ma ferme', 2], ['santé de la ferme', 2],
    ['shamba langu', 2], ['hali ya shamba', 2],
    ['gonata', 2], ['lafiyar gona', 2],
    ['mʼafuo', 2], ['afuo no te sɛn', 2],
    ['मेरा खेत', 2], ['खेत कैसा', 2],
  ]),
  WEATHER_ADVICE: Object.freeze([
    ['weather', 2], ['rain', 2], ['water', 1], ['irrigate', 2], ['when should i water', 2], ['forecast', 2],
    ['météo', 2], ['pluie', 2], ['arroser', 2],
    ['hali ya hewa', 2], ['mvua', 2], ['kumwagilia', 2],
    ['yanayi', 2], ['ruwan sama', 2], ['ban ruwa', 2],
    ['ewiem', 2], ['osu', 2], ['gugu nsuo', 2],
    ['मौसम', 2], ['बारिश', 2], ['सिंचाई', 2],
  ]),
  MARKETPLACE_SELL: Object.freeze([
    ['sell', 2], ['buyer', 2], ['market', 1], ['who is buying', 2], ['price', 1],
    ['vendre', 2], ['acheteur', 2], ['marché', 1],
    ['kuuza', 2], ['mnunuzi', 2], ['soko', 1],
    ['sayar', 2], ['mai saye', 2], ['kasuwa', 1],
    ['tɔn', 2], ['adetɔfoɔ', 2], ['dwam', 1],
    ['बेचना', 2], ['खरीदार', 2], ['बाज़ार', 1],
  ]),
  FUNDING_SEARCH: Object.freeze([
    ['funding', 2], ['loan', 2], ['grant', 2], ['find funding', 2], ['money for my farm', 1],
    ['financement', 2], ['prêt', 2], ['subvention', 2],
    ['ufadhili', 2], ['mkopo', 2], ['ruzuku', 2],
    ['tallafi', 2], ['bashi', 2], ['rance', 2],
    ['sika mmoa', 2], ['bosea', 2],
    ['फंडिंग', 2], ['ऋण', 2], ['अनुदान', 2],
  ]),
  INSURANCE_SEARCH: Object.freeze([
    ['insurance', 2], ['insure', 2], ['cover my crop', 2],
    ['assurance', 2], ['assurer', 2],
    ['bima', 2],
    ['inshora', 2],
    ['nsiakyibɔ', 2],
    ['बीमा', 2],
  ]),
  JOURNAL_ADD: Object.freeze([
    ['journal', 2], ['note', 1], ['record', 1], ['add this to my journal', 2], ['write down', 2], ['diary', 2],
    ['carnet', 2], ['noter', 2],
    ['daftari', 2], ['andika', 2], ['kumbukumbu', 2],
    ['rubuta', 2], ['littafi', 2],
    ['twerɛ', 2], ['krataa', 1],
    ['डायरी', 2], ['लिखो', 2],
  ]),
  LANGUAGE_CHANGE: Object.freeze([
    ['language', 2], ['change language', 2], ['english', 2], ['french', 2], ['swahili', 2],
    ['hausa', 2], ['twi', 2], ['hindi', 2],
    ['langue', 2], ['français', 2],
    ['lugha', 2], ['kiswahili', 2],
    ['harshe', 2],
    ['kasa', 2],
    ['भाषा', 2],
  ]),
  HELP: Object.freeze([
    ['help', 2], ['how do i', 1], ['what can you do', 2],
    ['aide', 2], ['comment', 1],
    ['msaada', 2], ['usaidizi', 2],
    ['taimako', 2],
    ['mmoa', 2], ['boa me', 2],
    ['मदद', 2], ['सहायता', 2],
  ]),
});

// Intents whose flows may touch personal finance/insurance data — consent-gated.
export const CONSENT_GATED = Object.freeze(['INSURANCE_SEARCH']);

// Below this score the classifier declines to guess and asks a clarifying question.
export const CONFIDENCE_THRESHOLD = 2;
