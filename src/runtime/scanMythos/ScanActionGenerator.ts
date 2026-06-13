/**
 * ScanActionGenerator.ts — sprint #201, spec §6.
 *
 * One clear, farmer-safe action per scan. Non-chemical-first; never
 * a pesticide name or dosage. Returns an i18n key + English fallback
 * so the trust card stays localized.
 *
 * Pure. Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const SCAN_ACTION_GENERATOR_VERSION = 'scan-action-generator-v1';

export interface ScanAction {
  key: string;        // i18n key
  fallback: string;   // English
  estimatedTime: string;
}

// issueType → safe action (key + English). Mirrors the server-side
// issueAnalysisEngine safe-action map; client copy stays in sync.
const ACTIONS: Readonly<Record<string, ScanAction>> = Object.freeze({
  no_visible_issue: { key: 'scan.action.monitor', fallback: 'Keep monitoring. Scan again in 7 days.', estimatedTime: '2 minutes' },
  yellowing:        { key: 'scan.action.yellowing', fallback: 'Check soil moisture today.', estimatedTime: '3 minutes' },
  curling:          { key: 'scan.action.curling', fallback: 'Check soil moisture and shade levels today.', estimatedTime: '3 minutes' },
  sun_scorch:       { key: 'scan.action.scorch', fallback: 'Add shade for the next few days; water at dawn.', estimatedTime: '5 minutes' },
  leaf_spot:        { key: 'scan.action.spots', fallback: 'Inspect nearby leaves; remove badly affected leaves if safe.', estimatedTime: '4 minutes' },
  blight:           { key: 'scan.action.blight', fallback: 'Separate affected plants from healthy ones; improve airflow.', estimatedTime: '6 minutes' },
  rust:             { key: 'scan.action.rust', fallback: 'Remove affected leaves; avoid watering from above.', estimatedTime: '5 minutes' },
  mildew:           { key: 'scan.action.mildew', fallback: 'Improve airflow; water at the base; remove the worst leaves.', estimatedTime: '5 minutes' },
  holes:            { key: 'scan.action.holes', fallback: 'Check under the leaves for insects.', estimatedTime: '3 minutes' },
  chewing:          { key: 'scan.action.chewing', fallback: 'Inspect under the leaves at dusk for chewing insects.', estimatedTime: '4 minutes' },
  aphids:           { key: 'scan.action.aphids', fallback: 'Spray a soap-and-water solution; check for ants nearby.', estimatedTime: '5 minutes' },
  mites:            { key: 'scan.action.mites', fallback: 'Mist the canopy and check for fine webbing.', estimatedTime: '4 minutes' },
  whiteflies:       { key: 'scan.action.whiteflies', fallback: 'Place yellow sticky traps near the plant.', estimatedTime: '4 minutes' },
  armyworm:         { key: 'scan.action.armyworm', fallback: 'Inspect at dusk; hand-pick larvae first.', estimatedTime: '6 minutes' },
});

const LOW_CONF: ScanAction = Object.freeze({
  key: 'scan.action.retake',
  fallback: 'Retake a closer photo in daylight.',
  estimatedTime: '2 minutes',
});

export function generateScanAction(input: {
  issueType?: string;
  confidencePct?: number | null;
  hasCandidates?: boolean;
} = {}): Readonly<ScanAction> {
  return _safe(() => {
    const conf = _num(input.confidencePct);
    if (conf != null && conf < 60) {
      return input.hasCandidates
        ? Object.freeze({
            key: 'scan.action.confirm',
            fallback: 'Retake closer or choose a possible match from the list.',
            estimatedTime: '2 minutes',
          })
        : LOW_CONF;
    }
    const iss = _str(input.issueType);
    if (iss && ACTIONS[iss]) return ACTIONS[iss];
    return ACTIONS.no_visible_issue;
  }, LOW_CONF);
}

export const _internal = Object.freeze({ generateScanAction, ACTIONS });
export default generateScanAction;
