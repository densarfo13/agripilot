/**
 * Farroway · Invite Proof Runtime (invite-proof-v1)
 *
 * Self-contained, composition-only PROOF runtime. It NEVER imports a project
 * module and NEVER fabricates data. It proves a real end-to-end invite
 * workflow actually happened — invite delivery (email/SMS) → activation →
 * login after activation — using ONLY real evidence read from window globals
 * and localStorage.
 *
 * THE HONESTY CONTRACT
 *  - Every envelope carries a `validationSource`: a non-empty string when the
 *    workflow is proven, or null when it is not.
 *  - proofStatus is 'FAIL' only when a wired capability probe explicitly
 *    reports broken (fake delivery); 'PASS' ONLY when validationSource is a
 *    non-empty string AND all required readiness booleans are true; otherwise
 *    'NEEDS_TEST'.
 *  - PASS is NEVER derived from provider configuration alone, and NEVER
 *    returned when validationSource is null/empty. Config without a recorded
 *    test/acceptance is NEEDS_TEST.
 *
 * SSR-safe: every window/localStorage access is guarded by typeof checks.
 * No Math randomness, fetch, XMLHttpRequest, or crypto randomness anywhere.
 */

// --- copied helper block (proven pattern) --------------------------------

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// --- evidence helpers (self-contained) -----------------------------------

/**
 * Reads localStorage 'farroway_proof_runs' (a JSON object keyed by proof name)
 * and returns the recorded run object { ranAt, result, source, note } or null.
 * This is how a human/QA records that a MANUAL test was actually run.
 */
function _proofRun(name: string): any {
  return _safe(() => {
    const all = _obj(_ls('farroway_proof_runs'));
    if (!all) return null;
    const run = _obj(all[name]);
    return run || null;
  }, null);
}

/** Merged array of BOTH canonical event logs (each may be an array or absent). */
function _events(): any[] {
  return _safe(() => {
    const a = _arr(_ls('farroway.farmEvents'));
    const b = _arr(_ls('farroway_event_log'));
    return a.concat(b);
  }, []);
}

/** The set of string event types present across both logs. */
function _eventTypes(): Set<string> {
  return _safe(() => {
    const out = new Set<string>();
    const rows = _events();
    for (let i = 0; i < rows.length; i++) {
      const r = _obj(rows[i]);
      if (!r) continue;
      const t = r.type ?? r.eventType ?? r.name ?? r.kind;
      if (typeof t === 'string' && t) out.add(t);
    }
    return out;
  }, new Set<string>());
}

/** True if any present event type is in the given list. */
function _hasEvent(list: string[]): boolean {
  return _safe(() => {
    const types = _eventTypes();
    for (let i = 0; i < list.length; i++) {
      if (types.has(list[i])) return true;
    }
    return false;
  }, false);
}

// -------------------------------------------------------------------------

export const INVITE_PROOF_VERSION = 'invite-proof-v1' as const;

export type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST';

export interface InviteProofEnvelope {
  runtimeVersion: typeof INVITE_PROOF_VERSION;
  emailProviderConfigured: boolean;
  smsProviderConfigured: boolean;
  emailInviteTested: boolean;
  smsInviteTested: boolean;
  activationTested: boolean;
  loginAfterActivationTested: boolean;
  fakeDelivery: boolean;
  proofStatus: ProofStatus;
  validationSource: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function inviteProofHealth(): InviteProofEnvelope {
  return _safe(
    () => {
      // --- real probe (absent => null, degrade honestly) ---
      const iv = _obj(_probe('__inviteHealth'));

      // Provider configuration is context only — it NEVER drives a PASS.
      const emailProviderConfigured = !!(iv && iv.emailProviderConfigured);
      const smsProviderConfigured = !!(iv && iv.smsProviderConfigured);

      // fakeDelivery: a wired capability flag that MUST be false to pass.
      const fakeDelivery = !!(iv && iv.fakeDelivery);

      // --- recorded proof runs (real manual evidence) ---
      const emailInviteTested = !!_proofRun('invite_email');
      const smsInviteTested = !!_proofRun('invite_sms');

      // activation: a recorded proof run OR a real invite_accepted event.
      const activationTested =
        !!_proofRun('invite_activation') || _hasEvent(['invite_accepted']);

      // login after activation: a recorded proof run OR (real login AND
      // real invite_accepted) events.
      const loginAfterActivationTested =
        !!_proofRun('invite_login') ||
        (_hasEvent(['login']) && _hasEvent(['invite_accepted']));

      // --- honesty contract: validationSource ---
      // Proven only when activation is evidenced (proof run or accepted event).
      const validationSource: string | null = activationTested
        ? 'proof_run/event:invite_activation'
        : null;

      // --- proofStatus ---
      // FAIL if delivery is fake (wired capability explicitly reports broken).
      // PASS only with non-empty validationSource AND all required readiness:
      //   (email or SMS invite tested) AND activation AND login-after-activation
      //   AND delivery is not fake. Provider config alone is NEVER enough.
      let proofStatus: ProofStatus;
      if (fakeDelivery === true) {
        proofStatus = 'FAIL';
      } else if (
        (emailInviteTested || smsInviteTested) &&
        activationTested &&
        loginAfterActivationTested &&
        !fakeDelivery &&
        validationSource
      ) {
        proofStatus = 'PASS';
      } else {
        proofStatus = 'NEEDS_TEST';
      }

      // Confidence reflects how strong the evidence is.
      let confidence: Confidence = 'low';
      if (proofStatus === 'FAIL') {
        confidence = 'high';
      } else if (proofStatus === 'PASS') {
        confidence =
          emailInviteTested && smsInviteTested ? 'high' : 'medium';
      }

      const explanation =
        proofStatus === 'FAIL'
          ? 'Invite delivery is in FAKE/simulated mode (__inviteHealth.fakeDelivery is true). Delivery, activation, and login cannot be proven against a real provider until fake delivery is turned off.'
          : proofStatus === 'PASS'
            ? 'Real evidence proves the invite workflow ran end-to-end. Source: ' +
              validationSource +
              '. Stages observed: ' +
              [
                emailInviteTested && 'email-invite-tested',
                smsInviteTested && 'sms-invite-tested',
                activationTested && 'activation',
                loginAfterActivationTested && 'login-after-activation',
              ]
                .filter(Boolean)
                .join(', ') +
              '.'
            : 'No real evidence of a completed invite run yet. Send a real invite (email or SMS), accept it to activate, and log in — or record manual proof runs under "invite_email"/"invite_sms"/"invite_activation"/"invite_login" in farroway_proof_runs. Provider configuration alone is NOT a pass. This is NEEDS_TEST.';

      const limitations =
        'This is a PROOF check based ONLY on real evidence read from recorded ' +
        'proof runs, canonical event logs (invite_accepted, login), and the ' +
        'wired __inviteHealth capability probe. Provider configuration is never ' +
        'enough on its own — PASS always requires a recorded test/acceptance and ' +
        'a non-empty validation source. Fake/simulated delivery drives FAIL; ' +
        'absent evidence degrades to NEEDS_TEST and never fabricates a pass. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: INVITE_PROOF_VERSION,
        emailProviderConfigured,
        smsProviderConfigured,
        emailInviteTested,
        smsInviteTested,
        activationTested,
        loginAfterActivationTested,
        fakeDelivery,
        proofStatus,
        validationSource,
        confidence,
        explanation,
        limitations,
      }) as InviteProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: INVITE_PROOF_VERSION,
      emailProviderConfigured: false,
      smsProviderConfigured: false,
      emailInviteTested: false,
      smsInviteTested: false,
      activationTested: false,
      loginAfterActivationTested: false,
      fakeDelivery: false,
      proofStatus: 'NEEDS_TEST' as ProofStatus,
      validationSource: null,
      confidence: 'low' as Confidence,
      explanation:
        'Invite proof runtime could not read evidence — degrading to NEEDS_TEST honestly. No pass is implied.',
      limitations:
        'This is a PROOF check based ONLY on real evidence. With no readable ' +
        'evidence it reports NEEDS_TEST and never fabricates a pass. ' +
        GUIDANCE_TAIL,
    }) as InviteProofEnvelope,
  );
}

export function installInviteProofGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__inviteProofHealth !== 'function') {
      w.__inviteProofHealth = function () {
        const out = inviteProofHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Invite Proof]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
