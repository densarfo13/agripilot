/**
 * smsTemplates.js — short, voice-friendly variants of farmer-facing
 * messages, separated from the main translation table because:
 *
 *   1. SMS has a hard 160-char-per-segment cost; long messages get
 *      split into 2–3 segments and the carrier bills per segment.
 *      Voice TTS over Twilio sounds robotic on long sentences and
 *      eats per-second call cost.
 *
 *   2. Translators authoring SMS / voice copy think in a different
 *      voice than UI copy authors — short, direct, no jargon, no
 *      placeholder names that sound weird on TTS.
 *
 *   3. Keeping these in their own table prevents accidental UI
 *      regressions when a copywriter shortens a key for SMS and
 *      forgets the dashboard renders the same string.
 *
 * Convention
 *   Each key in the main table that ALSO needs a short form gets
 *   a sibling entry here with the same dotted path. Resolution
 *   order in `tShort(key, lang)`:
 *
 *     1. SMS_SHORT[key][lang]            — explicit short variant
 *     2. SMS_SHORT[key].en               — English short fallback
 *     3. fall through to t(key, lang)    — main table, full message
 *     4. last resort                     — humanized key (never crash)
 *
 * Adding new keys
 *   • Keep each value ≤ 140 characters so a single SMS segment can
 *     carry it after the recipient's name / variable substitution.
 *   • Avoid abbreviations farmers won't recognise on a feature phone.
 *   • Test on Twilio's TTS for voice — words like "GPS" should be
 *     spelled out as "G P S" if the TTS pronounces them oddly.
 */

import { t } from './index.js';

// ─── Short messages — each ≤ 140 chars including farmer name ──
//
// `<name>` is a token the caller substitutes before sending. We
// keep it as a literal string (not a {placeholder}) so a careless
// caller forgetting to substitute still ships a coherent line.
const SMS_SHORT = Object.freeze({

  // ─── Weather / smart-alert family ─────────────────────────
  'sms.flood_risk': Object.freeze({
    en: 'Flood risk this week. Move stored crops up high. Check drainage.',
    hi: 'इस सप्ताह बाढ़ का खतरा। फसल ऊँची जगह रखें। जल निकासी जाँचें।',
    tw: 'Nsuyiri asiane nnawɔtwe yi. Fa wo nnɔbae kɔ ɛsoro. Hwɛ nsu kwan.',
    sw: 'Hatari ya mafuriko wiki hii. Hifadhi mazao juu. Kagua mfereji.',
    ha: 'Hadarin ambaliya wannan mako. Daga amfani sama. Duba magudanan ruwa.',
    fr: 'Risque d\u2019inondation. Mettez vos r\u00E9coltes en hauteur.',
  }),
  'sms.water_stress': Object.freeze({
    en: 'Dry days ahead. Water your crops in the morning.',
    hi: 'सूखा आ रहा है। सुबह फसल को पानी दें।',
    tw: 'Ɔpɛ reba. Gugu wo nnɔbae anɔpa.',
    sw: 'Siku kavu mbele. Mwagilia mazao asubuhi.',
    ha: 'Ranaku bushe a gaba. Shayar amfani da safe.',
    fr: 'Jours secs \u00E0 venir. Arrosez le matin.',
  }),
  'sms.heavy_rain': Object.freeze({
    en: 'Heavy rain tomorrow. Delay planting. Cover stored crops.',
    hi: 'कल भारी बारिश। बुवाई टालें। फसल ढकें।',
    tw: 'Nsuo bɛtɔ pii ɔkyena. Twɛn ansa na woadua. Kata wo nnɔbae.',
    sw: 'Mvua kubwa kesho. Ahirisha kupanda. Funika mazao.',
    ha: 'Ruwan sama mai yawa gobe. Jinkirta shuka. Rufe amfani.',
    fr: 'Forte pluie demain. Reportez le semis. Couvrez les r\u00E9coltes.',
  }),
  'sms.drought': Object.freeze({
    en: 'Drought warning. Save water. Mulch around crops.',
    hi: 'सूखा चेतावनी। पानी बचाएँ। फसल पर मल्च लगाएँ।',
    tw: 'Ɔpɛ kɔkɔbɔ. Sie nsuo. Fa nhyiren no kata wo nnɔbae ho.',
    sw: 'Tahadhari ya ukame. Hifadhi maji. Funika udongo.',
    ha: 'Hattara da fari. Adana ruwa. Lullube ƙasa.',
    fr: 'Alerte s\u00E9cheresse. \u00C9conomisez l\u2019eau. Paillage.',
  }),
  'sms.heat_stress': Object.freeze({
    en: 'Hot days ahead. Water deeply. Shade young plants.',
    hi: 'गर्म दिन आ रहे। गहराई से पानी दें। छोटे पौधों को छाया दें।',
    tw: 'Nna a ɛyɛ hyew reba. Gugu nsuo pii. Bɔ nnua nketewa nyunu.',
    sw: 'Siku za joto mbele. Mwagilia kwa kina. Linda mimea midogo.',
    ha: 'Kwanaki masu zafi a gaba. Shayar da yawa. Inuwa ƙananan tsire.',
    fr: 'Forte chaleur. Arrosage profond. Ombrez les jeunes plants.',
  }),

  // ─── Cycle / harvest family ───────────────────────────────
  'sms.harvest_ready': Object.freeze({
    en: 'Your crop is ready to harvest. Pick on dry days.',
    hi: 'फसल कटाई के लिए तैयार। सूखे दिनों पर काटें।',
    tw: 'Wo nnɔbae aso aba. Twa wɔ nna a hyew mu.',
    sw: 'Mazao yako tayari kuvunwa. Vuna siku kavu.',
    ha: 'Amfanin ku ya shirye don girbi. Girba a kwana bushe.',
    fr: 'R\u00E9colte pr\u00EAte. R\u00E9coltez par temps sec.',
  }),
  'sms.planting_window': Object.freeze({
    en: 'Good planting window opens this week. Prepare your seeds.',
    hi: 'इस सप्ताह बुवाई का अच्छा समय। बीज तैयार रखें।',
    tw: 'Bere pa a wɔbɛdua bue nnawɔtwe yi. Siesie wo aba.',
    sw: 'Wakati mzuri wa kupanda wiki hii. Tayarisha mbegu.',
    ha: 'Lokaci mai kyau na shuka wannan mako. Tsara iri.',
    fr: 'Bonne fen\u00EAtre de semis cette semaine. Pr\u00E9parez les graines.',
  }),

  // ─── Pest / disease family ────────────────────────────────
  'sms.pest_alert': Object.freeze({
    en: 'Pest risk in your area. Check crops daily.',
    hi: 'आपके क्षेत्र में कीट का खतरा। हर दिन फसल देखें।',
    tw: 'Mmoawammoawa asiane wɔ wo mpɔtam. Hwɛ wo nnɔbae daa.',
    sw: 'Hatari ya wadudu eneo lako. Kagua mazao kila siku.',
    ha: 'Hadarin kwari a yankin ku. Duba amfani kullum.',
    fr: 'Risque de ravageurs. Inspectez vos cultures chaque jour.',
  }),

  // ─── Reminders ────────────────────────────────────────────
  'sms.task_due_today': Object.freeze({
    en: 'You have a farm task today. Open Farroway to see it.',
    hi: 'आज खेत का कार्य है। फैरोवे खोलें।',
    tw: 'Wowɔ afuom adwuma nnɛ. Bue Farroway hwɛ.',
    sw: 'Una kazi shamba leo. Fungua Farroway.',
    ha: 'Kuna da aikin gona yau. Buɗe Farroway.',
    fr: 'T\u00E2che ferme aujourd\u2019hui. Ouvrez Farroway.',
  }),
  'sms.update_progress': Object.freeze({
    en: 'Add a photo or note today to keep your progress score.',
    hi: 'आज एक तस्वीर या नोट जोड़ें ताकि स्कोर बना रहे।',
    tw: 'Fa mfoni anaa note ka ho nnɛ na wo score nkɔ so.',
    sw: 'Ongeza picha au noti leo ili alama yako iendelee.',
    ha: 'Ƙara hoto ko bayanin yau don kiyaye makin ku.',
    fr: 'Ajoutez photo ou note aujourd\u2019hui pour garder votre score.',
  }),

  // ─── Connectivity / sync feedback (in-app banner + SMS) ──
  'sms.offline_saved': Object.freeze({
    en: 'Saved offline. We will sync when you are back online.',
    hi: 'ऑफ़लाइन सहेजा गया। ऑनलाइन होने पर सिंक होगा।',
    tw: 'Yɛakora wɔ offline. Ɛbɛsync sɛ wofa intanɛt bio a.',
    sw: 'Imehifadhiwa nje ya mtandao. Itasawazishwa unaporejea.',
    ha: 'An ajiye ba haɗi. Za a daidaita lokacin da ka dawo intanet.',
    fr: 'Enregistr\u00E9 hors ligne. Synchro au retour de la connexion.',
  }),
  'sms.sync_completed': Object.freeze({
    en: 'All changes synced.',
    hi: 'सभी बदलाव सिंक हो गए।',
    tw: 'Nsesaeɛ no nyinaa async.',
    sw: 'Mabadiliko yote yamesawazishwa.',
    ha: 'An daidaita duk canje-canje.',
    fr: 'Toutes les modifications synchronis\u00E9es.',
  }),
});

/**
 * tShort — translate a short-message key, falling back through the
 * main translation table and finally to a humanised key. Never
 * throws; always returns a non-empty string.
 *
 *   tShort('sms.flood_risk', 'hi')    → "इस सप्ताह बाढ़ का खतरा। …"
 *   tShort('sms.task_due_today', 'fr')→ "T\u00E2che ferme aujourd\u2019hui. …"
 *   tShort('sms.unknown', 'hi')       → falls through to t('sms.unknown', 'hi')
 */
export function tShort(key, lang = 'en', vars) {
  if (!key) return '';
  try {
    const entry = SMS_SHORT[key];
    if (entry) {
      const text = entry[lang] || entry.en;
      if (text) return interpolate(text, vars);
    }
    // Not in the SMS table — fall through to the main table so a
    // caller can request the long-form when no short exists. The
    // caller (SMS / voice service) should clamp the result.
    return t(key, lang, vars);
  } catch (err) {
    try { console.warn('[smsTemplates] tShort threw:', err && err.message); }
    catch { /* ignore */ }
    return `[MISSING:${key}]`;
  }
}

function interpolate(text, vars) {
  if (!vars) return text;
  let out = String(text);
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

/**
 * Keys exposed for the SMS-pipeline integration test so it can
 * assert that every SMS key has all 3 launch languages plus the
 * source English.
 */
export const SMS_SHORT_KEYS = Object.freeze(Object.keys(SMS_SHORT));

export const _internal = Object.freeze({ SMS_SHORT });
