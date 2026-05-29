/**
 * src/runtime/auth/federation/OIDCRuntime.ts — Pure OIDC
 * provider-config validator + authorization-URL builder.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • No fetch, no token storage, no client-secret reads.
 *   • Returns frozen envelopes only.
 *   • Authorization-URL builder ONLY uses public params
 *     (clientId, redirectUri, state); never the client secret.
 */

import {
  FEDERATION_RUNTIME_VERSION, FED_VERDICT, FED_DENY_REASON,
} from './federationContracts';

export const OIDC_RUNTIME_VERSION = 'oidc-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const HTTPS_RE = /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/i;

export interface OIDCProviderConfig {
  /** Provider issuer URL — MUST be HTTPS in production. */
  issuer:         string;
  /** OAuth client id — public, OK to include in URLs. */
  clientId:       string;
  /** Reference key to the client secret in a secrets store —
   *  NEVER the secret itself. Runtime DOES NOT read this. */
  clientSecretRef?: string;
  /** Hosted org domain hint (e.g. "acme.com"). */
  domainHint?:    string;
  /** Per-provider scope override; defaults to OIDC standard. */
  scope?:         string;
}

interface ValidateResult {
  ok:      boolean;
  reason:  string;
}

/**
 * Validate the shape of an OIDC provider config without
 * touching the network. Used by the API route before storing
 * a new provider, and by the diagnostic at runtime.
 */
export function validateOIDCConfig(cfg: Partial<OIDCProviderConfig>) {
  return _safe(() => {
    if (!_isObj(cfg)) {
      return _v(false, FED_DENY_REASON.PROVIDER_NOT_CONFIGURED);
    }
    const issuer = _str(cfg.issuer);
    if (!issuer || !HTTPS_RE.test(issuer)) {
      return _v(false, FED_DENY_REASON.ISSUER_INVALID);
    }
    if (!_str(cfg.clientId)) {
      return _v(false, FED_DENY_REASON.CLIENT_ID_MISSING);
    }
    return _v(true, '');
  }, _v(false, FED_DENY_REASON.FAIL_CLOSED));
}

function _v(ok: boolean, reason: string): ValidateResult {
  return Object.freeze({
    runtimeVersion: OIDC_RUNTIME_VERSION,
    ok, reason,
    verdict: ok ? FED_VERDICT.ALLOW : FED_VERDICT.DENY,
  }) as unknown as ValidateResult;
}

interface AuthURLCtx {
  issuer:        string;
  clientId:      string;
  redirectUri:   string;
  state:         string;
  scope?:        string;
  responseType?: 'code' | 'id_token';
  /** Optional PKCE challenge — recommended for SPA flows. */
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
}

/**
 * Construct the authorization URL using ONLY public params.
 * Returns '' on validation failure (caller treats as a deny).
 */
export function buildAuthorizationURL(ctx: AuthURLCtx): string {
  return _safe(() => {
    if (!_isObj(ctx)) return '';
    const v = validateOIDCConfig({
      issuer: ctx.issuer, clientId: ctx.clientId,
    });
    if (!(v as any).ok) return '';
    const redirect = _str(ctx.redirectUri);
    const state    = _str(ctx.state);
    if (!redirect || !state) return '';
    const params = new URLSearchParams();
    params.set('response_type', _str(ctx.responseType) || 'code');
    params.set('client_id',     _str(ctx.clientId));
    params.set('redirect_uri',  redirect);
    params.set('scope',         _str(ctx.scope) || 'openid email profile');
    params.set('state',         state);
    if (_str(ctx.codeChallenge)) {
      params.set('code_challenge',        _str(ctx.codeChallenge));
      params.set('code_challenge_method', _str(ctx.codeChallengeMethod) || 'S256');
    }
    // Trim trailing slash from issuer to avoid double-/.
    const base = _str(ctx.issuer).replace(/\/+$/, '');
    return base + '/authorize?' + params.toString();
  }, '');
}

export function oidcSnapshot() {
  return Object.freeze({
    runtimeVersion:         OIDC_RUNTIME_VERSION,
    federationVersion:      FEDERATION_RUNTIME_VERSION,
    authorizationUrlReady:  true,
    validatorReady:         true,
    failClosed:             true,
    /** Honest declaration — this runtime DOES NOT read or store
     *  client secrets. Secret refs are persisted to the server-
     *  side store; the runtime never touches them. */
    handlesClientSecrets:   false,
  });
}
