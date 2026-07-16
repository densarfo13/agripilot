/**
 * scanSessionService.js — durable, server-owned scan-session orchestration (PR-B).
 *
 * Wires the tested modules (nextViewResolver + evidenceAggregator +
 * scanSessionStateMachine) to persistence + the EXISTING provider orchestration
 * (runConsensus). No duplicate pipeline; no new thresholds. Identification-only —
 * the health differential + question engine + UI are later PRs.
 *
 * Every function takes { prisma, user, ... } and returns { status, body } so the
 * route stays a thin adapter. Never logs image bytes / credentials / storage URLs.
 */

import { getSessionLimits, resolveNextView, VIEW_TYPES } from './nextViewResolver.js';
import { aggregateEvidence } from './evidenceAggregator.js';
import {
  canAcceptPhoto, isTerminal, imageHash, buildSessionResponse,
} from './scanSessionStateMachine.js';

const _now = () => new Date();
const _plus = (mins) => new Date(Date.now() + mins * 60 * 1000);
function _elog(evt, extra) { try { console.log('[scan.session] ' + evt + (extra ? ' ' + extra : '')); } catch { /* ignore */ } }

async function _emit(prisma, sessionId, eventType, payload) {
  try { await prisma.scanSessionEvent.create({ data: { sessionId, eventType, payload: payload || null } }); }
  catch { /* observability must never break a scan */ }
}

// Map the consensus verdict → the aggregator's per-image candidate shape.
function _providerResult(consensus, viewType, qualityStatus) {
  const cands = (consensus && Array.isArray(consensus.candidates)) ? consensus.candidates : [];
  return {
    viewType, imageQualityStatus: qualityStatus,
    candidates: cands.slice(0, 5).map((c) => ({
      commonName: String(c.commonName || ''), scientificName: String(c.scientificName || ''),
      providerConfidence: Number(c.score) || 0,
    })),
    consensusMode: (consensus && consensus.consensusMode) || 'rule',
  };
}

const _resp = (prisma, session, extra) => buildSessionResponse(session, { maxImages: getSessionLimits().maxImages, ...(extra || {}) });

// ── POST /api/scan/sessions ────────────────────────────────────────────────
export async function createSession({ prisma, user, body }) {
  if (!user || !user.id) return { status: 401, body: { error: 'unauthorized' } };
  const lim = getSessionLimits();
  // Charge exactly one entitlement per session, via the existing daily quota.
  const { checkDailyScanLimit } = await import('../scanLimitGuard.js');
  const q = await checkDailyScanLimit({ prisma, user });
  if (!q.ok) {
    return { status: 429, body: { error: 'scan_limit_reached', limit: q.limit, used: q.used, remaining: q.remaining, resetsAt: q.resetsAt, plan: q.plan } };
  }
  const session = await prisma.scanSession.create({
    data: {
      userId: user.id,
      farmId: (body && body.farmId) || null,
      fieldId: (body && body.fieldId) || null,
      cropName: (body && body.cropName) || null,
      region: (body && body.region) || null,
      state: 'SESSION_CREATED',
      expiresAt: _plus(lim.expiryMinutes),
      entitlementChargedAt: _now(),
    },
  });
  // The single entitlement charge that the daily quota counts (one per session).
  try {
    await prisma.scanTrainingEvent.create({ data: { scanId: session.id, userId: user.id, cropName: session.cropName || null } });
  } catch { /* best-effort — the session is the source of truth */ }
  await _emit(prisma, session.id, 'scan_session_created', { plan: q.plan });
  await _emit(prisma, session.id, 'scan_session_entitlement_charged', { used: q.used + 1 });
  _elog('created', 'session=' + session.id + ' user=' + user.id);
  return { status: 201, body: _resp(prisma, session) };
}

async function _loadOwned(prisma, user, sessionId) {
  if (!user || !user.id) return { err: { status: 401, body: { error: 'unauthorized' } } };
  const session = await prisma.scanSession.findUnique({ where: { id: String(sessionId || '') } });
  if (!session) return { err: { status: 404, body: { error: 'session_not_found' } } };
  if (session.userId !== user.id) return { err: { status: 403, body: { error: 'forbidden' } } };
  return { session };
}

// ── POST /api/scan/sessions/:id/photos ──────────────────────────────────────
export async function addPhoto({ prisma, user, sessionId, body }) {
  const { err, session } = await _loadOwned(prisma, user, sessionId);
  if (err) return err;
  const lim = getSessionLimits();

  // Expiry (§6).
  if (session.state === 'SESSION_EXPIRED' || (session.expiresAt && new Date(session.expiresAt) < _now())) {
    if (session.state !== 'SESSION_EXPIRED') {
      await prisma.scanSession.update({ where: { id: session.id }, data: { state: 'SESSION_EXPIRED' } });
      await _emit(prisma, session.id, 'scan_session_expired', null);
    }
    return { status: 409, body: { error: 'session_expired', ..._resp(prisma, { ...session, state: 'SESSION_EXPIRED' }) } };
  }
  // Terminal sessions cannot accept new images (§6).
  if (!canAcceptPhoto(session.state)) return { status: 409, body: { error: 'session_not_accepting_photos', state: session.state } };
  // Image limit (§5).
  if (session.imageCount >= lim.maxImages) return { status: 409, body: { error: 'image_limit_reached', maximum: lim.maxImages } };

  const viewType = VIEW_TYPES.includes(String(body && body.viewType)) ? body.viewType : 'UNKNOWN';
  const idemKey = (body && (body.idempotencyKey || body.idempotency_key)) || null;
  const hash = imageHash(body && (body.imageBase64 || body.image));
  if (!hash) return { status: 400, body: { error: 'image_missing_or_unreadable' } };

  // Idempotency + dedup — a repeat image / key returns the stored result, no provider call (§4).
  const prior = await prisma.scanSessionImage.findFirst({
    where: { sessionId: session.id, OR: [{ imageHash: hash }, ...(idemKey ? [{ idempotencyKey: idemKey }] : [])] },
  });
  if (prior) {
    await _emit(prisma, session.id, 'scan_session_duplicate_photo', { view: viewType });
    const fresh = await prisma.scanSession.findUnique({ where: { id: session.id } });
    return { status: 200, body: { deduplicated: true, ..._resp(prisma, fresh) } };
  }

  // Provider-call limit (§5).
  if (session.identificationCallCount >= lim.maxIdentificationCalls) {
    return { status: 409, body: { error: 'identification_call_limit_reached', maximum: lim.maxIdentificationCalls } };
  }

  // Preprocess (reuse the existing pipeline).
  const { preprocessImage } = await import('../preprocessImage.js');
  const pre = await preprocessImage({ base64: body && (body.imageBase64 || body.image) });
  const qualityStatus = pre && pre.ok ? (String((body && (body.imageQuality || body.photoQuality)) || 'PASS').toUpperCase()) : 'FAIL';

  // Reservation FIRST — the UNIQUE(session_id, image_hash) makes a concurrent
  // duplicate upload fail here, guaranteeing exactly ONE provider call (§4).
  let imageRow;
  try {
    imageRow = await prisma.scanSessionImage.create({
      data: {
        sessionId: session.id, imageHash: hash, viewType,
        captureOrder: session.imageCount + 1, qualityState: qualityStatus,
        qualityReasons: (pre && !pre.ok) ? [pre.reason || 'image_rejected'] : [],
        idempotencyKey: idemKey, storageRef: (body && body.storageRef) || null,
      },
    });
  } catch (e) {
    // P2002 unique conflict → a concurrent request reserved this exact image.
    if (e && e.code === 'P2002') {
      await _emit(prisma, session.id, 'scan_session_duplicate_photo', { concurrent: true });
      const fresh = await prisma.scanSession.findUnique({ where: { id: session.id } });
      return { status: 200, body: { deduplicated: true, ..._resp(prisma, fresh) } };
    }
    throw e;
  }
  await _emit(prisma, session.id, 'scan_session_photo_received', { view: viewType, order: imageRow.captureOrder });

  // Invoke the EXISTING identification orchestration (only when the image is usable).
  let providerResult = _providerResult(null, viewType, qualityStatus);
  if (qualityStatus !== 'FAIL' && pre && pre.ok) {
    await _emit(prisma, session.id, 'scan_session_provider_reserved', { call: session.identificationCallCount + 1 });
    _elog('provider_call', 'session=' + session.id + ' call=' + (session.identificationCallCount + 1) + ' view=' + viewType);
    const { runConsensus } = await import('../scanConsensusEngine.js');
    const consensus = await runConsensus({ image: pre.image, mime: pre.mime, cropName: session.cropName || undefined });
    providerResult = _providerResult(consensus, viewType, qualityStatus);
    await _emit(prisma, session.id, 'scan_session_provider_completed', { candidates: providerResult.candidates.length, mode: providerResult.consensusMode });
    _elog('provider_done', 'session=' + session.id + ' candidates=' + providerResult.candidates.length + ' mode=' + providerResult.consensusMode);
  } else {
    _elog('provider_skipped', 'session=' + session.id + ' quality=' + qualityStatus);
  }
  await prisma.scanSessionImage.update({ where: { id: imageRow.id }, data: { providerResult } });

  // Aggregate across ALL usable images (§P3) — prior-confirmed identity is never
  // overwritten by a weaker later photo.
  // Capped: a session holds at most maxImages (default 3); 50 is a safe ceiling.
  const allImages = await prisma.scanSessionImage.findMany({ where: { sessionId: session.id }, orderBy: { captureOrder: 'asc' }, take: 50 });
  const perImageResults = allImages.map((im) => (im.providerResult && typeof im.providerResult === 'object') ? im.providerResult : { viewType: im.viewType, imageQualityStatus: im.qualityState, candidates: [] });
  const priorConfirmed = session.confirmedTaxonId
    ? { taxonId: session.confirmedTaxonId, commonName: (session.candidates && session.candidates[0] && session.candidates[0].commonName) || '', scientificName: (session.candidates && session.candidates[0] && session.candidates[0].scientificName) || '' }
    : null;
  const agg = aggregateEvidence({ perImageResults, priorConfirmed });
  await _emit(prisma, session.id, 'scan_session_evidence_aggregated', { state: agg.identificationState, agreement: agg.crossViewAgreement });

  // Decide the next view (§P2).
  const submittedViews = Array.from(new Set(allImages.filter((im) => String(im.qualityState).toUpperCase() !== 'FAIL').map((im) => im.viewType)));
  const nv = resolveNextView({
    identificationState: agg.identificationState, healthState: 'NOT_RUN',
    imageQualityStatus: qualityStatus, latestView: viewType,
    submittedViews, photosSubmitted: allImages.length,
  });
  await _emit(prisma, session.id, 'scan_session_next_view_resolved', { requiresMore: nv.requiresMoreEvidence, view: nv.requestedView, reason: nv.reasonCode });

  // Persist the resolved state (server-owned).
  const nextState = nv.requiresMoreEvidence ? 'MORE_EVIDENCE_REQUIRED'
    : agg.identificationState === 'CONFIRMED' ? 'IDENTIFICATION_CONFIRMED'
    : agg.identificationState === 'PROVISIONAL' ? 'IDENTIFICATION_PROVISIONAL'
    : agg.identificationState === 'CONFLICTING_EVIDENCE' ? 'MORE_EVIDENCE_REQUIRED'
    : 'INITIAL_ANALYSIS_COMPLETE';
  const updated = await prisma.scanSession.update({
    where: { id: session.id },
    data: {
      state: nextState,
      imageCount: allImages.length,
      identificationCallCount: session.identificationCallCount + (qualityStatus !== 'FAIL' && pre && pre.ok ? 1 : 0),
      identificationState: agg.identificationState,
      candidates: agg.candidates,
      requestedView: nv.requestedView, requestedReasonCode: nv.requestedView ? nv.reasonCode : null,
    },
  });
  _elog('photo', 'session=' + session.id + ' state=' + nextState + ' idState=' + agg.identificationState + ' nextView=' + (nv.requestedView || 'none'));
  return { status: 200, body: _resp(prisma, updated, { instruction: nv.farmerInstruction, instructionKey: nv.farmerInstructionKey }) };
}

// ── GET /api/scan/sessions/:id ──────────────────────────────────────────────
export async function getSession({ prisma, user, sessionId }) {
  const { err, session } = await _loadOwned(prisma, user, sessionId);
  if (err) return err;
  return { status: 200, body: _resp(prisma, session) };
}

// ── POST /api/scan/sessions/:id/complete ────────────────────────────────────
export async function completeSession({ prisma, user, sessionId }) {
  const { err, session } = await _loadOwned(prisma, user, sessionId);
  if (err) return err;
  if (session.state === 'SESSION_COMPLETE') return { status: 200, body: { idempotent: true, ..._resp(prisma, session) } };
  if (isTerminal(session.state)) return { status: 200, body: { idempotent: true, ..._resp(prisma, session) } };
  const updated = await prisma.scanSession.update({ where: { id: session.id }, data: { state: 'SESSION_COMPLETE', completedAt: _now() } });
  await _emit(prisma, session.id, 'scan_session_completed', { finalState: updated.identificationState });
  return { status: 200, body: _resp(prisma, updated) };
}

// ── POST /api/scan/sessions/:id/escalate ────────────────────────────────────
export async function escalateSession({ prisma, user, sessionId }) {
  const { err, session } = await _loadOwned(prisma, user, sessionId);
  if (err) return err;
  if (session.state === 'EXPERT_REVIEW_REQUIRED') return { status: 200, body: { idempotent: true, ..._resp(prisma, session) } };
  // Escalation NEVER discards evidence — images + events are preserved; only state changes.
  const updated = await prisma.scanSession.update({ where: { id: session.id }, data: { state: 'EXPERT_REVIEW_REQUIRED', escalatedAt: _now() } });
  await _emit(prisma, session.id, 'scan_session_escalated', { imageCount: session.imageCount });
  return { status: 200, body: _resp(prisma, updated) };
}

export default { createSession, addPhoto, getSession, completeSession, escalateSession };
