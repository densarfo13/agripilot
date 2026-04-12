// ---- Alert Engine (TypeScript) ------------------------------------------------
// Anti-spam alert orchestration engine for Farroway.
// Decides whether to create, suppress, or downgrade alerts.
// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import { getAlertConfig } from '../config/thresholds.js';
// ---- Helpers ----------------------------------------------------------------
const LOG_PREFIX = '[AlertEngine]';
/**
 * Return the next lower alert level, or `null` if the level is already the
 * lowest (`watch`).
 *
 * Hierarchy (high to low): urgent -> high_risk -> elevated -> watch
 */
export function downgradeAlertLevel(level) {
    const map = {
        urgent: 'high_risk',
        high_risk: 'elevated',
        elevated: 'watch',
        watch: null,
    };
    return map[level] ?? null;
}
// ---- Core pipeline ----------------------------------------------------------
/**
 * Evaluate whether an alert should be created, suppressed, or downgraded.
 *
 * Pipeline:
 * 1. Confidence check
 * 2. Duplicate check (same target + level within window)
 * 3. Recent treatment action check (farm targets only)
 * 4. Noise check (too many recent alerts -> downgrade or suppress)
 * 5. Create the alert record
 *
 * @returns An `AlertEvaluationResult` describing what happened.
 */
export async function evaluateAndCreateAlert(params) {
    const { targetType, targetId, alertLevel, alertReason, alertMessage, confidenceScore, actionGuidance, } = params;
    try {
        // ---- 1. Confidence check ------------------------------------------------
        if (confidenceScore < getAlertConfig().confidenceThreshold) {
            console.log(`${LOG_PREFIX} Suppressed: confidence ${confidenceScore} < threshold ${getAlertConfig().confidenceThreshold}`);
            return {
                created: false,
                alert: null,
                suppressed: true,
                suppressedReason: 'below_confidence_threshold',
                downgraded: false,
                originalLevel: null,
            };
        }
        // ---- 2. Duplicate check -------------------------------------------------
        const duplicateCutoff = new Date(Date.now() - getAlertConfig().duplicateWindowHours * 60 * 60 * 1000);
        const existingDuplicate = await prisma.v2AlertEvent.findFirst({
            where: {
                targetType,
                targetId,
                alertLevel,
                createdAt: { gte: duplicateCutoff },
                sentStatus: { in: ['pending', 'sent'] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existingDuplicate) {
            console.log(`${LOG_PREFIX} Suppressed: duplicate for ${targetType}/${targetId} level=${alertLevel} within ${getAlertConfig().duplicateWindowHours}h`);
            return {
                created: false,
                alert: existingDuplicate,
                suppressed: true,
                suppressedReason: 'duplicate_within_window',
                downgraded: false,
                originalLevel: null,
            };
        }
        // ---- 3. Recent treatment action check (farm targets only) ---------------
        if (targetType === 'farm') {
            const actionCutoff = new Date(Date.now() - getAlertConfig().recentActionWindowHours * 60 * 60 * 1000);
            const recentAction = await prisma.v2TreatmentAction.findFirst({
                where: {
                    profileId: targetId,
                    actionDate: { gte: actionCutoff },
                },
                orderBy: { actionDate: 'desc' },
            });
            if (recentAction) {
                console.log(`${LOG_PREFIX} Suppressed: recent treatment action for farm ${targetId}`);
                return {
                    created: false,
                    alert: null,
                    suppressed: true,
                    suppressedReason: 'recent_treatment_active',
                    downgraded: false,
                    originalLevel: null,
                };
            }
        }
        // ---- 4. Noise check -----------------------------------------------------
        const noiseCutoff = new Date(Date.now() - getAlertConfig().noiseWindowDays * 24 * 60 * 60 * 1000);
        const recentAlertCount = await prisma.v2AlertEvent.count({
            where: {
                targetType,
                targetId,
                createdAt: { gte: noiseCutoff },
                sentStatus: { in: ['pending', 'sent'] },
            },
        });
        let effectiveLevel = alertLevel;
        let downgraded = false;
        if (recentAlertCount >= getAlertConfig().noiseThreshold) {
            const nextLevel = downgradeAlertLevel(effectiveLevel);
            if (nextLevel === null) {
                // Already at lowest level -- suppress entirely
                console.log(`${LOG_PREFIX} Suppressed: noise limit reached for ${targetType}/${targetId} (${recentAlertCount} alerts in ${getAlertConfig().noiseWindowDays}d, already at watch)`);
                return {
                    created: false,
                    alert: null,
                    suppressed: true,
                    suppressedReason: 'noise_limit_reached',
                    downgraded: false,
                    originalLevel: alertLevel,
                };
            }
            console.log(`${LOG_PREFIX} Downgrading ${alertLevel} -> ${nextLevel} for ${targetType}/${targetId} (${recentAlertCount} alerts in ${getAlertConfig().noiseWindowDays}d)`);
            effectiveLevel = nextLevel;
            downgraded = true;
        }
        // ---- 5. Create the alert ------------------------------------------------
        const expiresAt = new Date(Date.now() + getAlertConfig().defaultExpiryHours * 60 * 60 * 1000);
        const alert = await prisma.v2AlertEvent.create({
            data: {
                targetType,
                targetId,
                alertLevel: effectiveLevel,
                alertReason,
                alertMessage,
                confidenceScore,
                actionGuidance: actionGuidance ?? null,
                sentStatus: 'pending',
                suppressedReason: downgraded ? 'noise_downgraded' : null,
                expiresAt,
            },
        });
        console.log(`${LOG_PREFIX} Created alert id=${alert.id} level=${effectiveLevel} confidence=${confidenceScore}`);
        return {
            created: true,
            alert: alert,
            suppressed: false,
            suppressedReason: null,
            downgraded,
            originalLevel: downgraded ? alertLevel : null,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} evaluateAndCreateAlert failed:`, message);
        return {
            created: false,
            alert: null,
            suppressed: false,
            suppressedReason: null,
            downgraded: false,
            originalLevel: null,
        };
    }
}
// ---- Query helpers ----------------------------------------------------------
/**
 * Retrieve active (non-expired, non-suppressed) alerts for a specific target,
 * ordered newest-first.
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
        console.log(`${LOG_PREFIX} Retrieved ${alerts.length} active alerts for ${targetType}/${targetId}`);
        return alerts;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} getActiveAlerts failed:`, message);
        return [];
    }
}
/**
 * Get alerts relevant to a farmer: alerts targeting the farmer directly
 * **or** targeting any of their farm profiles.
 *
 * @param userId - The farmer's user ID (matches `FarmProfile.userId`).
 * @param limit  - Maximum number of alerts to return (default 20).
 */
export async function getAlertsByFarmer(userId, limit = 20) {
    try {
        // Fetch the farmer's farm profile IDs so we can include farm-level alerts.
        const farmProfiles = await prisma.farmProfile.findMany({
            where: { userId },
            select: { id: true },
        });
        const farmProfileIds = farmProfiles.map((fp) => fp.id);
        const combinedAlerts = await prisma.v2AlertEvent.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { targetType: 'farmer', targetId: userId },
                            ...(farmProfileIds.length > 0
                                ? [{ targetType: 'farm', targetId: { in: farmProfileIds } }]
                                : []),
                        ],
                    },
                    {
                        sentStatus: { in: ['pending', 'sent'] },
                    },
                    {
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } },
                        ],
                    },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        console.log(`${LOG_PREFIX} Retrieved ${combinedAlerts.length} alerts for farmer ${userId}`);
        return combinedAlerts;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} getAlertsByFarmer failed:`, message);
        return [];
    }
}
// ---- Mutation helpers -------------------------------------------------------
/**
 * Suppress an existing alert by setting its status to `suppressed` and
 * recording the reason.
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
        console.log(`${LOG_PREFIX} Alert ${alertId} suppressed: ${reason}`);
        return alert;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} suppressAlert failed:`, message);
        return null;
    }
}
/**
 * Batch-expire stale alerts whose `expiresAt` timestamp has passed and whose
 * status is still `pending` or `sent`.
 *
 * @returns The number of alerts expired.
 */
export async function expireStaleAlerts() {
    try {
        const result = await prisma.v2AlertEvent.updateMany({
            where: {
                expiresAt: { lt: new Date() },
                sentStatus: { in: ['pending', 'sent'] },
            },
            data: {
                sentStatus: 'expired',
            },
        });
        const count = result.count ?? 0;
        console.log(`${LOG_PREFIX} Expired ${count} stale alerts`);
        return count;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} expireStaleAlerts failed:`, message);
        return 0;
    }
}
//# sourceMappingURL=alert.service.js.map