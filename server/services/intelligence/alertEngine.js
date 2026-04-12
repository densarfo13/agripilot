// ─── Alert Engine ──────────────────────────────────────────────────────────
// Orchestrates alert evaluation, suppression, noise control, and DB persistence.

import prisma from '../../lib/prisma.js';
import { computeAlertConfidence, riskLevelFromScore } from './scoringEngine.js';

/**
 * Alert engine configuration — all thresholds are tunable.
 */
export const ALERT_CONFIG = {
  /** Minimum confidence score to create an alert */
  minConfidence: 55,
  /** Window (hours) for duplicate suppression — same target + reason */
  duplicateWindowHours: 24,
  /** Window (hours) to check if user already acted (treatment action) */
  recentActionWindowHours: 48,
  /** Threshold: if more than this many alerts to same target in rolling window → downgrade */
  noiseThreshold: 3,
  /** Rolling window (days) for noise detection */
  noiseWindowDays: 7,
  /** Default alert expiry (hours) */
  defaultExpiryHours: 72,
};

/**
 * Map risk score to alert level string matching the V2AlertEvent schema.
 * @param {number} score
 * @returns {string}
 */
function alertLevelFromScore(score) {
  if (score >= 80) return 'urgent';
  if (score >= 65) return 'high_risk';
  if (score >= 50) return 'elevated';
  return 'watch';
}

/**
 * Generate human-readable action guidance based on alert level and issue type.
 * @param {string} alertLevel
 * @param {string} issueType
 * @returns {string}
 */
function generateActionGuidance(alertLevel, issueType) {
  const issueLabel = issueType || 'potential crop issue';

  const guidance = {
    urgent: `Immediate action required: ${issueLabel} detected with high confidence. Inspect affected areas today and consider emergency treatment. Contact your agronomist.`,
    high_risk: `High risk of ${issueLabel}. Schedule field inspection within 1-2 days. Prepare treatment options and monitor spread.`,
    elevated: `Elevated risk of ${issueLabel}. Monitor the affected area closely over the next few days. Review satellite and drone imagery if available.`,
    watch: `Low-level signal for ${issueLabel}. No immediate action needed — continue routine monitoring.`,
  };

  return guidance[alertLevel] || guidance.watch;
}

/**
 * Evaluate signals and potentially create an alert event.
 *
 * Flow:
 * 1. Compute alert confidence from provided components
 * 2. Check minimum confidence threshold
 * 3. Check duplicate suppression (same target + reason within window)
 * 4. Check if user recently acted (treatment in last 48h)
 * 5. Detect and downgrade noisy alert streams
 * 6. Persist V2AlertEvent record
 *
 * @param {object} params
 * @param {string} params.targetType - 'farm' | 'region' | 'farmer'
 * @param {string} params.targetId - ID of the target entity
 * @param {number} params.riskScore - Overall risk score (0-100)
 * @param {string} params.reason - Short reason string (e.g. 'pest_detected')
 * @param {string} [params.issueType] - Issue category for guidance
 * @param {object} [params.components] - Alert confidence components
 * @returns {Promise<{ created: boolean, alert: object|null, suppressed: boolean, suppressedReason: string|null }>}
 */
export async function evaluateAndCreateAlert({ targetType, targetId, riskScore, reason, issueType, components }) {
  try {
    // 1. Compute confidence
    const confidenceComponents = components || {
      model_confidence: Math.min(riskScore, 100),
      signal_agreement: 60,
      data_quality: 70,
      spatial_relevance: 65,
      recent_trend_strength: 50,
    };
    const { score: confidenceScore } = await computeAlertConfidence(confidenceComponents);

    // 2. Minimum confidence check
    if (confidenceScore < ALERT_CONFIG.minConfidence) {
      console.log(`[Intelligence] Alert suppressed: confidence ${confidenceScore.toFixed(1)} below threshold ${ALERT_CONFIG.minConfidence}`);
      return { created: false, alert: null, suppressed: true, suppressedReason: 'below_confidence_threshold' };
    }

    // 3. Duplicate suppression
    const duplicateCutoff = new Date(Date.now() - ALERT_CONFIG.duplicateWindowHours * 60 * 60 * 1000);
    const existingDuplicate = await prisma.v2AlertEvent.findFirst({
      where: {
        targetType,
        targetId,
        alertReason: reason,
        createdAt: { gte: duplicateCutoff },
        sentStatus: { in: ['pending', 'sent'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingDuplicate) {
      console.log(`[Intelligence] Alert suppressed: duplicate for ${targetType}/${targetId} reason=${reason} within ${ALERT_CONFIG.duplicateWindowHours}h`);
      return { created: false, alert: existingDuplicate, suppressed: true, suppressedReason: 'duplicate_within_window' };
    }

    // 4. Recent treatment action check (only for farm targets)
    if (targetType === 'farm') {
      const actionCutoff = new Date(Date.now() - ALERT_CONFIG.recentActionWindowHours * 60 * 60 * 1000);
      const recentAction = await prisma.v2TreatmentAction.findFirst({
        where: {
          profileId: targetId,
          actionDate: { gte: actionCutoff },
        },
        orderBy: { actionDate: 'desc' },
      });

      if (recentAction) {
        console.log(`[Intelligence] Alert suppressed: recent treatment action found for farm ${targetId}`);
        return { created: false, alert: null, suppressed: true, suppressedReason: 'user_already_acted' };
      }
    }

    // 5. Noise detection — downgrade if too many recent alerts
    let alertLevel = alertLevelFromScore(riskScore);
    const noiseCutoff = new Date(Date.now() - ALERT_CONFIG.noiseWindowDays * 24 * 60 * 60 * 1000);
    const recentAlertCount = await prisma.v2AlertEvent.count({
      where: {
        targetType,
        targetId,
        createdAt: { gte: noiseCutoff },
        sentStatus: { in: ['pending', 'sent'] },
      },
    });

    let downgraded = false;
    if (recentAlertCount > ALERT_CONFIG.noiseThreshold) {
      const levels = ['watch', 'elevated', 'high_risk', 'urgent'];
      const currentIdx = levels.indexOf(alertLevel);
      if (currentIdx > 0) {
        alertLevel = levels[currentIdx - 1];
        downgraded = true;
        console.log(`[Intelligence] Alert downgraded due to noise (${recentAlertCount} alerts in ${ALERT_CONFIG.noiseWindowDays}d): ${levels[currentIdx]} → ${alertLevel}`);
      }
    }

    // 6. Build and persist alert
    const actionGuidance = generateActionGuidance(alertLevel, issueType);
    const alertMessage = `${alertLevel.replace('_', ' ').toUpperCase()}: ${reason.replace(/_/g, ' ')} detected for ${targetType} ${targetId}`;
    const expiresAt = new Date(Date.now() + ALERT_CONFIG.defaultExpiryHours * 60 * 60 * 1000);

    const alert = await prisma.v2AlertEvent.create({
      data: {
        targetType,
        targetId,
        alertLevel,
        alertReason: reason,
        alertMessage,
        confidenceScore,
        actionGuidance,
        sentStatus: 'pending',
        suppressedReason: downgraded ? 'noise_downgraded' : null,
        expiresAt,
      },
    });

    console.log(`[Intelligence] Alert created: id=${alert.id}, level=${alertLevel}, confidence=${confidenceScore.toFixed(1)}`);
    return { created: true, alert, suppressed: false, suppressedReason: null };
  } catch (error) {
    console.error('[Intelligence] Alert evaluation failed:', error.message);
    return { created: false, alert: null, suppressed: false, suppressedReason: null, error: error.message };
  }
}

/**
 * Get active (non-expired, non-suppressed) alerts for a target.
 * @param {string} targetType
 * @param {string} targetId
 * @returns {Promise<object[]>}
 */
export async function getActiveAlerts(targetType, targetId) {
  try {
    const alerts = await prisma.v2AlertEvent.findMany({
      where: {
        targetType,
        targetId,
        sentStatus: { in: ['pending', 'sent'] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[Intelligence] Retrieved ${alerts.length} active alerts for ${targetType}/${targetId}`);
    return alerts;
  } catch (error) {
    console.error('[Intelligence] Failed to get active alerts:', error.message);
    return [];
  }
}

/**
 * Suppress an existing alert with a reason.
 * @param {string} alertId
 * @param {string} reason
 * @returns {Promise<object|null>}
 */
export async function suppressAlert(alertId, reason) {
  try {
    const alert = await prisma.v2AlertEvent.update({
      where: { id: alertId },
      data: {
        sentStatus: 'suppressed',
        suppressedReason: reason,
      },
    });

    console.log(`[Intelligence] Alert ${alertId} suppressed: ${reason}`);
    return alert;
  } catch (error) {
    console.error('[Intelligence] Failed to suppress alert:', error.message);
    return null;
  }
}
