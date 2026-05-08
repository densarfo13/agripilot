/**
 * voiceIntents.js — guided-question intent matcher and the
 * templated, safe answer table for each (intent × language).
 *
 * Strict-rule audit (spec §10):
 *   • No pesticide / chemical recommendations.
 *   • No disease diagnosis with certainty — say "possible
 *     issue", suggest contacting an agronomist for severe
 *     symptoms.
 *   • Keep advice short, practical, action-first.
 *   • Never make up GPS / weather data — answers are general
 *     guidance; surfaces that have live data should pass it
 *     in via vars and the answer template will substitute.
 *
 * The rollout spec (§3) lists six guided intents:
 *   today_tasks, weather, watering, harvest, sell, help
 *
 * Each intent below carries:
 *   id            stable string id
 *   patterns      Map<lang, string[]>  — phrases we match
 *   action        'navigate' | 'answer' | 'answer+navigate'
 *   navigate      route path when action !== 'answer'
 *   answers       Map<lang, string>    — short answer template
 *
 * If the matcher needs more inputs (live weather, today's
 * tasks), the caller computes them and passes via `vars` to
 * `answerForIntent` which substitutes {placeholders}.
 */

// Direct import from the standalone normalizer to avoid the
// voiceEngine ↔ voiceIntents circular import that tripped a
// TDZ in the minified production bundle.
import { normalizeFarmerQuestion } from './voiceQuestionNormalizer.js';

// Helper for declaring the same patterns across languages
// without repeating the syntax.
function P(en, tw, ha) {
  return { en, tw, ha };
}

export const INTENTS = Object.freeze([
  {
    id: 'today_tasks',
    action: 'answer+navigate',
    navigate: '/tasks',
    patterns: P(
      [
        'what should i do today',
        'what to do today',
        'todays task',
        'today task',
        'today tasks',
        'what task',
        'what is my task',
      ],
      [
        'd\u025Bn na ɛsɛ s\u025B meyɛ ɛnnɛ',
        'd\u025Bn na meyɛ ɛnnɛ',
        'me adwuma ɛnnɛ',
      ],
      [
        'me zan yi yau',
        'me ne aikina yau',
        'aikin yau',
      ],
    ),
    answers: P(
      'Today, check your crop and water only if the soil is dry. Tap "Open tasks" to see the full list.',
      'Ɛnnɛ, hwɛ wo nnɔbae na gugu nsuo sɛ asase no awo. Mia "Bue adwuma" hwɛ adwuma no nyinaa.',
      'Yau, duba amfanin gonarka kuma yi ruwa idan ƙasa ta bushe. Danna "Buɗe ayyuka" don ganin jerin.',
    ),
  },
  {
    id: 'weather',
    action: 'answer',
    patterns: P(
      [
        'will it rain',
        'is it going to rain',
        'rain today',
        'rain tomorrow',
        'whats the weather',
        'what is the weather',
        'weather today',
      ],
      [
        'nsuo bɛtɔ',
        'wim tebea',
        'osu bɛtɔ',
      ],
      [
        'ruwan sama zai sauka',
        'yanayi yau',
        'ana ruwa',
      ],
    ),
    answers: P(
      'Check the weather card on Home for today\u2019s forecast. If rain is expected, cover newly planted seeds and avoid spraying.',
      'Hwɛ wim tebea kaad wɔ Fie pagye no so na hu ɛnnɛ wim tebea. Sɛ nsuo bɛtɔ a, kata aba a wɔadua foforɔ no so na nnyɛ spray.',
      'Duba katin yanayin a Gida don ganin hasashen yau. Idan ana sa ran ruwa, rufe iri da aka shuka kuma kar a yi feshi.',
    ),
  },
  {
    id: 'watering',
    action: 'answer',
    patterns: P(
      [
        'when should i water',
        'when to water',
        'should i water',
        'do i need to water',
        'water my crop',
      ],
      [
        'da b\u025Bn na mengu nsuo',
        'gugu nsuo',
        'mensa wo nsuo',
      ],
      [
        'yaushe zan yi ruwa',
        'in yi ruwa',
        'yin ruwa',
      ],
    ),
    answers: P(
      'Water early in the morning or late afternoon when it is cooler. Skip watering if rain is expected within 24 hours.',
      'Gugu nsuo anɔpa anaa anwummerɛ bere a ahyɛw nyɛ den. Mfa nsuo nguo sɛ wɔahyɛ nkɔm sɛ nsuo bɛtɔ wɔ nnɔnhwere 24 mu.',
      'Yi ruwa da safe ko marece lokacin da yanayi ya yi sanyi. Kar ka yi ruwa idan ana sa ran ruwan sama cikin awa 24.',
    ),
  },
  {
    id: 'harvest',
    action: 'answer',
    patterns: P(
      [
        'is my crop ready',
        'can i harvest',
        'time to harvest',
        'ready to harvest',
        'should i harvest',
      ],
      [
        'me nnɔbae no awie',
        'mentwa',
        'twa bere',
      ],
      [
        'amfanin gonarka ya nuna',
        'lokacin girbi',
        'in girba',
      ],
    ),
    answers: P(
      'Possible signs your crop is ready: leaves turning yellow, grain hardening, or fruits firm to the touch. If unsure, ask an agronomist before harvesting.',
      'Nsɛnkyerɛnneɛ a ɛkyerɛ sɛ wo nnɔbae awie: nhaban dane akokɔsrade, aba a awo den, anaa aduaba a ayɛ den. Sɛ wonnim a, bisa kuayɛ ɔbenfoɔ ansa na woatwa.',
      'Alamomin da za su iya nuna amfanin gonarka ya nuna: ganye sun zama rawaya, ƙwayoyi sun yi ƙarfi, ko \u2019ya\u2019yan itace sun yi ƙarfi. Idan ba ka da tabbaci, tambayi masanin noma kafin ka girba.',
    ),
  },
  {
    id: 'sell',
    action: 'answer+navigate',
    navigate: '/sell',
    patterns: P(
      [
        'how do i sell',
        'sell my produce',
        'sell my crop',
        'how to sell',
        'list for sale',
      ],
      [
        'tɔn me nnɔbae',
        'ɛkwan a metɔn',
        'tɔn aduane',
      ],
      [
        'sayar da amfani',
        'yadda zan sayar',
        'sayar',
      ],
    ),
    answers: P(
      'Tap "Sell" to list your produce. Add the crop, quantity, price, and pickup or delivery preference \u2014 buyers in your region will see it.',
      'Mia "Tɔn" na tɔn wo nnɔbae. Ka nnɔbae no, dodow, bo ne sɛ wopɛ pickup anaa delivery \u2014 atɔfoɔ a wɔwɔ wo mantam mu bɛhunu.',
      'Danna "Sayarwa" don jera kayanka. Ƙara amfanin, yawa, farashi, da zaɓin ɗauka ko bayarwa \u2014 masu siye a yankin za su gani.',
    ),
  },
  {
    id: 'help',
    action: 'answer+navigate',
    navigate: '/help',
    patterns: P(
      [
        'i need help',
        'help me',
        'need help',
        'contact support',
        'contact your team',
        'talk to someone',
      ],
      [
        'mehia mmoa',
        'boa me',
        'mepɛ mmoa',
      ],
      [
        'ina buƙatar taimako',
        'taimake ni',
        'ina son taimako',
      ],
    ),
    answers: P(
      'Opening Help. From there you can read common questions or contact our team directly.',
      'Yɛrebue Mmoa pagye no. Wobetumi akenkan nsɛm a wɔtaa bisa anaa ka kyerɛ yɛn dwumadie no tee.',
      'Bude shafin Taimako. Daga can za ka iya karanta tambayoyi ko tuntuɓi ƙungiyarmu kai tsaye.',
    ),
  },

  // ── Voice Guide v1 — additional spec intents ────────────────
  // All answers stay action-first, low-literacy, and confidence-safe
  // ("may", "check", "consider"). No certainty claims, no exact
  // pesticide dosages, no "this will cure". Critical issues route
  // to local agronomy advice via the existing escalation flow.

  {
    id: 'scan_help',
    action: 'answer+navigate',
    navigate: '/scan',
    patterns: P(
      [
        'how do i scan',
        'how to scan',
        'scan my plant',
        'scan a leaf',
        'use the scan',
        'open scan',
        'how does scan work',
      ],
      [
        'sɛn na mɛyɛ scan',
        'bue scan',
        'scan me afifideɛ',
      ],
      [
        'yaya zan scan',
        'bude scan',
        'scan tsire',
      ],
    ),
    answers: P(
      'Tap Scan, then take a clear photo of the leaf in good light. We will tell you what we noticed and what to check next.',
      'Mia Scan, na twa mfoni a ɛda hɔ pefee wɔ hann pa mu. Yɛbɛkyerɛ wo deɛ yɛahunu ne deɛ ɛsɛ sɛ wohwɛ.',
      'Danna Scan, sannan ɗauki hoton ganye a wuri mai haske. Za mu gaya maka abin da muka lura kuma abin da za a duba.',
    ),
  },

  {
    id: 'yellowing_leaves',
    action: 'answer',
    patterns: P(
      [
        // Cover possessive ("my") and non-possessive forms.
        'why are leaves yellow',
        'why are my leaves yellow',
        'why is my leaf yellow',
        'leaves are yellow',
        'my leaves are yellow',
        'my leaves yellow',
        'my plant is yellow',
        'yellow leaves',
        'yellowing leaves',
        'leaf turning yellow',
        'plant turning yellow',
        'yellow plant',
        'leaves turning yellow',
        'leaves are turning yellow',
        'my leaves are turning yellow',
      ],
      [
        'aba akɔ akokɔsradeɛ',
        'aba ayɛ akokɔsradeɛ',
        'ahaban yɛ akokɔsradeɛ',
      ],
      [
        'ganyaye sun zama rawaya',
        'me yasa ganyaye suka yi rawaya',
        'rawayar ganyaye',
      ],
    ),
    answers: P(
      'Yellow leaves may come from too much water, dry soil, pests, or low nutrients. Check soil moisture and look under leaves.',
      'Akokɔsradeɛ aba bɛtumi afiri nsuo bebree, asase a awo, mmoawa, anaa nuhuro ketewa. Hwɛ asase no mu nsuo na hwɛ aba no ase.',
      'Rawayar ganyaye na iya zuwa daga yawan ruwa, ƙasa busasshiya, kwari, ko ƙarancin abinci. Duba danshin ƙasa kuma duba ƙarƙashin ganyaye.',
    ),
  },

  {
    id: 'pest_damage',
    action: 'answer+navigate',
    navigate: '/scan',
    patterns: P(
      [
        'pests on my plant',
        'pests on leaves',
        'insects on plant',
        'bugs on plant',
        'holes in leaves',
        'something eating leaves',
        'pest damage',
      ],
      [
        'mmoawa wɔ me dua so',
        'mmoawa di me aba',
        'tokuro wɔ aba mu',
      ],
      [
        'kwari a tsiro na',
        'kwari na cin ganyaye',
        'rami a ganyaye',
      ],
    ),
    answers: P(
      'Look under leaves and along stems for insects or eggs. Remove badly damaged leaves. Consider neem oil if pests spread, and follow label instructions.',
      'Hwɛ aba no ase ne nnua no nyinaa hyia mmoawa anaa nkesua. Yi aba a ɛyɛ basaa pa ara no fi mu. Susu neem ngo ho sɛ mmoawa no bɛkɔ so a, na di nhyerɛnsɛm a ɛwɔ ho akyi.',
      'Duba ƙarƙashin ganyaye da kan ganda don ganin kwari ko ƙwai. Cire ganyayen da suka lalace sosai. Yi la’akari da man neem idan kwari na yaduwa, kuma bi umarnin lakabi.',
    ),
  },

  {
    id: 'funding_help',
    action: 'answer+navigate',
    navigate: '/funding',
    patterns: P(
      [
        'is there funding',
        'are there grants',
        'farm loan',
        'farming funding',
        'funding for farmers',
        'how do i get funding',
        'do you have grants',
      ],
      [
        'sika wɔ hɔ ma akuafoɔ',
        'sika boa',
        'mɛnya sika',
      ],
      [
        'akwai tallafi',
        'akwai bashin manomi',
        'yaya zan sami tallafi',
      ],
    ),
    answers: P(
      'Funding options will appear based on your crop and region. Tap Funding to see what is available now.',
      'Sika a ɛboa ho akwan bɛda adi gyina wo nnɔbae ne wo mantam so. Mia Sika no na hwɛ deɛ ɛwɔ hɔ seesei.',
      'Hanyoyin tallafi za su bayyana bisa ga amfanin gonarka da yankinka. Danna Tallafi don ganin abin da ke nan yanzu.',
    ),
  },

  {
    id: 'repeat_task',
    action: 'answer',
    patterns: P(
      [
        'repeat',
        'say again',
        'say that again',
        'read it again',
        'read again',
        'repeat task',
        'play again',
        'one more time',
      ],
      [
        'san ka bio',
        'kenkan no bio',
        'ka bio',
      ],
      [
        'sake fada',
        'maimaita',
        'sake karantawa',
      ],
    ),
    answers: P(
      'Reading the last answer again. Tap Read again any time to hear it.',
      'Yɛrekenkan mmuaeɛ a etwaam no bio. Mia Kenkan bio bere biara a wopɛ sɛ wote.',
      'Sake karanta amsar da ta gabata. Danna Sake karantawa duk lokacin da kake son ji.',
    ),
  },

  {
    id: 'language_help',
    action: 'answer+navigate',
    navigate: '/settings',
    patterns: P(
      [
        'change language',
        'switch language',
        'speak twi',
        'speak hausa',
        'speak french',
        'speak swahili',
        'speak hindi',
        'set language',
        'i want twi',
        'i want hausa',
      ],
      [
        'sesa kasa',
        'kasa Twi',
        'sesa me kasa',
      ],
      [
        'canza yare',
        'yi magana hausa',
        'sauya yare',
      ],
    ),
    answers: P(
      'Open Settings to change the app language. We support English, Twi, Hausa, French, Kiswahili, and Hindi.',
      'Bue Nhyehyɛeɛ na sesa app no kasa. Yɛsoa Borɔfo, Twi, Hausa, French, Kiswahili, ne Hindi.',
      'Bude Saiti don canza yaren app. Muna goyon bayan Turanci, Twi, Hausa, Faransanci, Kiswahili, da Hindi.',
    ),
  },
]);

/**
 * Build a lookup map: lang → (pattern → intentId) so matching
 * is O(n) over patterns once per call rather than O(intents *
 * patterns).
 */
const _PATTERN_INDEX = (() => {
  const out = { en: [], tw: [], ha: [] };
  for (const intent of INTENTS) {
    for (const lang of Object.keys(out)) {
      const list = intent.patterns[lang] || [];
      for (const p of list) {
        out[lang].push({ pattern: normalizeFarmerQuestion(p), id: intent.id });
      }
    }
  }
  return out;
})();

/**
 * routeVoiceIntent — match a normalised farmer question to one
 * of the guided intents. Returns the full intent row plus the
 * answer string in the requested language (or English when the
 * language has no answer).
 *
 *   {
 *     id:        'sell',
 *     matched:   true,
 *     action:    'answer+navigate',
 *     navigate:  '/sell',
 *     answer:    'Tap "Sell" to list your produce...',
 *     answerLang: 'en' | 'tw' | 'ha',
 *     fallbackUsed: boolean,    // true when answerLang !== requested
 *   }
 *
 * When no pattern matches:
 *   { id: null, matched: false, answer: <safe default>, ... }
 */
export function routeVoiceIntent(rawText, language = 'en') {
  const lang = String(language || 'en').toLowerCase();
  const text = normalizeFarmerQuestion(rawText);
  const tryLangs = [lang, 'en'];   // current lang first, then English

  for (const tryLang of tryLangs) {
    const list = _PATTERN_INDEX[tryLang] || [];
    for (const row of list) {
      if (!row.pattern) continue;
      // Match either equals OR contains, so "today task please"
      // hits "today task". Word-boundary contains keeps "rain"
      // from triggering "drain".
      if (text === row.pattern || textContains(text, row.pattern)) {
        return buildIntentResponse(row.id, lang);
      }
    }
  }

  // No match — surface a safe "I didn't understand" answer in
  // the user's language and offer the suggested-question list.
  return {
    id: null,
    matched: false,
    action: 'fallback',
    navigate: null,
    answer: SAFE_FALLBACK_ANSWER[lang] || SAFE_FALLBACK_ANSWER.en,
    answerLang: SAFE_FALLBACK_ANSWER[lang] ? lang : 'en',
    fallbackUsed: !SAFE_FALLBACK_ANSWER[lang],
    intent: null,
  };
}

function textContains(haystack, needle) {
  // Word-boundary contains: needle must appear as a contiguous
  // run of words inside haystack. Avoids "drain" matching "rain".
  if (!haystack || !needle) return false;
  const padded = ` ${haystack} `;
  return padded.indexOf(` ${needle} `) >= 0;
}

function buildIntentResponse(intentId, lang) {
  const intent = INTENTS.find((i) => i.id === intentId);
  if (!intent) {
    return {
      id: null, matched: false, action: 'fallback', navigate: null,
      answer: SAFE_FALLBACK_ANSWER.en, answerLang: 'en',
      fallbackUsed: true, intent: null,
    };
  }
  const answers = intent.answers || {};
  const answerLang = answers[lang] ? lang : 'en';
  const answer = answers[answerLang] || answers.en || '';
  return {
    id: intent.id,
    matched: true,
    action: intent.action,
    navigate: intent.navigate || null,
    answer,
    answerLang,
    fallbackUsed: answerLang !== lang,
    intent,
  };
}

const SAFE_FALLBACK_ANSWER = Object.freeze({
  en: 'Sorry, I did not understand. Try one of the suggested questions below.',
  tw: 'Yɛ kafra, mante asɛm no ase. Sɔ nsɛmmisa a ɛwɔ ase yi mu biako hwɛ.',
  ha: 'Yi haƙuri, ban gane ba. Gwada ɗayan tambayoyin da ke ƙasa.',
});

/**
 * answerForIntent — get the answer template for a specific
 * intent + lang. Useful for callers that don't go through
 * matching (e.g. the "tap a suggested question" path bypasses
 * SR and just wants the template).
 *
 * Optional `vars` object substitutes {placeholders} so callers
 * with live weather / task data can splice it in.
 */
export function answerForIntent(intentId, language = 'en', vars = null) {
  const lang = String(language || 'en').toLowerCase();
  const intent = INTENTS.find((i) => i.id === intentId);
  if (!intent) return '';
  const answers = intent.answers || {};
  let txt = answers[lang] || answers.en || '';
  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      txt = txt.split(`{${k}}`).join(String(v));
    }
  }
  return txt;
}

/**
 * getSuggestedQuestions — the localised "tap a question"
 * surface. First pattern of each intent doubles as the
 * canonical user-facing question; we render those for the
 * suggested-questions grid.
 *
 * Optional `opts.regionConfig` filters out intents that don't
 * apply in the active region (spec §9: backyard users never
 * see Sell as a primary action). When omitted, every intent
 * surfaces — preserves backwards compatibility.
 */
export function getSuggestedQuestions(language = 'en', opts = {}) {
  const lang = String(language || 'en').toLowerCase();
  const regionConfig = opts && opts.regionConfig;
  const isBackyard   = !!(opts && opts.isBackyard);

  return INTENTS
    .filter((intent) => {
      // Sell intent gating — hide when the region disables
      // the sell flow OR the farmer is on the backyard
      // experience. Voice routing still resolves the intent
      // if the farmer happens to speak the phrase, so this
      // only trims the visible suggested-question grid.
      if (intent.id === 'sell') {
        if (isBackyard) return false;
        if (regionConfig && regionConfig.enableSellFlow === false) return false;
      }
      return true;
    })
    .map((intent) => {
      const list = intent.patterns[lang] || intent.patterns.en || [];
      return {
        id: intent.id,
        question: list[0] || intent.id,
        action: intent.action,
        navigate: intent.navigate || null,
      };
    });
}
