/**
 * programDashboard.js — Phase 4 stub.
 *
 * STATUS: STUB BACKLOG. NOT imported anywhere. Designed entrypoint
 * for the per-program dashboard view an NGO uses to track a single
 * program's enrolment, engagement, and outcomes.
 *
 * Output shape:
 *
 *   {
 *     programId:       string | null,
 *     enrolledCount:   number | null,
 *     activeCount:     number | null,
 *     atRiskCount:     number | null,
 *     completionRate:  number | null,    // 0..1
 *     milestones: { milestoneKey, reachedCount, totalCount }[],
 *     trend30d:        { dateISO, activeCount }[],
 *     lastRefreshedISO: string | null,
 *   }
 */

export function buildProgramDashboard(input = {}) {
  return Object.freeze({
    programId:       (input && input.programId) || null,
    enrolledCount:   null,
    activeCount:     null,
    atRiskCount:     null,
    completionRate:  null,
    milestones:      [],
    trend30d:        [],
    lastRefreshedISO: null,
    _input:          input,
    _version:        PROGRAM_DASHBOARD_VERSION,
  });
}

export const PROGRAM_DASHBOARD_VERSION = '0.1.0-stub';
