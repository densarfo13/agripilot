/**
 * scanOutcomePersister.js — auto-persist the FULL scan outcome.
 *
 * Scan Intelligence V2 §3 — closes audit gap "tasks generated but
 * never persisted; only thin scanTrainingEvent row written".
 *
 *   import { persistScanOutcome }
 *     from './scanOutcomePersister.js';
 *   await persistScanOutcome(prisma, { scanId, userId, recovery,
 *                                      pest, fieldHealth, ... });
 *
 * Writes:
 *   - scanId, userId, imageUrl, cropName, plantName, country, region
 *   - predictedIssue   ← disease name from recovery envelope
 *   - confidence       ← banded label (low|medium|high)
 *   - weatherSummary   ← REPURPOSED as the full outcome JSON envelope
 *                        (existing Json? column — zero schema change):
 *                        {
 *                          weather,              // original use
 *                          confidencePct,        // 0..100 number
 *                          recommendations,      // string[]
 *                          followUpTask,         // { id, title, urgency }
 *                          diseaseCandidates,    // array
 *                          candidates,           // species candidates
 *                          consensusMode,
 *                          pest,                 // insect provider output
 *                          fieldHealth,          // sentinel hub envelope
 *                          v: 2                  // outcome schema version
 *                        }
 *
 * Pure async helper. NEVER throws — wraps the Prisma call so a
 * persistence failure does NOT crash the /api/scan/analyze response.
 * Returns { ok, id } on success or { ok: false, reason } on failure.
 *
 * Audit gap §6.8 closed alongside: this helper LOGS persistence
 * failures via console.warn (the prior path swallowed them silently
 * which leaked rows from the training corpus).
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const _arr = (v) => (Array.isArray(v) ? v : []);

function _confidenceBand(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 'low';
  if (pct >= 75) return 'high';
  if (pct >= 45) return 'medium';
  return 'low';
}

/**
 * @param {object} prisma                  Prisma client
 * @param {object} args
 * @param {string} args.scanId
 * @param {string|null} args.userId
 * @param {string|null} args.imageUrl
 * @param {string|null} args.cropName
 * @param {string|null} args.country
 * @param {string|null} args.region
 * @param {object|null} args.weather        original weather snapshot
 * @param {object|null} args.recovery       scanRecovery envelope
 * @param {object|null} args.pest           insect detection envelope
 * @param {object|null} args.fieldHealth    sentinel-hub envelope
 * @returns {Promise<{ ok: boolean, id?: string, reason?: string }>}
 */
export async function persistScanOutcome(prisma, args = {}) {
  if (!prisma || typeof prisma.scanTrainingEvent !== 'object'
      || typeof prisma.scanTrainingEvent.upsert !== 'function') {
    return { ok: false, reason: 'prisma_client_missing' };
  }
  const scanId = _str(args.scanId);
  if (!scanId) return { ok: false, reason: 'scanId_required' };

  const recovery = args.recovery || {};
  const pest     = args.pest || null;
  const fieldHealth = args.fieldHealth || null;
  const soil     = args.soil || null;

  const plantName        = _str(recovery.plantName) || _str(args.cropName);
  const predictedIssue   = recovery.diseaseCandidates
                            && _arr(recovery.diseaseCandidates).length > 0
                            ? _str(recovery.diseaseCandidates[0].name)
                            : '';
  const confidencePct    = _num(recovery.confidence);
  const confidenceBand   = _confidenceBand(confidencePct);

  const outcomeEnvelope = {
    weather:           args.weather || null,
    confidencePct,
    recommendations:   _arr(recovery.recommendations).map(_str).filter(Boolean),
    followUpTask:      recovery.nextAction
                        ? { title: _str(recovery.nextAction), urgency: 'medium' }
                        : null,
    diseaseCandidates: _arr(recovery.diseaseCandidates).map((d) => ({
      name:   _str(d && d.name),
      score:  _num(d && d.score) || 0,
      source: _str(d && d.source) || 'unknown',
    })),
    candidates: _arr(recovery.candidates).map((c) => ({
      commonName:     _str(c && c.commonName),
      scientificName: _str(c && c.scientificName),
      score:          _num(c && c.score) || 0,
      source:         _str(c && c.source) || 'unknown',
    })),
    consensusMode: _str(recovery.consensusMode) || 'rule',
    pest: pest ? {
      pest:              _str(pest.pest),
      pestCategory:      _str(pest.pestCategory) || 'unknown',
      confidence:        _num(pest.confidence) || 0,
      severity:          _str(pest.severity) || 'low',
      recommendedAction: _str(pest.recommendedAction),
    } : null,
    fieldHealth: fieldHealth ? {
      ndvi:            _num(fieldHealth.ndvi),
      cropVigor:       _str(fieldHealth.cropVigor) || null,
      stressScore:     _num(fieldHealth.stressScore),
      vegetationTrend: _str(fieldHealth.vegetationTrend) || null,
      interpretation:  _str(fieldHealth.interpretation),
    } : null,
    // Final closure — soil context persisted alongside the rest of
    // the outcome envelope (no schema migration; rides on the
    // existing weatherSummary JSON column).
    soil: (soil && soil.ok) ? {
      texture:           _str(soil.soilTexture && soil.soilTexture.label) || 'unknown',
      clayPct:           _num(soil.soilTexture && soil.soilTexture.clayPct),
      sandPct:           _num(soil.soilTexture && soil.soilTexture.sandPct),
      siltPct:           _num(soil.soilTexture && soil.soilTexture.siltPct),
      ph:                _num(soil.ph),
      organicMatterProxy: _num(soil.organicMatterProxy),
      drainageRisk:      _str(soil.drainageRisk) || 'unknown',
      interpretation:    _str(soil.interpretation),
    } : null,
    v: 3,
  };

  try {
    // Use upsert keyed on scanId so subsequent feedback can update
    // the same row without colliding. The schema doesn't have a
    // unique on scanId, so we emulate via findFirst + create/update.
    const existing = await prisma.scanTrainingEvent.findFirst({
      where: { scanId },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      scanId,
      userId:         args.userId || null,
      imageUrl:       _str(args.imageUrl) || null,
      cropName:       _str(args.cropName) || null,
      plantName:      plantName || null,
      country:        _str(args.country) || null,
      region:         _str(args.region)  || null,
      weatherSummary: outcomeEnvelope,
      predictedIssue: predictedIssue || null,
      confidence:     confidenceBand,
    };

    let row;
    if (existing) {
      row = await prisma.scanTrainingEvent.update({
        where: { id: existing.id },
        data,
      });
    } else {
      row = await prisma.scanTrainingEvent.create({ data });
    }
    return { ok: true, id: row.id };
  } catch (err) {
    // Audit gap §6.8 closed — surface the failure so admins can see
    // training corpus leakage instead of silent loss.
    try {
      // eslint-disable-next-line no-console
      console.warn('[scan-outcome-persister] write failed:',
        err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

export default persistScanOutcome;
