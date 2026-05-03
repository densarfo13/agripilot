/**
 * Farroway — API security harness (vitest, TypeScript).
 *
 *   npm run security:test
 *
 * Exercises the running Farroway backend over HTTP using
 * `fetch` (Node 18+). Every test maps to a row in
 * security-test-plan.md §2.
 *
 * Required env (see security-tests/README.md):
 *   API_BASE_URL              e.g. http://localhost:4000 or https://staging.farroway.app
 *   USER_A_FARMER_TOKEN
 *   USER_B_FARMER_TOKEN
 *   BUYER_TOKEN
 *   NGO_A_TOKEN
 *   NGO_B_TOKEN
 *   FIELD_AGENT_TOKEN
 *   PLATFORM_ADMIN_TOKEN
 *   INVALID_TOKEN             defaults to a known-bad string when unset
 *   USER_A_FARM_ID, USER_B_FARM_ID
 *   USER_A_SCAN_ID, USER_B_SCAN_ID
 *   PROGRAM_A_ID, PROGRAM_B_ID
 *   PRIVATE_LISTING_ID, PUBLIC_LISTING_ID
 *   UNASSIGNED_FARMER_ID
 *
 * Tests for which a required env var is unset are SKIPPED with
 * a clear message rather than failed — the README explains how
 * to provision them in staging.
 *
 * Strict-rule audit
 *   • Pre-flight refuses to run against the production apex.
 *   • Read-only by default; mutation tests are gated behind
 *     RUN_MUTATING_TESTS=true and clearly labelled.
 *   • Every response body is scanned for the leak patterns in
 *     security-test-plan.md §3 — a match fails the test even
 *     when the status code is "expected".
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ─── Pre-flight (test-plan §0) ────────────────────────────
const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
if (!API_BASE_URL) {
  throw new Error('API_BASE_URL is not set. Aborting security harness.');
}
if (/\/\/(?:www\.)?farroway\.app(?:[/:]|$)/.test(API_BASE_URL)) {
  throw new Error(
    `API_BASE_URL points at the production apex (${API_BASE_URL}). ` +
    'This harness is staging-only.'
  );
}

// ─── Env helpers ──────────────────────────────────────────
const TOKENS = {
  A:        process.env.USER_A_FARMER_TOKEN,
  B:        process.env.USER_B_FARMER_TOKEN,
  BUYER:    process.env.BUYER_TOKEN,
  NGO_A:    process.env.NGO_A_TOKEN,
  NGO_B:    process.env.NGO_B_TOKEN,
  FA:       process.env.FIELD_AGENT_TOKEN,
  ADMIN:    process.env.PLATFORM_ADMIN_TOKEN,
  INVALID:  process.env.INVALID_TOKEN || 'not-a-real-jwt',
} as const;

const IDS = {
  FARM_A:           process.env.USER_A_FARM_ID,
  FARM_B:           process.env.USER_B_FARM_ID,
  SCAN_A:           process.env.USER_A_SCAN_ID,
  SCAN_B:           process.env.USER_B_SCAN_ID,
  PROG_A:           process.env.PROGRAM_A_ID,
  PROG_B:           process.env.PROGRAM_B_ID,
  LIST_PRIV:        process.env.PRIVATE_LISTING_ID,
  LIST_PUB:         process.env.PUBLIC_LISTING_ID,
  FARMER_UNASSIGNED: process.env.UNASSIGNED_FARMER_ID,
} as const;

/** `it.skipIf` wrapper that prints a helpful message in the test name. */
function ifPresent(...vars: (string | undefined)[]) {
  const missing = vars.some((v) => !v);
  return missing ? it.skip : it;
}

// ─── HTTP helper ──────────────────────────────────────────
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface CallOpts {
  method?:  Method;
  path:     string;
  token?:   string | undefined;
  body?:    unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface CallResult {
  status:   number;
  bodyText: string;
  bodyJson: unknown;
  headers:  Record<string, string>;
}

async function call(opts: CallOpts): Promise<CallResult> {
  const url = `${API_BASE_URL}${opts.path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(opts.headers || {}),
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method:  opts.method || 'GET',
      headers,
      body:    opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal:  ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  const bodyText = await res.text();
  let bodyJson: unknown = null;
  try { bodyJson = bodyText ? JSON.parse(bodyText) : null; }
  catch { bodyJson = null; }

  const headerMap: Record<string, string> = {};
  res.headers.forEach((v, k) => { headerMap[k.toLowerCase()] = v; });

  return { status: res.status, bodyText, bodyJson, headers: headerMap };
}

// ─── Assertion helpers ────────────────────────────────────
function expectStatus(res: CallResult, expected: number | number[]) {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(res.status)) {
    throw new Error(
      `Expected status ${list.join(' | ')}, got ${res.status}. ` +
      `Body: ${truncate(res.bodyText, 200)}`
    );
  }
}

// security-test-plan §3 — sensitive-leak patterns. Every
// non-200 response body is scanned for any of these.
const LEAK_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Node stack frame',         re: /\bat Object\./ },
  { name: 'Absolute file path',       re: /\bat (?:\/|[A-Z]:\\)/ },
  { name: 'Prisma internals',         re: /\bPrisma(?:Client(?:Known|Validation|Initialization)RequestError)?\b/ },
  { name: 'SQL error',                re: /\bSQLSTATE\b|\bsyntax error at or near\b/i },
  { name: 'DATABASE_URL leak',        re: /\bDATABASE_URL\b/ },
  { name: 'AUTH_SECRET leak',         re: /\bAUTH_SECRET\b/ },
  { name: 'JWT_SECRET leak',          re: /\bJWT_SECRET\b/ },
  { name: 'MFA_SECRET_KEY leak',      re: /\bMFA_SECRET_KEY\b/ },
  { name: 'SendGrid key leak',        re: /\bSENDGRID_API_KEY\b/ },
  { name: 'Twilio token leak',        re: /\bTWILIO_AUTH_TOKEN\b/ },
  { name: 'Inline private key',       re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'node_modules path',        re: /\bnode_modules\b/ },
  { name: 'Slack token',              re: /\bxox[abprs]-[A-Za-z0-9-]{8,}/ },
  { name: 'AWS access key',           re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'Bare JWT in body',         re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

function expectNoSensitiveLeak(res: CallResult) {
  for (const p of LEAK_PATTERNS) {
    if (p.re.test(res.bodyText)) {
      throw new Error(
        `Sensitive-leak match: "${p.name}" present in response body. ` +
        `Body: ${truncate(res.bodyText, 200)}`
      );
    }
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}\u2026 [+${s.length - n} chars]`;
}

// ─── Live-server probe ────────────────────────────────────
let serverReachable = false;
beforeAll(async () => {
  try {
    const res = await call({ path: '/api/health', timeoutMs: 5000 });
    serverReachable = res.status === 200 || res.status === 503;
  } catch {
    serverReachable = false;
  }
  if (!serverReachable) {
    // eslint-disable-next-line no-console
    console.warn(
      `\n  [security-tests] Server at ${API_BASE_URL} is not reachable.\n` +
      `  Tests will be SKIPPED. Start the server before running this suite:\n` +
      `    cd server && npm run dev\n`
    );
  }
});

const itLive = (...args: Parameters<typeof it>) => {
  if (!serverReachable) return it.skip(...args);
  return it(...args);
};

// =============================================================
// §A — Auth protection
// =============================================================
describe('Auth protection', () => {
  itLive('rejects unauthenticated GET /api/farms with 401', async () => {
    const res = await call({ path: '/api/farms' });
    expectStatus(res, 401);
    expectNoSensitiveLeak(res);
  });

  itLive('rejects an invalid bearer token with 401', async () => {
    const res = await call({ path: '/api/farms', token: TOKENS.INVALID });
    expectStatus(res, 401);
    expectNoSensitiveLeak(res);
  });

  itLive('public health endpoint is reachable without auth', async () => {
    const res = await call({ path: '/api/health' });
    expectStatus(res, [200, 503]);
    expectNoSensitiveLeak(res);
  });

  itLive('public marketplace is reachable without auth', async () => {
    const res = await call({ path: '/api/marketplace' });
    expectStatus(res, [200, 404]);
    expectNoSensitiveLeak(res);
  });
});

// =============================================================
// §B — Role protection
// =============================================================
describe('Role protection', () => {
  ifPresent(TOKENS.A)('farmer cannot reach /api/admin/users', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.A });
    expectStatus(res, 403);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.FA)('field agent cannot reach /api/admin/users', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.FA });
    expectStatus(res, 403);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.BUYER)('buyer cannot reach /api/admin/users', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.BUYER });
    expectStatus(res, 403);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.ADMIN)('platform admin can reach /api/admin/users', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.ADMIN });
    expectStatus(res, [200, 404]);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.BUYER)(
    'buyer cannot POST to farmer-only /api/sell/listings',
    async () => {
      const res = await call({
        path:   '/api/sell/listings',
        method: 'POST',
        token:  TOKENS.BUYER,
        body:   { crop: 'tomato', quantity: 100 },
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );
});

// =============================================================
// §C — Ownership / IDOR protection
// =============================================================
describe('Ownership / IDOR protection', () => {
  ifPresent(TOKENS.A, IDS.FARM_B)(
    "Farmer A cannot read Farmer B's farm",
    async () => {
      const res = await call({
        path:  `/api/farms/${IDS.FARM_B}`,
        token: TOKENS.A,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.A, IDS.SCAN_B)(
    "Farmer A cannot read Farmer B's scan",
    async () => {
      const res = await call({
        path:  `/api/scans/${IDS.SCAN_B}`,
        token: TOKENS.A,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.B, IDS.FARM_A)(
    "Farmer B cannot read Farmer A's farm (reverse IDOR)",
    async () => {
      const res = await call({
        path:  `/api/farms/${IDS.FARM_A}`,
        token: TOKENS.B,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );
});

// =============================================================
// §D — Buyer privacy
// =============================================================
describe('Buyer privacy', () => {
  ifPresent(TOKENS.BUYER, IDS.SCAN_A)(
    "Buyer cannot read a farmer's private scan",
    async () => {
      const res = await call({
        path:  `/api/scans/${IDS.SCAN_A}`,
        token: TOKENS.BUYER,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.BUYER, IDS.LIST_PRIV)(
    'Buyer cannot read a private listing',
    async () => {
      const res = await call({
        path:  `/api/buyer/listings/${IDS.LIST_PRIV}`,
        token: TOKENS.BUYER,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.BUYER, IDS.LIST_PUB)(
    'Buyer can read a public listing',
    async () => {
      const res = await call({
        path:  `/api/buyer/listings/${IDS.LIST_PUB}`,
        token: TOKENS.BUYER,
      });
      expectStatus(res, 200);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.BUYER, IDS.FARM_A)(
    "Buyer cannot read a farmer's farm directly",
    async () => {
      const res = await call({
        path:  `/api/farms/${IDS.FARM_A}`,
        token: TOKENS.BUYER,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );
});

// =============================================================
// §E — NGO program isolation
// =============================================================
describe('NGO program isolation', () => {
  ifPresent(TOKENS.NGO_A, IDS.PROG_B)(
    "NGO A cannot read Program B",
    async () => {
      const res = await call({
        path:  `/api/ngo/programs/${IDS.PROG_B}`,
        token: TOKENS.NGO_A,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.NGO_B, IDS.PROG_A)(
    "NGO B cannot read NGO A's roster (cross-program leak)",
    async () => {
      const res = await call({
        path:  `/api/ngo/farmers?programId=${IDS.PROG_A}`,
        token: TOKENS.NGO_B,
      });
      // Either deny outright or return an empty list — never B's data
      expectStatus(res, [200, 403]);
      expectNoSensitiveLeak(res);
      if (res.status === 200) {
        const body = res.bodyJson as { farmers?: unknown[] } | null;
        const list = (body && Array.isArray(body.farmers)) ? body.farmers : [];
        expect(list.length).toBe(0);
      }
    },
  );

  ifPresent(TOKENS.FA, IDS.FARMER_UNASSIGNED)(
    "Field agent cannot read an unassigned farmer",
    async () => {
      const res = await call({
        path:  `/api/ngo/farmers/${IDS.FARMER_UNASSIGNED}`,
        token: TOKENS.FA,
      });
      expectStatus(res, [403, 404]);
      expectNoSensitiveLeak(res);
    },
  );
});

// =============================================================
// §F — Admin protection
// =============================================================
describe('Admin protection', () => {
  itLive('unauthenticated request to /api/admin/users → 401', async () => {
    const res = await call({ path: '/api/admin/users' });
    expectStatus(res, 401);
    expectNoSensitiveLeak(res);
  });

  itLive('invalid token on /api/admin/users → 401', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.INVALID });
    expectStatus(res, 401);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.A)('non-admin role on admin route → 403', async () => {
    const res = await call({ path: '/api/admin/users', token: TOKENS.A });
    expectStatus(res, 403);
    expectNoSensitiveLeak(res);
  });
});

// =============================================================
// §G — Scan / upload safety
// =============================================================
describe('Scan/upload safety', () => {
  ifPresent(TOKENS.A)('scan rate-limit returns 429 within burst', async () => {
    let saw429 = false;
    for (let i = 0; i < 50; i += 1) {
      const res = await call({
        path:   '/api/scan/analyze',
        method: 'POST',
        token:  TOKENS.A,
        body:   { plantName: 'tomato' },
      });
      if (res.status === 429) {
        expectNoSensitiveLeak(res);
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  }, 60_000);

  ifPresent(TOKENS.A)('upload of non-image is rejected', async () => {
    // The route accepts imageBase64 — we send an obviously-text payload.
    const res = await call({
      path:   '/api/scan/analyze',
      method: 'POST',
      token:  TOKENS.A,
      body:   { imageBase64: Buffer.from('not an image').toString('base64') },
    });
    expectStatus(res, [400, 415, 429]);
    expectNoSensitiveLeak(res);
  });

  ifPresent(TOKENS.A)('oversized scan upload is rejected', async () => {
    // 12 MB of zeros base64-encodes to ~16 MB, exceeding the
    // express.json 2 MB cap. Some servers respond 413, others 400.
    const big = Buffer.alloc(12 * 1024 * 1024).toString('base64');
    const res = await call({
      path:   '/api/scan/analyze',
      method: 'POST',
      token:  TOKENS.A,
      body:   { imageBase64: big },
    });
    expectStatus(res, [400, 413, 429]);
    expectNoSensitiveLeak(res);
  }, 30_000);

  ifPresent(TOKENS.A)('empty scan body returns clean 400', async () => {
    const res = await call({
      path:   '/api/scan/analyze',
      method: 'POST',
      token:  TOKENS.A,
      body:   {},
    });
    expectStatus(res, [400, 422, 429]);
    expectNoSensitiveLeak(res);
  });
});

// =============================================================
// §H — Rate limiting (general)
// =============================================================
describe('Rate limiting', () => {
  itLive('unauth flood on /api/farms eventually 429s or stays 401', async () => {
    // 200 in 60s is the apiLimiter default. The unauth path must
    // either keep returning 401 (denied before the limiter counts)
    // or hit 429 — never silently succeed.
    let saw429 = false;
    let allUnauthorized = true;
    for (let i = 0; i < 50; i += 1) {
      const res = await call({ path: '/api/farms' });
      if (res.status === 429) {
        expectNoSensitiveLeak(res);
        saw429 = true;
        break;
      }
      if (res.status !== 401) allUnauthorized = false;
    }
    expect(saw429 || allUnauthorized).toBe(true);
  }, 30_000);
});

// =============================================================
// §I — Error safety
// =============================================================
describe('Error safety', () => {
  ifPresent(TOKENS.A)(
    'invalid farm id returns clean error (no stack/Prisma/JWT)',
    async () => {
      const res = await call({
        path:  '/api/farms/not-a-real-uuid',
        token: TOKENS.A,
      });
      expectStatus(res, [400, 404]);
      expectNoSensitiveLeak(res);
    },
  );

  ifPresent(TOKENS.A)(
    'malformed JSON body returns clean 400 (no stack)',
    async () => {
      // We can't send raw malformed JSON via our helper, so we
      // bypass it and send a body that JSON.parse rejects on the
      // server side.
      const res = await fetch(`${API_BASE_URL}/api/scan/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${TOKENS.A}`,
        },
        body: '{"imageBase64": "abc',
      });
      const bodyText = await res.text();
      expect([400, 413, 429]).toContain(res.status);
      const fakeRes: CallResult = {
        status: res.status, bodyText, bodyJson: null, headers: {},
      };
      expectNoSensitiveLeak(fakeRes);
    },
  );

  itLive('OPTIONS preflight returns CORS headers', async () => {
    const res = await call({
      path:    '/api/farms',
      method:  'OPTIONS',
      headers: {
        'Origin':                         'https://example.invalid',
        'Access-Control-Request-Method':  'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });
    expectStatus(res, [200, 204, 403, 404]);
    expectNoSensitiveLeak(res);
  });
});

// =============================================================
// Self-test of leak detection (always runs, no env needed)
// =============================================================
describe('Self-test: leak detector', () => {
  it('expectNoSensitiveLeak fires on a Prisma error string', () => {
    const fake: CallResult = {
      status:   500,
      bodyText: '{"error":"PrismaClientKnownRequestError at /app/server"}',
      bodyJson: null,
      headers:  {},
    };
    expect(() => expectNoSensitiveLeak(fake)).toThrow(/Sensitive-leak/);
  });

  it('expectNoSensitiveLeak passes on a clean error', () => {
    const clean: CallResult = {
      status:   400,
      bodyText: '{"error":"Invalid id"}',
      bodyJson: null,
      headers:  {},
    };
    expect(() => expectNoSensitiveLeak(clean)).not.toThrow();
  });

  it('expectStatus fires on mismatch', () => {
    const fake: CallResult = {
      status: 200, bodyText: '{}', bodyJson: null, headers: {},
    };
    expect(() => expectStatus(fake, 401)).toThrow(/Expected status/);
  });

  it('expectStatus accepts a list of allowed codes', () => {
    const fake: CallResult = {
      status: 404, bodyText: '{}', bodyJson: null, headers: {},
    };
    expect(() => expectStatus(fake, [403, 404])).not.toThrow();
  });
});
