/**
 * server/src/modules/auth/federation/secretsResolver.js —
 * Thin abstraction over the secrets backend (Vault / Railway
 * env / AWS Secrets Manager / file).
 *
 * Contract
 * ────────
 *   The federation provider table stores `clientSecretRef`
 *   strings — NEVER the literal secret. This module is the
 *   ONE PLACE the runtime resolves a reference into the
 *   actual secret material at request time. The resolved
 *   secret NEVER leaves this module's stack frame: it's
 *   passed straight to the OIDC token-exchange call and
 *   discarded.
 *
 * Until the supervised deploy wires a backend, the resolver
 * returns { ok: false, reason: 'secrets_store_not_configured' }
 * which the federation routes surface as a 503 with the
 * canonical pending-migration reason.
 *
 * Strict-rule audit
 *   • Server-side .js module (no cross-tree TS imports).
 *   • Self-contained. No fetch from this module at the default
 *     resolver — backend resolvers must be registered.
 *   • NEVER logs secret values. The result envelope never
 *     includes the secret in its toString / JSON form; the
 *     caller must call `consume(token => ...)` to use it.
 *   • Fail-closed: missing inputs → deny.
 */

'use strict';

const SECRETS_RESOLVER_VERSION = 'farroway-secrets-resolver-v1';

/**
 * Module-state registry of registered backend resolvers.
 * Each resolver is an async function:
 *   (ref: string) => Promise<{ ok, secret?, reason? }>
 */
const _resolvers = Object.create(null);

/**
 * Register a backend resolver. The supervised deploy wires
 * Vault / Railway env / AWS Secrets Manager here. Idempotent
 * on the same kind name.
 */
function registerSecretsResolver(kind, fn) {
  if (typeof kind !== 'string' || !kind) return false;
  if (typeof fn !== 'function') return false;
  _resolvers[kind] = fn;
  return true;
}

function listRegisteredResolvers() {
  return Object.freeze(Object.keys(_resolvers).slice());
}

/**
 * Resolve a clientSecretRef into a `consume(fn)` envelope.
 * Caller MUST use the consume API — the secret is never
 * exposed as a plain string property.
 *
 *   const handle = await resolveClientSecret(ref);
 *   if (!handle.ok) return res.status(503)...;
 *   const tokenResp = await handle.consume(async (secret) => {
 *     // secret is in scope ONLY inside this callback.
 *     return await exchangeCode(code, secret);
 *   });
 *
 * If no resolver is registered for the ref's kind, returns
 * { ok: false, reason: 'secrets_store_not_configured' }.
 */
async function resolveClientSecret(clientSecretRef) {
  if (typeof clientSecretRef !== 'string' || !clientSecretRef) {
    return Object.freeze({
      runtimeVersion: SECRETS_RESOLVER_VERSION,
      ok: false, reason: 'clientSecretRef_required',
    });
  }
  // Ref format: <kind>:<key>  e.g. "vault:farroway/oidc/acme"
  //                                "railway-env:OIDC_ACME_SECRET"
  //                                "file:/secrets/acme.txt"
  const colonAt = clientSecretRef.indexOf(':');
  const kind = colonAt > 0 ? clientSecretRef.slice(0, colonAt) : '';
  if (!kind) {
    return Object.freeze({
      runtimeVersion: SECRETS_RESOLVER_VERSION,
      ok: false, reason: 'clientSecretRef_malformed',
    });
  }
  const fn = _resolvers[kind];
  if (typeof fn !== 'function') {
    return Object.freeze({
      runtimeVersion: SECRETS_RESOLVER_VERSION,
      ok: false, reason: 'secrets_store_not_configured',
      kind,
    });
  }
  let inner;
  try {
    inner = await fn(clientSecretRef);
  } catch (e) {
    return Object.freeze({
      runtimeVersion: SECRETS_RESOLVER_VERSION,
      ok: false, reason: 'resolver_threw',
    });
  }
  if (!inner || inner.ok !== true || typeof inner.secret !== 'string') {
    return Object.freeze({
      runtimeVersion: SECRETS_RESOLVER_VERSION,
      ok: false,
      reason: (inner && typeof inner.reason === 'string')
        ? inner.reason : 'resolver_returned_no_secret',
    });
  }
  // Wrap in a consume API so the secret never lives on the
  // envelope as a serialisable field.
  const _secret = inner.secret;
  return Object.freeze({
    runtimeVersion: SECRETS_RESOLVER_VERSION,
    ok: true, kind,
    async consume(use) {
      if (typeof use !== 'function') return undefined;
      try { return await use(_secret); }
      finally { /* _secret stays in this closure only */ }
    },
    // The envelope INTENTIONALLY does not include `secret`.
    // JSON.stringify of this object will not leak it.
  });
}

/** Diagnostic — caller can ask "is any backend wired?" without
 *  resolving anything. Returns frozen snapshot. */
function secretsResolverSnapshot() {
  return Object.freeze({
    runtimeVersion: SECRETS_RESOLVER_VERSION,
    backendsRegistered: listRegisteredResolvers(),
    configured: Object.keys(_resolvers).length > 0,
    failClosed: true,
  });
}

/** Test-only — wipe registry. */
function _resetSecretsResolvers() {
  for (const k of Object.keys(_resolvers)) delete _resolvers[k];
}

module.exports = {
  SECRETS_RESOLVER_VERSION,
  registerSecretsResolver,
  resolveClientSecret,
  listRegisteredResolvers,
  secretsResolverSnapshot,
  _resetSecretsResolvers,
};
