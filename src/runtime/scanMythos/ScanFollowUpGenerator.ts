/**
 * ScanFollowUpGenerator.ts — sprint #201, spec §7.
 *
 * Severity → follow-up cadence:
 *   high   → tomorrow (1 day)
 *   medium → 3 days
 *   low / healthy → 7 days
 *
 * Returns BOTH an offset (days) + a localizable label key, plus an
 * ISO date when a base date is supplied. Pure; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const SCAN_FOLLOWUP_GENERATOR_VERSION = 'scan-followup-generator-v1';

export interface ScanFollowUp {
  offsetDays: number;
  labelKey:   string;
  labelFallback: string;
  followUpDate: string; // ISO yyyy-mm-dd ('' when no base date)
}

export function generateScanFollowUp(input: {
  severity?: string | null;
  baseDateISO?: string;
} = {}): Readonly<ScanFollowUp> {
  return _safe(() => {
    const sev = _str(input.severity).toLowerCase();
    let offsetDays: number;
    let labelKey: string;
    let labelFallback: string;
    if (sev === 'high') {
      offsetDays = 1; labelKey = 'scan.followUp.tomorrow';
      labelFallback = 'Scan again tomorrow.';
    } else if (sev === 'medium') {
      offsetDays = 3; labelKey = 'scan.followUp.3days';
      labelFallback = 'Scan again in 3 days.';
    } else {
      offsetDays = 7; labelKey = 'scan.followUp.7days';
      labelFallback = 'Scan again in 7 days.';
    }
    const followUpDate = _safe(() => {
      const base = input.baseDateISO ? new Date(input.baseDateISO) : new Date();
      base.setDate(base.getDate() + offsetDays);
      return base.toISOString().slice(0, 10);
    }, '');
    return Object.freeze({ offsetDays, labelKey, labelFallback, followUpDate });
  }, Object.freeze({
    offsetDays: 7, labelKey: 'scan.followUp.7days',
    labelFallback: 'Scan again in 7 days.', followUpDate: '',
  }));
}

export const _internal = Object.freeze({ generateScanFollowUp });
export default generateScanFollowUp;
