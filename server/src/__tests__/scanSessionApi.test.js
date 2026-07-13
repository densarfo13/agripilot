import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  canTransition, isTerminal, canAcceptPhoto, imageHash, buildSessionResponse, allowedActionsFor,
} from '../ml/scanSession/scanSessionStateMachine.js';
import { createSession } from '../ml/scanSession/scanSessionService.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');

// ── §6 state machine (functional) ──
describe('scan session state machine (§6)', () => {
  it('#11 legal transitions allowed', () => {
    expect(canTransition('SESSION_CREATED', 'INITIAL_PHOTO_RECEIVED')).toBe(true);
    expect(canTransition('MORE_EVIDENCE_REQUIRED', 'ADDITIONAL_PHOTO_RECEIVED')).toBe(true);
    expect(canTransition('IDENTIFICATION_CONFIRMED', 'SESSION_COMPLETE')).toBe(true);
  });
  it('#12 illegal transitions rejected', () => {
    expect(canTransition('SESSION_COMPLETE', 'INITIAL_PHOTO_RECEIVED')).toBe(false);
    expect(canTransition('SESSION_CREATED', 'SESSION_COMPLETE')).toBe(false);
    expect(canTransition('EXPERT_REVIEW_REQUIRED', 'MORE_EVIDENCE_REQUIRED')).toBe(false);
  });
  it('terminal sessions do not accept photos', () => {
    expect(isTerminal('SESSION_COMPLETE')).toBe(true);
    expect(canAcceptPhoto('SESSION_COMPLETE')).toBe(false);
    expect(canAcceptPhoto('MORE_EVIDENCE_REQUIRED')).toBe(true);
  });
});

// ── §4/§19 hash dedup (functional) ──
describe('imageHash — deterministic dedup key (§4/#19)', () => {
  it('same image → same hash; different → different; strips data-url prefix', () => {
    const a = imageHash('data:image/jpeg;base64,QUJD');
    const b = imageHash('QUJD');
    expect(a).toBe(b);                       // prefix stripped → identical
    expect(a).not.toBe(imageHash('WFla'));
    expect(imageHash('')).toBeNull();
  });
});

// ── §3 canonical response contract (functional) ──
describe('buildSessionResponse — canonical contract (§3/#15)', () => {
  const session = {
    id: 's1', state: 'MORE_EVIDENCE_REQUIRED', imageCount: 1,
    identificationState: 'PROVISIONAL', candidates: [{ commonName: 'Tomato' }],
    healthState: 'NOT_RUN', requestedView: 'LEAF_UNDERSIDE', requestedReasonCode: 'DISTINGUISH_PEST_FROM_DISEASE',
  };
  it('#15 server returns the requested next view + progress + allowed actions', () => {
    const r = buildSessionResponse(session, { maxImages: 3, instruction: 'Photograph the underside.' });
    expect(r.sessionId).toBe('s1');
    expect(r.state).toBe('MORE_EVIDENCE_REQUIRED');
    expect(r.photoProgress).toEqual({ received: 1, maximum: 3 });
    expect(r.identification.state).toBe('PROVISIONAL');
    expect(r.nextView.viewType).toBe('LEAF_UNDERSIDE');
    expect(r.nextView.reasonCode).toBe('DISTINGUISH_PEST_FROM_DISEASE');
    expect(r.allowedActions).toContain('ADD_REQUESTED_PHOTO');
    expect(r.allowedActions).toContain('CONFIRM_PLANT'); // provisional
  });
  it('terminal session offers only agronomist', () => {
    expect(allowedActionsFor({ state: 'EXPERT_REVIEW_REQUIRED' })).toEqual(['ASK_AGRONOMIST']);
  });
});

// ── §2 auth guards (functional — guard runs before any DB access) ──
describe('createSession auth guard (#1/#2)', () => {
  it('#2 unauthenticated → 401 (no prisma touched)', async () => {
    expect((await createSession({ prisma: null, user: null })).status).toBe(401);
    expect((await createSession({ prisma: null, user: {} })).status).toBe(401);
  });
});

// ── DB-bound controls: source-verified (need a live-DB harness to exercise E2E) ──
describe('scan session service — controls present (§2/§4/§5)', () => {
  const svc = read('src/ml/scanSession/scanSessionService.js');
  const app = read('src/app.js');
  it('#3 ownership scoped (userId mismatch → 403)', () => {
    expect(svc).toMatch(/session\.userId\s*!==\s*user\.id/);
    expect(svc).toContain("status: 403");
  });
  it('#4/#5 one entitlement per session (checkDailyScanLimit at create only)', () => {
    expect(svc.slice(svc.indexOf('createSession'))).toContain('checkDailyScanLimit');
    // addPhoto must NOT re-charge
    const addPhoto = svc.slice(svc.indexOf('export async function addPhoto'));
    expect(addPhoto).not.toContain('checkDailyScanLimit');
  });
  it('#6/#7 dedup + reservation-before-provider (one provider call on concurrent duplicate)', () => {
    expect(svc).toContain('scanSessionImage.findFirst');           // dedup lookup
    const create = svc.indexOf('scanSessionImage.create');
    const consensus = svc.indexOf("import('../scanConsensusEngine.js')");
    expect(create).toBeGreaterThan(-1);
    expect(consensus).toBeGreaterThan(create);                     // reserve row BEFORE calling the provider
    expect(svc).toContain("e.code === 'P2002'");                   // concurrent conflict → reuse stored
  });
  it('#8/#9/#10 image / provider-call / expiry limits enforced', () => {
    expect(svc).toContain('image_limit_reached');
    expect(svc).toContain('identification_call_limit_reached');
    expect(svc).toContain('session_expired');
  });
  it('#16 prior confirmed identity is passed to the aggregator (never overwritten)', () => {
    expect(svc).toContain('priorConfirmed');
  });
  it('#17/#18 completion idempotent + escalation preserves evidence', () => {
    expect(svc).toMatch(/state === 'SESSION_COMPLETE'[\s\S]*idempotent: true/);
    const esc = svc.slice(svc.indexOf('export async function escalateSession'));
    expect(esc).toContain('EXPERT_REVIEW_REQUIRED');
    expect(esc).not.toContain('deleteMany'); // never discards images/events
  });
  it('all five authenticated endpoints are mounted', () => {
    expect(app).toContain("app.post('/api/scan/sessions', authenticate");
    expect(app).toContain("app.post('/api/scan/sessions/:sessionId/photos', authenticate");
    expect(app).toContain("app.get('/api/scan/sessions/:sessionId', authenticate");
    expect(app).toContain("app.post('/api/scan/sessions/:sessionId/complete', authenticate");
    expect(app).toContain("app.post('/api/scan/sessions/:sessionId/escalate', authenticate");
  });
});
