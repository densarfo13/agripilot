/**
 * checkPrismaFieldsGate.test.js — locks the Jarvis Compiler Layer v2 build-time gate
 * (scripts/check-prisma-fields.mjs) that prevents Prisma schema-drift crashes from
 * shipping (e.g. the analytics-summary `officerValidation.count({ where: { status }})`
 * 500 — OfficerValidation has no `status` field).
 *
 * cwd-safe: the gate reads paths relative to the repo root, but `npm test` runs with
 * cwd = server/. We pass ABSOLUTE paths to the pure helpers and run the full gate as a
 * subprocess (its own cwd) rather than calling process.chdir (which would bleed into
 * sibling test workers).
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseSchema, buildMap, topKeys } from '../../../scripts/check-prisma-fields.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..'); // server/src/__tests__ → repo root
const SCHEMA = resolve(REPO_ROOT, 'server/prisma/schema.prisma');
const MAP_FILE = resolve(REPO_ROOT, 'src/generated/prismaModelFields.json');

const models = parseSchema(SCHEMA);

describe('check-prisma-fields gate — schema parse', () => {
  it('OfficerValidation has NO `status` field (the exact production crash)', () => {
    // officerValidation.count({ where: { status: 'approved' } }) → PrismaClientValidationError.
    expect(models.OfficerValidation).toBeTruthy();
    expect(models.OfficerValidation.has('status')).toBe(false);
  });

  it('OfficerValidation has NO `registrationStatus` field either (never infer approval from it)', () => {
    expect(models.OfficerValidation.has('registrationStatus')).toBe(false);
  });

  it('OfficerValidation DOES expose validatedAt + completedAt (the schema-honest signals)', () => {
    expect(models.OfficerValidation.has('validatedAt')).toBe(true);
    expect(models.OfficerValidation.has('completedAt')).toBe(true);
  });

  it('Farmer.registrationStatus IS a real field (approved-farmers source of truth)', () => {
    // The gate only allows Farmer.registrationStatus because the schema confirms it exists.
    expect(models.Farmer).toBeTruthy();
    expect(models.Farmer.has('registrationStatus')).toBe(true);
  });

  it('locks the drift facts behind this sprint’s fixes', () => {
    expect(models.Issue.has('severity')).toBe(false);                 // decisionEngine / weeklyReport
    expect(models.CredibilityAssessment.has('score')).toBe(false);    // pilotQA → credibilityScore
    expect(models.CredibilityAssessment.has('credibilityScore')).toBe(true);
    expect(models.Application.has('acceptedAt')).toBe(false);         // decisionEngine → status enum
    expect(models.AutoNotification.has('metadata')).toBe(false);      // dedupStore
  });

  it('captures the compound-unique client accessor, not the DB constraint (`map`) name', () => {
    // `@@unique([provider, providerAccountId], map: "uq_fed_provider_account")` — the Prisma
    // Client accessor (no `name:`) is `provider_providerAccountId`, NOT the `map` name.
    expect(models.FederatedIdentity.has('provider_providerAccountId')).toBe(true);
    expect(models.FederatedIdentity.has('uq_fed_provider_account')).toBe(false);
  });
});

describe('check-prisma-fields gate — key extraction (topKeys)', () => {
  it('extracts top-level where keys and would flag a non-existent field', () => {
    const { keys } = topKeys("status: 'approved', validatedAt: { not: null }");
    expect(keys).toContain('status');       // extracted → membership check flags it (not on model)
    expect(keys).toContain('validatedAt');  // extracted → allowed (real field)
    expect(models.OfficerValidation.has('status')).toBe(false);
    expect(models.OfficerValidation.has('validatedAt')).toBe(true);
  });

  it('does NOT treat words inside string/template values as keys (the false-positive fix)', () => {
    // The postHarvest.notification.findFirst false positive: `title: `Storage alert: ${x}``
    // and `title: `Storage duration warning: ${x}`` must not leak `alert`/`warning` as keys.
    const { keys } = topKeys("title: `Storage alert: ${cropType}`, createdAt: { gte: d }");
    expect(keys).toContain('title');
    expect(keys).toContain('createdAt');
    expect(keys).not.toContain('alert');
    expect(keys).not.toContain('Storage');
    const w = topKeys("title: `Storage duration warning: ${cropType}`, farmerId: id");
    expect(w.keys).not.toContain('warning');
    expect(w.keys).not.toContain('duration');
  });

  it('leaves bare shorthand keys out of scope (documented — avoids value/key ambiguity)', () => {
    // `where: { farmerId, createdAt: {...} }` — only the explicit `createdAt:` filter is
    // captured; the shorthand `farmerId` is intentionally not statically validated.
    const { keys } = topKeys('farmerId, createdAt: { gte: d }');
    expect(keys).toContain('createdAt');
    expect(keys).not.toContain('farmerId');
  });

  it('flags spreads so a clause with unknown keys is skipped, not guessed', () => {
    expect(topKeys('...orgWhere, status: 1').hasSpread).toBe(true);
    expect(topKeys('status: 1, createdAt: 2').hasSpread).toBe(false);
  });
});

describe('check-prisma-fields gate — generated map + end-to-end', () => {
  it('src/generated/prismaModelFields.json is in sync with schema.prisma', () => {
    const committed = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
    const fresh = buildMap(parseSchema(SCHEMA));
    expect(committed).toEqual(fresh);
  });

  it('the gate runs clean against the current repo (exit 0, PASS)', () => {
    const r = spawnSync(process.execPath, ['scripts/check-prisma-fields.mjs'], {
      cwd: REPO_ROOT, encoding: 'utf8',
    });
    const out = (r.stdout || '') + (r.stderr || '');
    expect(out).toMatch(/\[check:prisma-fields\] PASS/);
    expect(r.status).toBe(0);
  });
});
