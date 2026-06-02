/**
 * scanLearningEngine.js — server-side learning loop.
 *
 * Scan Intelligence V2 §5 — closes audit gap "no feedback loop;
 * confidence never adjusted by user history".
 *
 *   import { recordConfirmation, applyLearningBoost,
 *            learningEngineInfo } from './scanLearningEngine.js';
 *
 *   await recordConfirmation(prisma, { scanId, userId, correct,
 *                                       correctedPlant });
 *   const ranked = applyLearningBoost(plantHistory, candidates);
 *
 * Storage strategy (no schema migration — uses existing JSON
 * columns):
 *   - `ScanTrainingEvent.userFeedback`     ← 'helpful' (correct)
 *                                            | 'not_helpful' (wrong)
 *   - `ScanTrainingEvent.correctedIssue`   ← user-supplied
 *                                            correctedPlant
 *   - `ScanTrainingEvent.weatherSummary.learning`  ← per-event
 *                                                    learning record
 *
 * Ranking heuristic (applyLearningBoost):
 *   For each candidate, look up per-user-per-plant history. If the
 *   user previously confirmed this plant CORRECT, boost the
 *   candidate score by +0.05 (capped at 1.0). If the user
 *   previously marked this plant WRONG, demote by -0.10. Re-sort
 *   the candidate list by adjusted score.
 *
 * Pure (apart from the prisma write in recordConfirmation). Never
 * throws.
 */

const _str = (v) => (typeof v === 'string' ? v : '');

/**
 * Record a user confirmation about a scan result.
 *
 * @param {object}  prisma
 * @param {object}  args
 * @param {string}  args.scanId
 * @param {string}  args.userId
 * @param {boolean} args.correct           true = user confirmed match
 * @param {string}  [args.correctedPlant]  user-supplied corrected name
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function recordConfirmation(prisma, args = {}) {
  if (!prisma || !prisma.scanTrainingEvent) {
    return { ok: false, reason: 'prisma_missing' };
  }
  const scanId = _str(args.scanId);
  if (!scanId) return { ok: false, reason: 'scanId_required' };
  const userId = _str(args.userId) || null;
  const correct = !!args.correct;
  const correctedPlant = _str(args.correctedPlant).slice(0, 200) || null;

  try {
    const row = await prisma.scanTrainingEvent.findFirst({
      where: { scanId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { ok: false, reason: 'scan_not_found' };

    // Merge the learning record into weatherSummary (the JSON column
    // we already use as the outcome envelope — see
    // scanOutcomePersister.js).
    const prev = row.weatherSummary && typeof row.weatherSummary === 'object'
      ? row.weatherSummary : {};
    const learning = {
      confirmedAt: row.createdAt
        ? new Date(row.createdAt).toISOString()
        : null,
      correct,
      correctedPlant,
      previousPlant: row.plantName || null,
      previousIssue: row.predictedIssue || null,
      v: 1,
    };

    const data = {
      userFeedback:  correct ? 'helpful' : 'not_helpful',
      weatherSummary: { ...prev, learning },
    };
    if (!correct && correctedPlant) data.correctedIssue = correctedPlant;

    await prisma.scanTrainingEvent.update({
      where: { id: row.id },
      data,
    });
    return { ok: true };
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[scan-learning] recordConfirmation failed:',
        err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

/**
 * Pure ranking helper. Given a candidate list + the user's prior
 * confirmation history for the same plant names, return a re-sorted
 * candidate list with adjusted scores.
 *
 * @param {Array<{ commonName, scientificName, score, source }>} candidates
 * @param {Array<{ plantName, correct }>} history   per-user history rows
 * @returns {Array} new candidate list (frozen)
 */
export function applyLearningBoost(candidates, history) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return Object.freeze([]);
  }
  const safeHistory = Array.isArray(history) ? history : [];
  // Build per-plant signed score: +1 for correct, -1 for wrong.
  const tally = new Map();
  for (const h of safeHistory) {
    const key = String(h && (h.plantName || '')).toLowerCase().trim();
    if (!key) continue;
    const delta = h.correct ? 1 : -1;
    tally.set(key, (tally.get(key) || 0) + delta);
  }

  const adjusted = candidates.map((c) => {
    const k1 = String(c.commonName || '').toLowerCase().trim();
    const k2 = String(c.scientificName || '').toLowerCase().trim();
    const tk = tally.get(k1) || tally.get(k2) || 0;
    // +0.05 per net-correct confirmation, capped at +0.15.
    // -0.10 per net-wrong correction, floored at -0.20.
    const adj = tk >= 0
      ? Math.min(0.15, tk * 0.05)
      : Math.max(-0.20, tk * 0.10);
    const newScore = Math.max(0, Math.min(1, (Number(c.score) || 0) + adj));
    return Object.freeze({
      ...c,
      score: newScore,
      learningAdjust: adj,
    });
  });

  adjusted.sort((a, b) => b.score - a.score);
  return Object.freeze(adjusted);
}

/**
 * Read the user's confirmation history. Returns an array of
 * `{ plantName, correct, scanId, when }` rows for ranking.
 *
 * @param {object} prisma
 * @param {string} userId
 * @param {number} [limit=50]
 */
export async function readUserConfirmationHistory(prisma, userId, limit = 50) {
  if (!prisma || !prisma.scanTrainingEvent || !userId) return [];
  try {
    const rows = await prisma.scanTrainingEvent.findMany({
      where: {
        userId,
        userFeedback: { in: ['helpful', 'not_helpful'] },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
      select: {
        scanId: true, plantName: true,
        userFeedback: true, correctedIssue: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      scanId:    r.scanId,
      plantName: r.correctedIssue || r.plantName || '',
      correct:   r.userFeedback === 'helpful',
      when:     r.createdAt ? new Date(r.createdAt).toISOString() : null,
    }));
  } catch { return []; }
}

export function learningEngineInfo() {
  return Object.freeze({
    name:               'scan-learning-engine',
    boostStep:          0.05,
    demoteStep:         0.10,
    boostCap:           0.15,
    demoteFloor:        -0.20,
    historyLookbackMax: 200,
  });
}

export const _internal = Object.freeze({ applyLearningBoost });

export default recordConfirmation;
