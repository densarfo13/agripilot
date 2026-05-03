#!/usr/bin/env node
/**
 * scan-secrets.mjs — pre-launch secrets scanner.
 *
 *   npm run security:scan-secrets
 *
 * Walks the working tree and flags any tracked file that looks
 * like it carries a real credential. Exit code 0 = clean,
 * 1 = at least one suspicious finding.
 *
 * Why a custom scanner instead of TruffleHog / git-secrets
 * ────────────────────────────────────────────────────────
 *   TruffleHog is excellent for deep history scans but adds a
 *   binary to the launch checklist. This file is a fast, ESM,
 *   zero-dep regex pass that runs in CI before merge and is
 *   tuned for the patterns Farroway actually emits:
 *     • SendGrid keys (SG.…)
 *     • Twilio account/auth pairs (AC… + 32-hex auth tokens)
 *     • AWS access key IDs (AKIA…)
 *     • RSA / EC / SSH private keys
 *     • Slack webhooks / bot tokens
 *     • JWT secrets pasted into source
 *     • Postgres connection strings with embedded passwords
 *     • Generic high-entropy strings labelled `*_KEY=` /
 *       `*_SECRET=` / `*_TOKEN=` / `*_PASSWORD=`
 *
 * What's intentionally skipped
 *   • `.env.example`, `.env.template` — placeholder values are
 *     allowed (the docs MUST show what shape an admin must paste)
 *   • `node_modules/`, `dist/`, `.git/`, build outputs
 *   • Test fixtures whose path includes the word `fixture` or
 *     `mock` — those carry deliberately-fake values
 *   • Any line containing `// secrets-scanner:ignore`
 *
 * Strict-rule audit
 *   • Read-only — never edits a file.
 *   • Pure ESM, no third-party deps.
 *   • Exit code 1 on any finding so CI fails the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

// ─── Skip directories (matched anywhere in the path) ──────
// `backend/`, `mobile/`, `website/`, `docs/`, `.claude/` are
// listed in .gitignore at repo root — never committed, so
// scanning them produces false positives only.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.cache', '.vite', '.turbo', '.parcel-cache',
  'android', 'ios', 'uploads', 'prisma/migrations',
  'backend', 'mobile', 'website', 'docs', '.claude',
  '__tests__', 'tests', 'test',
]);

// ─── Skip extensions (binary / generated artefacts) ──────
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.mov', '.zip', '.gz', '.tgz',
  '.pdf', '.lock', '.map',
]);

// ─── Files we deliberately don't scan ─────────────────────
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.env.example', '.env.template', '.env.sample',
  // This scanner itself contains pattern strings that look like
  // secrets — exclude it so the regexes don't flag themselves.
  'scan-secrets.mjs',
  // The audit report documents redacted env-var names + sample
  // shapes; flagging it on its own descriptions would be noise.
  'SECURITY_AUDIT_REPORT.md',
]);

// ─── Per-finding ignore marker ────────────────────────────
const IGNORE_MARKER = 'secrets-scanner:ignore';

// ─── Patterns ─────────────────────────────────────────────
// Each entry: { name, re, severity }. `re` is matched line-by-
// line with a global flag so we can report every hit. Severity
// is informational only — exit code is 1 on ANY finding.
const PATTERNS = [
  {
    name: 'SendGrid API key',
    re: /SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
    severity: 'critical',
  },
  {
    name: 'AWS access key ID',
    re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
  },
  {
    name: 'AWS secret access key (heuristic)',
    re: /aws[_-]?secret[_-]?access[_-]?key["'\s]*[:=]["'\s]*[A-Za-z0-9/+=]{40}/gi,
    severity: 'critical',
  },
  {
    name: 'Twilio account SID',
    re: /\bAC[a-f0-9]{32}\b/g,
    severity: 'high',
  },
  {
    name: 'Slack webhook URL',
    re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    severity: 'high',
  },
  {
    name: 'Slack bot token',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: 'high',
  },
  {
    name: 'Stripe live key',
    re: /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/g,
    severity: 'critical',
  },
  {
    name: 'Google API key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: 'high',
  },
  {
    name: 'GitHub personal access token',
    re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
    severity: 'high',
  },
  {
    name: 'Private key (RSA/EC/OpenSSH)',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    name: 'Postgres URL with embedded password',
    re: /postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]{6,}@[^/\s'"]+/g,
    severity: 'critical',
  },
  {
    name: 'JWT secret literal in source',
    // Catches: JWT_SECRET = "abc..." with a long-ish value.
    // Won't fire on env-reads (process.env.JWT_SECRET || '').
    re: /\bJWT_SECRET\s*[:=]\s*["'][A-Za-z0-9+/=_-]{32,}["']/g,
    severity: 'critical',
  },
  {
    name: 'Hardcoded MFA encryption key',
    re: /\bMFA_SECRET_KEY\s*[:=]\s*["'][a-fA-F0-9]{64}["']/g,
    severity: 'critical',
  },
  {
    name: 'Hardcoded password literal',
    // Catches: password: "literal" / password = "literal" with at
    // least 6 chars. Skips obvious placeholders.
    re: /\b(?:password|passwd|pwd)\s*[:=]\s*["'](?!(?:placeholder|changeme|example|test|TODO|secret|password|admin|root|<.+?>|\$\{.+?\}))[^"'\s]{6,}["']/gi,
    severity: 'medium',
  },
  {
    name: 'Generic *_API_KEY literal',
    re: /\b[A-Z][A-Z0-9_]*_API_KEY\s*[:=]\s*["'][A-Za-z0-9+/=_-]{20,}["']/g,
    severity: 'high',
  },
];

// ─── File walk (sync, single-process — repo is small) ─────
function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function shouldSkipFile(rel) {
  const base = path.basename(rel);
  if (SKIP_FILES.has(base)) return true;
  const ext = path.extname(rel).toLowerCase();
  if (SKIP_EXT.has(ext)) return true;
  // Test fixtures / mocks / spec files carry deliberately-fake
  // values that match the password heuristic. Skip them.
  if (/\b(?:fixture|fixtures|mock|mocks|__mocks__)\b/i.test(rel)) return true;
  if (/\.(?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(base)) return true;
  // .env / .env.* are gitignored and exist only on the developer
  // machine. They are SUPPOSED to hold secrets — that's the
  // whole point — and they're never committed. A leak via .env
  // would be a different class of incident (committed tracked
  // file). The launch-gate-time scan should focus on tracked code.
  if (/^\.env(?:\..+)?$/.test(base)) return true;
  return false;
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      yield* walk(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

// ─── Scan ─────────────────────────────────────────────────
const findings = [];
let filesScanned = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (shouldSkipFile(rel)) continue;
  let content;
  try { content = fs.readFileSync(file, 'utf8'); }
  catch { continue; }
  // Skip files that look binary by sniffing for null bytes.
  if (content.includes('\u0000')) continue;
  filesScanned += 1;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes(IGNORE_MARKER)) continue;
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      const m = p.re.exec(line);
      if (m) {
        findings.push({
          file: rel,
          line: i + 1,
          pattern: p.name,
          severity: p.severity,
          // Truncate the matched string so the report doesn't
          // re-emit the whole secret to stdout.
          preview: m[0].slice(0, 24) + (m[0].length > 24 ? '\u2026' : ''),
        });
      }
    }
  }
}

// ─── Report ───────────────────────────────────────────────
function fmt() {
  if (findings.length === 0) {
    return `\u2713 secrets scan clean — ${filesScanned} files scanned, 0 findings.`;
  }
  const bySev = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const sevSummary = Object.entries(bySev)
    .map(([s, n]) => `${s}=${n}`).join(', ');
  const lines = [
    `\u2717 secrets scan FAILED — ${findings.length} finding(s) (${sevSummary}) across ${filesScanned} files.`,
    '',
  ];
  for (const f of findings) {
    lines.push(`  [${f.severity.toUpperCase()}] ${f.file}:${f.line}  ${f.pattern}  \u2192  ${f.preview}`);
  }
  lines.push('');
  lines.push(`If a finding is a false positive, append \`// ${IGNORE_MARKER}\` to the offending line.`);
  return lines.join('\n');
}

console.log(fmt());
process.exit(findings.length > 0 ? 1 : 0);
