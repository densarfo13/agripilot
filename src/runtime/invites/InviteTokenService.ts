/**
 * src/runtime/invites/InviteTokenService.ts — pure token generation
 * + hashing. Composition over the Web Crypto API.
 *
 * Strict-rule audit
 *   • NEVER persists the raw token; only emits {raw, hash} and the
 *     caller is responsible for sending raw via email/SMS and
 *     storing hash only.
 *   • Pure on the hash side. The token-generation side uses
 *     crypto.getRandomValues — non-deterministic by design.
 *   • SSR-safe — uses isomorphic fallbacks when crypto is absent.
 *   • Never throws.
 */

const _safe = <T,>(fn: () => Promise<T>, fb: T): Promise<T> =>
  fn().catch(() => fb);

function _hex(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    out.push(h.length === 1 ? '0' + h : h);
  }
  return out.join('');
}

/**
 * generateToken — produces a 32-byte random token, base64url-encoded.
 * The CALLER is responsible for sending this raw value via the
 * email/SMS provider and NEVER persisting it. Only the hash
 * (computed via hashToken below) goes into storage.
 *
 * Returns '' on environments without crypto.getRandomValues
 * (extremely rare; would only happen in non-browser SSR shells).
 */
export function generateToken(): string {
  try {
    if (typeof crypto !== 'undefined'
        && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(32);
      crypto.getRandomValues(buf);
      // base64url
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      let b64 = '';
      try { b64 = btoa(bin); }
      catch {
        // Node fallback
        const Buf: any = (globalThis as any).Buffer;
        if (Buf && typeof Buf.from === 'function') {
          b64 = Buf.from(buf).toString('base64');
        }
      }
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
  } catch { /* swallow */ }
  return '';
}

/**
 * hashToken — SHA-256 over the raw token; returns lowercase hex.
 * Pure (deterministic) given the same input. Used both at
 * creation time (to derive the persisted hash) and at acceptance
 * time (to verify a candidate token against the stored hash).
 *
 * Falls back to '' on environments without WebCrypto.
 */
export async function hashToken(raw: string): Promise<string> {
  return _safe(async () => {
    if (typeof raw !== 'string' || !raw) return '';
    if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
      const enc = new TextEncoder().encode(raw);
      const hashBuf = await (crypto as any).subtle.digest('SHA-256', enc);
      return _hex(new Uint8Array(hashBuf));
    }
    return '';
  }, '');
}

/**
 * maskDestination — pure email/phone masker for the persisted
 * destination field. Returns 'a***@example.com' style for
 * emails and '+233***1234' for phone numbers.
 */
export function maskDestination(raw: string): string {
  if (typeof raw !== 'string' || !raw) return '';
  // Email
  if (raw.includes('@')) {
    const [local, domain] = raw.split('@');
    if (!local || !domain) return '***@***';
    const first = local.charAt(0);
    return `${first}***@${domain}`;
  }
  // Phone — keep first 4 chars (often country code + first digit)
  // and last 4. Mask the middle.
  if (raw.length <= 8) return '***';
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
}

export const INVITE_TOKEN_SERVICE_VERSION = 'invite-token-service-v1';
