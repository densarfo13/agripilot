/**
 * FarmerCompletionContracts.ts — sprint #212 §1.
 *
 * Types for the 8-step farmer setup tracker. Pure data; the engine
 * derives completion from signals the app already holds (no new
 * store, no fabrication).
 */

export const FARMER_COMPLETION_CONTRACTS_VERSION = 'farmer-completion-contracts-v1';

// The 8 ordered setup steps + their i18n key + the CTA route.
export const COMPLETION_STEPS = Object.freeze([
  { key: 'farmCreated',                    labelKey: 'farm.setup.step.farmCreated',                    cta: '/profile' },
  { key: 'locationAdded',                  labelKey: 'farm.setup.step.locationAdded',                  cta: '/profile' },
  { key: 'cropSelected',                   labelKey: 'farm.setup.step.cropSelected',                   cta: '/profile' },
  { key: 'plantingDateAdded',              labelKey: 'farm.setup.step.plantingDateAdded',              cta: '/profile' },
  { key: 'firstScanCompleted',             labelKey: 'farm.setup.step.firstScanCompleted',             cta: '/scan' },
  { key: 'firstTaskCompleted',             labelKey: 'farm.setup.step.firstTaskCompleted',             cta: '/tasks' },
  { key: 'firstOutcomeRecorded',           labelKey: 'farm.setup.step.firstOutcomeRecorded',           cta: '/tasks' },
  { key: 'firstHarvestOrSellDraftCreated', labelKey: 'farm.setup.step.firstHarvestOrSellDraftCreated', cta: '/sell' },
] as const);

export type CompletionStepKey = (typeof COMPLETION_STEPS)[number]['key'];

// The reason each next-step matters (farmer-facing, i18n English).
export const STEP_REASON: Readonly<Record<string, string>> = Object.freeze({
  farmCreated:                    'Your farm is where everything starts.',
  locationAdded:                  'Location lets us tailor weather and timing.',
  cropSelected:                   'Your crop sets the whole plan.',
  plantingDateAdded:              'Planting date unlocks crop stage and harvest window.',
  firstScanCompleted:             'This helps Farroway understand crop health.',
  firstTaskCompleted:             'Doing one task starts your daily rhythm.',
  firstOutcomeRecorded:           'Telling us if it helped sharpens your next plan.',
  firstHarvestOrSellDraftCreated: 'Planning the harvest or sale closes the loop.',
});

export interface FarmerCompletion {
  runtimeVersion:    string;
  completedSteps:    ReadonlyArray<Readonly<{ key: string; labelKey: string; done: boolean }>>;
  totalSteps:        number;
  completedCount:    number;
  percentComplete:   number;
  nextBestStep:      string | null;       // step key, null when all done
  nextBestStepKey:   string | null;       // i18n label key
  nextBestStepReason:string | null;
  primaryCTA:        string | null;       // route
  allComplete:       boolean;
}
