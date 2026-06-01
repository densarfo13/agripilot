/**
 * SimpleModeContracts.ts — pure types + constants for the action-first
 * Simple Mode UI. NO window global. NO install function.
 *
 * Zero imports, frozen exports, never throws.
 *
 * > Decision support, not a guarantee. Action first, jargon never.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const SIMPLE_MODE_CONTRACTS_VERSION = 'simple-mode-contracts-v1' as const;

// ── core unions ──────────────────────────────────────────────────────────
export type WhenLabel = 'today' | 'tomorrow' | 'in_3_days' | 'this_week' | 'overdue';
export type Priority  = 'red' | 'yellow' | 'green' | 'blue';
export type Surface   = 'home' | 'scan' | 'task' | 'daily_plan' | 'post_harvest';

export const PRIORITY_COLORS: Readonly<Record<Priority, string>> = Object.freeze({
  red:    '#B91C1C',   // Do now
  yellow: '#B45309',   // Do soon
  green:  '#15803D',   // Good / monitor
  blue:   '#1D4ED8',   // Scan / check
});
export const PRIORITY_LABEL_KEYS: Readonly<Record<Priority, string>> = Object.freeze({
  red:    'simple.priority.doNow',
  yellow: 'simple.priority.doSoon',
  green:  'simple.priority.good',
  blue:   'simple.priority.scan',
});

// ── copy-length rules (§9) ───────────────────────────────────────────────
// Each rule is a HARD cap; the gate enforces these. The rules are inclusive
// of leading verbs but exclusive of trailing punctuation.
export const COPY_LIMITS = Object.freeze({
  action: 12,        // "Do this" verb phrase — 12 words max
  reason: 10,        // "Why" sentence — 10 words max
  whenLabel: 4,      // "When" chip — 4 words max ("In 3 days")
  buttonLabel: 4,    // button labels — 4 words max
  voicePrompt: 30,   // full voice prompt — 30 words max
});

// Words/regex the gate forbids in Simple Mode visible copy.
export const FORBIDDEN_PHRASES: ReadonlyArray<RegExp> = Object.freeze([
  /\bconfirmed\b/i,
  /\bguaranteed\b/i,
  /\b100%\b/,
  /\bdiagnosis\b/i,
  /\btaxonomy\b/i,
  /\bprovider\b/i,
  /\bconfidence\b/i,
  /\bintegrated disease management\b/i,
  /\bprotocol\b/i,
  /\bphenology\b/i,
] as ReadonlyArray<RegExp>);

// Required phrases the simple scan card uses — kept in one place.
export const SCAN_HEDGING_PHRASES: ReadonlyArray<string> = Object.freeze([
  'possible', 'likely', 'needs review', 'Not enough data',
]);

// ── action shape ─────────────────────────────────────────────────────────
export interface SimpleAction {
  id: string;
  surface: Surface;
  icon: string;                  // emoji or short glyph; never an image URL
  priority: Priority;
  // Translation keys + English defaults. The render site MUST call
  // tSafe(key, default). Hardcoded English without a key is a gate FAIL.
  actionKey: string;
  actionDefault: string;
  reasonKey: string;
  reasonDefault: string;
  whenKey: string;
  whenLabel: WhenLabel;
  whenDefault: string;
  // Action buttons — every action has at least a primary "Done" button.
  buttons: ReadonlyArray<{ id: string; labelKey: string; labelDefault: string; primary: boolean; }>;
  // Voice-first support (§7).
  voiceKey: string;
  voiceDefault: string;
  // Honest metadata — never surfaced as visible text; powers diagnostics.
  source: 'daily_plan' | 'scan' | 'task' | 'weather' | 'lifecycle' | 'post_harvest';
}

export interface ValidationResult { valid: boolean; reason?: string; }

/** Count words in a string (single-space-split, trimmed). */
function _wc(s: any): number {
  return _safe(() => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0), 0);
}

/**
 * Pure validator for a Simple Mode action. Returns valid:false with a
 * reason on any contract breach. The gates use this shape; the runtime
 * uses it to attest UI readiness.
 */
export function validateAction(candidate: any): ValidationResult {
  return _safe(() => {
    if (!candidate || typeof candidate !== 'object')
      return { valid: false, reason: 'no candidate' };
    const c = candidate as SimpleAction;
    if (!c.actionKey || typeof c.actionDefault !== 'string')
      return { valid: false, reason: 'missing action key/default' };
    if (!c.reasonKey || typeof c.reasonDefault !== 'string')
      return { valid: false, reason: 'missing reason key/default' };
    if (!c.whenKey || typeof c.whenDefault !== 'string')
      return { valid: false, reason: 'missing when key/default' };
    if (!Array.isArray(c.buttons) || c.buttons.length === 0)
      return { valid: false, reason: 'action must have at least one button' };
    if (!c.buttons.some((b) => b && b.primary))
      return { valid: false, reason: 'action must have a primary button' };
    // Copy length.
    if (_wc(c.actionDefault) > COPY_LIMITS.action)
      return { valid: false, reason: `action over ${COPY_LIMITS.action} words` };
    if (_wc(c.reasonDefault) > COPY_LIMITS.reason)
      return { valid: false, reason: `reason over ${COPY_LIMITS.reason} words` };
    if (_wc(c.whenDefault) > COPY_LIMITS.whenLabel)
      return { valid: false, reason: `when label over ${COPY_LIMITS.whenLabel} words` };
    if (_wc(c.voiceDefault) > COPY_LIMITS.voicePrompt)
      return { valid: false, reason: `voice prompt over ${COPY_LIMITS.voicePrompt} words` };
    for (const b of c.buttons) {
      if (_wc(b && b.labelDefault) > COPY_LIMITS.buttonLabel)
        return { valid: false, reason: `button "${b && b.id}" over ${COPY_LIMITS.buttonLabel} words` };
    }
    // Forbidden phrases.
    const blob = [c.actionDefault, c.reasonDefault, c.whenDefault, c.voiceDefault].join(' ');
    for (const re of FORBIDDEN_PHRASES) {
      if (re.test(blob)) return { valid: false, reason: `forbidden phrase: ${re.toString()}` };
    }
    return { valid: true };
  }, { valid: false, reason: 'validator threw' });
}

/** Build a frozen, defaults-applied skeleton. */
export function newSimpleAction(partial: Partial<SimpleAction>): Readonly<SimpleAction> {
  return _safe(() => Object.freeze({
    id: String(partial.id || ''),
    surface: (partial.surface || 'home') as Surface,
    icon: typeof partial.icon === 'string' ? partial.icon : '🌱',
    priority: (partial.priority || 'green') as Priority,
    actionKey: String(partial.actionKey || ''),
    actionDefault: String(partial.actionDefault || ''),
    reasonKey: String(partial.reasonKey || ''),
    reasonDefault: String(partial.reasonDefault || ''),
    whenKey: String(partial.whenKey || 'simple.when.today'),
    whenLabel: (partial.whenLabel || 'today') as WhenLabel,
    whenDefault: String(partial.whenDefault || 'Today'),
    buttons: Object.freeze(Array.isArray(partial.buttons) && partial.buttons.length > 0
      ? partial.buttons
      : [{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }]) as ReadonlyArray<any>,
    voiceKey: String(partial.voiceKey || ''),
    voiceDefault: String(partial.voiceDefault || ''),
    source: (partial.source || 'daily_plan') as any,
  }) as SimpleAction, Object.freeze({
    id: '', surface: 'home', icon: '🌱', priority: 'green',
    actionKey: '', actionDefault: '',
    reasonKey: '', reasonDefault: '',
    whenKey: 'simple.when.today', whenLabel: 'today', whenDefault: 'Today',
    buttons: Object.freeze([{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }]),
    voiceKey: '', voiceDefault: '',
    source: 'daily_plan',
  }) as SimpleAction);
}
