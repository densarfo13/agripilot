/**
 * learningLogger.js — structured prediction → action → outcome
 * trail. Writes to ActionLog when available (same table the
 * autonomous-action system uses) so a future learning loop can
 * join rows without a second schema migration.
 *
 * Three primitives:
 *   logPrediction({ risk, farmId, factors, model, prisma, now })
 *     — captures the V2 risk output as a row with actionType
 *     'prediction'. Returns the prediction id callers reference
 *     in the follow-on action + outcome rows.
 *
 *   logActionTaken({ predictionId, action, audience, rationale,
 *                     farmId, outcome?, metadata?, prisma, now })
 *     — records "we recommended X and did Y" with the prediction
 *     id linking back to the upstream call.
 *
 *   logOutcome({ predictionId, actionId?, outcome, metadata?,
 *                 prisma, now })
 *     — final step: the observed result, days later when known.
 *
 * All three tolerate the ActionLog table being absent (falls back
 * to an in-memory buffer + opsEvent). All three never throw.
 */

import { opsEvent } from '../../utils/opsLogger.js';

const MEMORY_BUFFER = [];
const MAX_MEMORY = 1000;

function rememberInMemory(row) {
  MEMORY_BUFFER.push({ ...row, createdAt: new Date().toISOString() });
  if (MEMORY_BUFFER.length > MAX_MEMORY) {
    MEMORY_BUFFER.splice(0, MEMORY_BUFFER.length - MAX_MEMORY);
  }
}

async function writeRow({ prisma, row }) {
  try {
    if (prisma && prisma.actionLog && typeof prisma.actionLog.create === 'function') {
      const created = await prisma.actionLog.create({ data: row });
      return created && created.id ? created.id : null;
    }
  } catch (err) {
    opsEvent('intelligenceV2', 'log_write_failed', 'error', {
      actionType: row.actionType, error: err && err.message,
    });
  }
  rememberInMemory(row);
  return null;
}

function safeMetadata(obj) {
  if (!obj || typeof obj !== 'object') return null;
  try {
    // Strip non-serializable fields so JSON insert never blows up.
    return JSON.parse(JSON.stringify(obj));
  } catch { return null; }
}

// ─── Primitives ──────────────────────────────────────────────────

/**
 * logPrediction — persist a V2 risk prediction.
 *
 *   risk      — output of computeFarmRisk
 *   farmId    — the farm the risk was computed for
 *   model     — optional tag: 'v2_rule_based' (default) / future ML
 *   actor     — { role, id } — 'system' for cron paths
 */
export async function logPrediction({
  risk, farmId = null,
  model = 'v2_rule_based',
  actor = { role: 'system', id: null },
  prisma = null, now = Date.now(),
} = {}) {
  if (!risk || typeof risk !== 'object') {
    return { id: null, skipped: true, reason: 'invalid_risk' };
  }
  const row = {
    actionType:    'prediction',
    targetType:    farmId ? 'farm' : null,
    targetId:      farmId ? String(farmId) : null,
    actorRole:     actor.role || 'system',
    actorId:       actor.id || null,
    channel:       null,
    outcome:       'success',
    reason:        null,
    priorityScore: Number(risk.score) || null,
    metadata: safeMetadata({
      model,
      level:    risk.level,
      score:    risk.score,
      factors:  risk.factors,
      audience: risk.audience,
    }),
    executedAt: new Date(now),
  };
  const id = await writeRow({ prisma, row });
  opsEvent('intelligenceV2', 'prediction_logged', 'info', {
    farmId, model, level: risk.level, score: risk.score, hasId: !!id,
  });
  return { id, skipped: false };
}

/**
 * logActionTaken — correlate a prediction with what the system did
 * next. `outcome` is optional at the action step — it's often
 * "in_flight" until the real result is known.
 */
export async function logActionTaken({
  predictionId = null,
  action, audience = null, rationale = null, ruleTag = null,
  farmId = null,
  outcome = 'initiated',
  channel = null,
  metadata = null,
  actor = { role: 'system', id: null },
  prisma = null, now = Date.now(),
} = {}) {
  if (!action) {
    return { id: null, skipped: true, reason: 'missing_action' };
  }
  const row = {
    actionType:    `action_${action}`,
    targetType:    farmId ? 'farm' : null,
    targetId:      farmId ? String(farmId) : null,
    actorRole:     actor.role || 'system',
    actorId:       actor.id || null,
    channel:       channel || null,
    outcome:       outcome || 'initiated',
    reason:        null,
    priorityScore: null,
    metadata: safeMetadata({
      predictionId, audience, rationale, ruleTag, ...metadata,
    }),
    executedAt: new Date(now),
  };
  const id = await writeRow({ prisma, row });
  return { id, skipped: false };
}

/**
 * logOutcome — the "what happened next" row. Can be written days
 * later when observations come back (e.g. "issue resolved", "no
 * change", "escalated").
 */
export async function logOutcome({
  predictionId = null, actionId = null,
  outcome,            // 'resolved' | 'no_change' | 'escalated' | 'false_positive'
  farmId = null,
  metadata = null,
  actor = { role: 'system', id: null },
  prisma = null, now = Date.now(),
} = {}) {
  if (!outcome) {
    return { id: null, skipped: true, reason: 'missing_outcome' };
  }
  const row = {
    actionType:    'outcome',
    targetType:    farmId ? 'farm' : null,
    targetId:      farmId ? String(farmId) : null,
    actorRole:     actor.role || 'system',
    actorId:       actor.id || null,
    channel:       null,
    outcome:       String(outcome),
    reason:        null,
    priorityScore: null,
    metadata: safeMetadata({ predictionId, actionId, ...metadata }),
    executedAt: new Date(now),
  };
  const id = await writeRow({ prisma, row });
  opsEvent('intelligenceV2', 'outcome_logged', 'info', {
    farmId, outcome, predictionId, hasId: !!id,
  });
  return { id, skipped: false };
}

/**
 * getLearningTrail — assemble the full (prediction → actions →
 * outcomes) chain for one farm, newest-first. Used by both the
 * admin dashboard ("show me what happened") and any future
 * correlation engine.
 */
export async function getLearningTrail({
  farmId, prisma = null, limit = 50,
} = {}) {
  if (!farmId) return [];
  try {
    if (prisma && prisma.actionLog && typeof prisma.actionLog.findMany === 'function') {
      const rows = await prisma.actionLog.findMany({
        where: { targetId: String(farmId) },
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(500, Number(limit) || 50)),
      });
      return rows.map((r) => Object.freeze({ ...r }));
    }
  } catch (err) {
    opsEvent('intelligenceV2', 'trail_read_failed', 'error', {
      farmId, error: err && err.message,
    });
  }
  // Memory fallback — filter the buffer.
  return MEMORY_BUFFER
    .filter((r) => r && r.targetId === String(farmId))
    .slice(-Number(limit))
    .reverse()
    .map((r) => Object.freeze({ ...r }));
}

export function _drainMemoryBuffer() {
  const snap = MEMORY_BUFFER.slice();
  MEMORY_BUFFER.length = 0;
  return snap;
}

export const _internal = Object.freeze({
  MEMORY_BUFFER, MAX_MEMORY, rememberInMemory, writeRow, safeMetadata,
});
