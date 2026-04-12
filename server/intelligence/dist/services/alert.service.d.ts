type DbAlertLevel = 'watch' | 'elevated' | 'high_risk' | 'urgent';
export interface EvaluateAlertParams {
    targetType: 'farm' | 'region' | 'farmer';
    targetId: string;
    alertLevel: DbAlertLevel;
    alertReason: string;
    alertMessage: string;
    confidenceScore: number;
    actionGuidance?: string;
}
export interface AlertEvaluationResult {
    created: boolean;
    alert: Record<string, unknown> | null;
    suppressed: boolean;
    suppressedReason: string | null;
    downgraded: boolean;
    originalLevel: DbAlertLevel | null;
}
/**
 * Return the next lower alert level, or `null` if the level is already the
 * lowest (`watch`).
 *
 * Hierarchy (high to low): urgent -> high_risk -> elevated -> watch
 */
export declare function downgradeAlertLevel(level: DbAlertLevel): DbAlertLevel | null;
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
export declare function evaluateAndCreateAlert(params: EvaluateAlertParams): Promise<AlertEvaluationResult>;
/**
 * Retrieve active (non-expired, non-suppressed) alerts for a specific target,
 * ordered newest-first.
 */
export declare function getActiveAlerts(targetType: string, targetId: string): Promise<Record<string, unknown>[]>;
/**
 * Get alerts relevant to a farmer: alerts targeting the farmer directly
 * **or** targeting any of their farm profiles.
 *
 * @param userId - The farmer's user ID (matches `FarmProfile.userId`).
 * @param limit  - Maximum number of alerts to return (default 20).
 */
export declare function getAlertsByFarmer(userId: string, limit?: number): Promise<Record<string, unknown>[]>;
/**
 * Suppress an existing alert by setting its status to `suppressed` and
 * recording the reason.
 */
export declare function suppressAlert(alertId: string, reason: string): Promise<Record<string, unknown> | null>;
/**
 * Batch-expire stale alerts whose `expiresAt` timestamp has passed and whose
 * status is still `pending` or `sent`.
 *
 * @returns The number of alerts expired.
 */
export declare function expireStaleAlerts(): Promise<number>;
export {};
//# sourceMappingURL=alert.service.d.ts.map