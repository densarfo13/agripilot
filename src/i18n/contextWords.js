/**
 * contextWords.js — vocabulary + icon + copy mappings keyed on the
 * active growing context. Spec: "Polish Farm vs Garden Experience"
 * (§1, §2, §5, §6, §7).
 *
 *   import { getContextWord, getContextLabel, getContextIcon,
 *            getContextEmptyState, getContextProgressLabel,
 *          } from '../i18n/contextWords.js';
 *
 *   getContextWord('plant', 'farm')     // → 'crop'
 *   getContextWord('soil',  'garden')   // → 'soil'
 *   getContextLabel({ type: 'garden', name: 'Tomato' })
 *                                        // → '\u{1F331} Tomato Garden'
 *   getContextLabel({ type: 'farm',   name: 'Maize'  })
 *                                        // → '\u{1F69C} Maize Farm'
 *   getContextEmptyState('garden')      // → 'Add a plant to get started'
 *   getContextProgressLabel('farm')     // → 'Field inspection completed'
 *
 * Why this exists
 * ───────────────
 * The pilot turned up subtle vocabulary mixing — a backyard user
 * seeing "scout your field" copy, a farm user seeing "check your
 * pots" — because copy was scattered across components without a
 * single source of truth for "which word do we use right now?"
 * This module centralises the mapping so:
 *   • adding a new word is a one-line change instead of a sweep;
 *   • a missed call site falls through to the safe English
 *     fallback rather than the wrong vocabulary;
 *   • the mapping itself can be unit-tested with no UI in scope.
 *
 * Scope
 *   This file owns VOCABULARY only. Engine rule text (priority +
 *   tasks) stays inside dailyPlanEngine.js where the recipes live.
 *   This module gives leaf components (HomeContextSwitcher,
 *   ContextLabel, Progress page, manage screens) a way to render
 *   the right word without re-encoding the garden/farm split each
 *   time.
 *
 * Strict-rule audit
 *   • Pure functions. No I/O, no side effects.
 *   • Never throws. Unknown context types collapse to the safe
 *     'farm' fallback so callers always get a usable string.
 *   • Idempotent. Identical inputs → identical outputs.
 *   • All English fallbacks ship inline; the i18n layer can map
 *     translation keys onto the same shape later.
 */

/**
 * Vocabulary buckets — every word the spec calls out.
 * Each entry returns { garden, farm } so callers can pull either
 * side or pass a context string to getContextWord().
 *
 * The keys are the GARDEN-side words (the canonical "small home
 * scale" vocabulary). When called with context='farm', we return
 * the farm-side replacement; with context='garden', we return the
 * key itself. This keeps callers reading naturally:
 *
 *   getContextWord('plant', context)   // 'plant' (garden) | 'crop' (farm)
 *   getContextWord('soil',  context)   // 'soil'  (garden) | 'soil' (farm \u2014 shared)
 *   getContextWord('pot',   context)   // 'pot'   (garden) | 'row'  (farm)
 *
 * Words that are shared (e.g. 'soil', 'water') return the same
 * string for both contexts \u2014 spec §2 only calls out the divergent
 * pairs; the shared vocabulary stays unified so we don't invent
 * fake distinctions.
 */
const WORDS = Object.freeze({
  // Spec §2 explicit pairs ───────────────────────────────────────
  plant:    { garden: 'plant',    farm: 'crop'      },
  pot:      { garden: 'pot',      farm: 'row'       },
  garden:   { garden: 'garden',   farm: 'farm'      },
  // Inverse direction so callers can also read from the farm side.
  crop:     { garden: 'plant',    farm: 'crop'      },
  field:    { garden: 'pot',      farm: 'field'     },
  rows:     { garden: 'pots',     farm: 'rows'      },
  scouting: { garden: 'checking', farm: 'scouting'  },

  // Shared vocabulary \u2014 same word in both contexts. Surfaced here
  // so a caller doesn't have to know which words are shared vs
  // split; the helper handles it.
  soil:     { garden: 'soil',     farm: 'soil'      },
  water:    { garden: 'water',    farm: 'water'     },
  leaves:   { garden: 'leaves',   farm: 'leaves'    },
});

/**
 * Empty-state copy per spec §6. Returned as a single ready-to-
 * render string; callers can wrap in tSafe() at the call site if
 * they want a translated key path.
 */
const EMPTY_STATES = Object.freeze({
  garden: 'Add a plant to get started',
  farm:   'Add your farm to begin tracking',
});

/**
 * Progress-page labels per spec §5. Same return shape as
 * EMPTY_STATES \u2014 plain English strings.
 */
const PROGRESS_LABELS = Object.freeze({
  garden: 'Plants checked today',
  farm:   'Field inspection completed',
});

/**
 * Spec §1 + §7 \u2014 context icons. The "primary" icon is the
 * context label prefix; the "set" is a 3-emoji palette callers
 * can use for badges, chips, illustration accents, etc.
 *
 *   garden \u2192 \uD83C\uDF31 (primary), \uD83C\uDF3F leaf, \uD83E\uDEB4 potted plant
 *   farm   \u2192 \uD83D\uDE9C (primary), \uD83C\uDF3E sheaf,    \uD83D\uDCCA chart
 */
const ICONS = Object.freeze({
  garden: {
    primary: '\uD83C\uDF31',
    set: ['\uD83C\uDF31', '\uD83C\uDF3F', '\uD83E\uDEB4'],
  },
  farm: {
    primary: '\uD83D\uDE9C',
    set: ['\uD83D\uDE9C', '\uD83C\uDF3E', '\uD83D\uDCCA'],
  },
});

function _normalise(context) {
  // Accept either 'garden'/'farm' directly OR a row-shaped object
  // with a `type` field (per the data-model spec). Anything else
  // collapses to 'farm' which is the safer default \u2014 farm copy
  // works on a garden surface ("crop" reads sensibly to a farmer
  // even if they're growing at home), but garden copy on a real
  // farm surface ("plant" instead of "crop") looks dismissive.
  if (context === 'garden' || context === 'farm') return context;
  if (context && typeof context === 'object') {
    if (context.type === 'garden' || context.type === 'farm') return context.type;
    if (context.activeContextType === 'garden' || context.activeContextType === 'farm') {
      return context.activeContextType;
    }
  }
  return 'farm';
}

/**
 * getContextWord(key, context) → string
 *
 * Returns the right vocabulary word for the active context. Falls
 * back to the input key when the entry is unknown so callers can
 * pass any string and still get something usable.
 */
export function getContextWord(key, context) {
  const ctx = _normalise(context);
  const k = String(key || '').toLowerCase();
  const entry = WORDS[k];
  if (entry && entry[ctx]) return entry[ctx];
  // Unknown key \u2014 return the input verbatim so a missed mapping
  // doesn't blank a label.
  return k || '';
}

/**
 * getContextLabel({ type, name }) → '\uD83C\uDF31 Tomato Garden'  | '\uD83D\uDE9C Maize Farm'
 *
 * Spec §1 \u2014 the canonical context display label. Used at the top
 * of HomeContextSwitcher, ManageGardens / ManageFarms titles, and
 * any future "currently working on:" surface.
 *
 * @param {object} input
 * @param {string} input.type  'garden' | 'farm'
 * @param {string} [input.name] entity display name (plant or crop label)
 * @returns {string}
 */
export function getContextLabel({ type, name } = {}) {
  const ctx = _normalise(type);
  const icon = ICONS[ctx].primary;
  const safeName = String(name || '').trim();
  // Title-case the name so 'tomato' → 'Tomato'. Multi-word names
  // ('butter beans') get each word capitalised.
  const titled = safeName
    ? safeName.replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const suffix = ctx === 'garden' ? 'Garden' : 'Farm';
  return titled
    ? `${icon} ${titled} ${suffix}`
    : `${icon} ${ctx === 'garden' ? 'My Garden' : 'My Farm'}`;
}

/**
 * getContextIcon(context, slot) → emoji string
 *
 * Slot defaults to 'primary'. Use 'palette' to get the 3-emoji
 * array (garden: \uD83C\uDF31 \uD83C\uDF3F \uD83E\uDEB4 / farm: \uD83D\uDE9C \uD83C\uDF3E \uD83D\uDCCA).
 */
export function getContextIcon(context, slot = 'primary') {
  const ctx = _normalise(context);
  const set = ICONS[ctx];
  if (slot === 'palette' || slot === 'set') return set.set.slice();
  return set.primary;
}

/**
 * getContextEmptyState(context) → 'Add a plant to get started'
 *
 * Spec §6 \u2014 emptied-out manage screens render this single string.
 */
export function getContextEmptyState(context) {
  const ctx = _normalise(context);
  return EMPTY_STATES[ctx];
}

/**
 * getContextProgressLabel(context) → 'Plants checked today'
 *
 * Spec §5 \u2014 the progress page swaps its row label per context.
 */
export function getContextProgressLabel(context) {
  const ctx = _normalise(context);
  return PROGRESS_LABELS[ctx];
}

export const _internal = Object.freeze({ WORDS, EMPTY_STATES, PROGRESS_LABELS, ICONS });

export default {
  getContextWord,
  getContextLabel,
  getContextIcon,
  getContextEmptyState,
  getContextProgressLabel,
};
