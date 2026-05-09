/**
 * notificationPriority — three-tier ladder for the calm-intelligence
 * notification system (spec §10).
 *
 *   LOW       — informational; batch quietly, no push.
 *   NORMAL    — useful daily actions; in-app + opt-in push.
 *   IMPORTANT — weather risk / buyer interest / urgent timing;
 *               always delivered as soon as the timing window opens.
 *
 * RULES
 *   • No "critical danger" / "urgent" / "alert" wording — even
 *     IMPORTANT items use calm phrasing.
 *   • Pure constants + helpers; never throws; SSR-safe.
 */

export const PRIORITY = Object.freeze({
  LOW:       'low',
  NORMAL:    'normal',
  IMPORTANT: 'important',
});

// Map a priority tier to its delivery contract. Consumed by the
// scheduler + push transport; the structure is intentionally
// flat so router code can read it without a translator.
export const PRIORITY_CONTRACT = Object.freeze({
  [PRIORITY.LOW]: Object.freeze({
    canPush:        false,    // never push — appears in-app only
    canBatch:       true,     // grouped into a single calm card
    overrideQuiet:  false,    // respects quiet hours
    timeoutDays:    3,        // expires from the in-app feed after 3 days
  }),
  [PRIORITY.NORMAL]: Object.freeze({
    canPush:        true,
    canBatch:       false,
    overrideQuiet:  false,
    timeoutDays:    2,
  }),
  [PRIORITY.IMPORTANT]: Object.freeze({
    canPush:        true,
    canBatch:       false,
    // IMPORTANT can deliver during quiet hours ONLY when the
    // window opens at the next "morning" tick — see scheduler.
    // We never wake a user at 2 AM.
    overrideQuiet:  false,
    timeoutDays:    1,
  }),
});

/**
 * Coerce arbitrary input to one of the three tiers. Anything
 * unknown falls to NORMAL — never IMPORTANT (we'd rather under-
 * notify than wake someone for a misclassified message).
 *
 * @param {string|null} v
 * @returns {'low'|'normal'|'important'}
 */
export function normalizePriority(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'low')       return PRIORITY.LOW;
  if (s === 'important') return PRIORITY.IMPORTANT;
  if (s === 'urgent' || s === 'critical' || s === 'alert') return PRIORITY.IMPORTANT;
  return PRIORITY.NORMAL;
}

/**
 * @param {string} priority
 * @returns {{canPush:boolean,canBatch:boolean,overrideQuiet:boolean,timeoutDays:number}}
 */
export function priorityContract(priority) {
  return PRIORITY_CONTRACT[normalizePriority(priority)] || PRIORITY_CONTRACT[PRIORITY.NORMAL];
}

const _module = { PRIORITY, PRIORITY_CONTRACT, normalizePriority, priorityContract };
export default _module;
