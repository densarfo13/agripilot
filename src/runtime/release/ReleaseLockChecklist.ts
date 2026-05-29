/**
 * src/runtime/release/ReleaseLockChecklist.ts — Pure
 * definition of every checklist item across all 10 sections.
 *
 *   import {
 *     RELEASE_CHECKLIST, sectionItems,
 *     CHECKLIST_VERSION,
 *   } from 'src/runtime/release/ReleaseLockChecklist';
 *
 * What this is
 * ────────────
 *   The static catalog of what the Release Lock verifies.
 *   Each item is a frozen record:
 *     { id, section, label, kind, severity, manual? }
 *   The Diagnostics module owns the run-time evaluation; this
 *   file owns the declaration only.
 *
 *   Section assignment + severity stay in lockstep with the
 *   release-lock contracts. The internal page renders sections
 *   in the order RELEASE_SECTIONS declares.
 *
 * Strict-rule audit
 *   • Pure data.
 *   • SSR-safe. Never throws.
 *   • No engine state read here — just declarations.
 */

import {
  CHECK_KIND, SEVERITY, RELEASE_SECTIONS,
  ReleaseSectionKey,
} from './releaseLockContracts';

export const CHECKLIST_VERSION = 'release-checklist-v1';

export interface ChecklistItem {
  id:        string;
  section:   ReleaseSectionKey;
  label:     string;
  kind:      'auto' | 'manual';
  severity:  'blocker' | 'warning' | 'info';
  /** When true the item is intentionally manual and stored
   *  in the per-admin overrides map. */
  manual?:   boolean;
  /** Optional doc string surfaced in the UI tooltip. */
  hint?:     string;
}

/* ── Section J' — No Farmer Dashboard Experience ───────────
 * Added by the "Remove Mobile Dashboard Experience" sprint —
 * these checks ensure normal farmers/gardeners never see
 * traditional analytics dashboards. The CI gate
 * check:no-farmer-dashboard owns the static enforcement. */
const NO_FARMER_DASHBOARD: ChecklistItem[] = [
  { id: 'J.noChartImports', section: 'founderDashboard',
    label: 'No chart libraries on user-facing pages', kind: 'auto',
    severity: 'blocker',
    hint: 'check:no-farmer-dashboard fails CI if recharts/chart.js leaks to non-admin pages.' },
  { id: 'J.gatedChartRoutes', section: 'founderDashboard',
    label: '/portfolio and /reports are role-gated', kind: 'auto',
    severity: 'blocker' },
];

/* ── Section A — Scan Runtime ──────────────────────────────── */
const A_SCAN_RUNTIME: ChecklistItem[] = [
  { id: 'A.manual.iphoneSafari',  section: 'scanRuntime',
    label: 'iPhone Safari manual check', kind: 'manual',
    severity: 'warning', manual: true,
    hint: 'Open the app on iPhone Safari and complete a real scan.' },
  { id: 'A.manual.androidChrome', section: 'scanRuntime',
    label: 'Android Chrome manual check', kind: 'manual',
    severity: 'warning', manual: true,
    hint: 'Open the app on Android Chrome and complete a real scan.' },
  { id: 'A.uploadPhoto',          section: 'scanRuntime',
    label: 'Upload photo path ready', kind: 'auto',
    severity: 'blocker' },
  { id: 'A.cameraPhoto',          section: 'scanRuntime',
    label: 'Camera photo path ready', kind: 'auto',
    severity: 'blocker' },
  { id: 'A.retry',                section: 'scanRuntime',
    label: 'Retry path ready', kind: 'auto',
    severity: 'warning' },
  { id: 'A.offlineQueue',         section: 'scanRuntime',
    label: 'Offline queue path ready', kind: 'auto',
    severity: 'warning' },
  { id: 'A.reconnectSync',        section: 'scanRuntime',
    label: 'Reconnect sync path ready', kind: 'auto',
    severity: 'warning' },
  { id: 'A.noFirstLoadError',     section: 'scanRuntime',
    label: 'No camera error on first load', kind: 'auto',
    severity: 'blocker',
    hint: 'CI gate check:scan-no-first-load-error must pass.' },
  { id: 'A.plantIdClassifier',    section: 'scanRuntime',
    label: 'Plant.id classifier available', kind: 'auto',
    severity: 'blocker' },
  { id: 'A.scanSuccessRate',      section: 'scanRuntime',
    label: 'Scan success target ≥ 90%', kind: 'auto',
    severity: 'warning',
    hint: 'Reported from founder metrics; "not enough data yet" is acceptable pre-launch.' },
];

/* ── Section B — Universal Plant Runtime ───────────────────── */
const B_PLANT_RUNTIME: ChecklistItem[] = [
  { id: 'B.registry',     section: 'plantRuntime',
    label: 'Plant Registry ready', kind: 'auto', severity: 'blocker' },
  { id: 'B.profile',      section: 'plantRuntime',
    label: 'Plant Profile ready',  kind: 'auto', severity: 'blocker' },
  { id: 'B.timeline',     section: 'plantRuntime',
    label: 'Plant Timeline ready', kind: 'auto', severity: 'warning' },
  { id: 'B.health',       section: 'plantRuntime',
    label: 'Plant Health ready',   kind: 'auto', severity: 'warning' },
  { id: 'B.lifecycle',    section: 'plantRuntime',
    label: 'Plant Lifecycle ready', kind: 'auto', severity: 'warning' },
  { id: 'B.tasks',        section: 'plantRuntime',
    label: 'Plant Tasks ready',    kind: 'auto', severity: 'warning' },
  { id: 'B.recommend',    section: 'plantRuntime',
    label: 'Plant Recommendations ready', kind: 'auto', severity: 'warning' },
];

/* ── Section C — Scan → Managed Plant ──────────────────────── */
const C_SCAN_TO_PLANT: ChecklistItem[] = [
  { id: 'C.normalizes',      section: 'scanToManagedPlant',
    label: 'Scan result normalises plant', kind: 'auto', severity: 'blocker' },
  { id: 'C.confirmation',    section: 'scanToManagedPlant',
    label: 'Add-to-my-plants confirmation exists', kind: 'auto', severity: 'warning' },
  { id: 'C.created',         section: 'scanToManagedPlant',
    label: 'Plant created from scan', kind: 'auto', severity: 'blocker' },
  { id: 'C.timeline',        section: 'scanToManagedPlant',
    label: 'Timeline created for new plant', kind: 'auto', severity: 'warning' },
  { id: 'C.starterTasks',    section: 'scanToManagedPlant',
    label: 'Starter tasks generated', kind: 'auto', severity: 'warning' },
  { id: 'C.health',          section: 'scanToManagedPlant',
    label: 'Health generated', kind: 'auto', severity: 'warning' },
  { id: 'C.profileOpens',    section: 'scanToManagedPlant',
    label: 'Profile opens for new plant', kind: 'auto', severity: 'warning' },
];

/* ── Section D — My Plants ─────────────────────────────────── */
const D_MY_PLANTS: ChecklistItem[] = [
  { id: 'D.flowers',     section: 'myPlants', label: 'Flowers section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.vegetables',  section: 'myPlants', label: 'Vegetables section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.fruits',      section: 'myPlants', label: 'Fruits section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.herbs',       section: 'myPlants', label: 'Herbs section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.houseplants', section: 'myPlants', label: 'Houseplants section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.crops',       section: 'myPlants', label: 'Crops section',
    kind: 'auto', severity: 'warning' },
  { id: 'D.search',      section: 'myPlants', label: 'Search',
    kind: 'auto', severity: 'warning' },
  { id: 'D.health',      section: 'myPlants', label: 'Health indicators',
    kind: 'auto', severity: 'warning' },
  { id: 'D.tasks',       section: 'myPlants', label: 'Task indicators',
    kind: 'auto', severity: 'warning' },
];

/* ── Section E — Plant Profile ─────────────────────────────── */
const E_PROFILE: ChecklistItem[] = [
  { id: 'E.heroImage',     section: 'plantProfile', label: 'Hero image',
    kind: 'auto', severity: 'warning' },
  { id: 'E.healthScore',   section: 'plantProfile', label: 'Health score',
    kind: 'auto', severity: 'warning' },
  { id: 'E.lifecycleStage',section: 'plantProfile', label: 'Lifecycle stage',
    kind: 'auto', severity: 'warning' },
  { id: 'E.tasks',         section: 'plantProfile', label: 'Tasks',
    kind: 'auto', severity: 'warning' },
  { id: 'E.timeline',      section: 'plantProfile', label: 'Timeline',
    kind: 'auto', severity: 'warning' },
  { id: 'E.recommend',     section: 'plantProfile', label: 'Recommendations',
    kind: 'auto', severity: 'warning' },
  { id: 'E.recentScans',   section: 'plantProfile', label: 'Recent scans',
    kind: 'auto', severity: 'info' },
];

/* ── Section F — Plant Timeline ────────────────────────────── */
const F_TIMELINE: ChecklistItem[] = [
  'PlantCreated','ScanCompleted','TaskGenerated','TaskCompleted',
  'DiseaseDetected','TreatmentApplied','GrowthStageChanged',
].map((evt) => ({
  id: 'F.event.' + evt, section: 'plantTimeline' as ReleaseSectionKey,
  label: 'Timeline event: ' + evt, kind: 'auto' as const,
  severity: 'warning' as const,
}));

/* ── Section G — Knowledge Layer ───────────────────────────── */
const G_KNOWLEDGE: ChecklistItem[] = [
  { id: 'G.plants',   section: 'knowledgeLayer',
    label: 'Plants ≥ 200',    kind: 'auto', severity: 'warning' },
  { id: 'G.diseases', section: 'knowledgeLayer',
    label: 'Diseases ≥ 15',   kind: 'auto', severity: 'warning' },
  { id: 'G.pests',    section: 'knowledgeLayer',
    label: 'Pests ≥ 15',      kind: 'auto', severity: 'warning' },
];

/* ── Section H — Daily Briefing ────────────────────────────── */
const H_BRIEFING: ChecklistItem[] = [
  { id: 'H.plantDriven',   section: 'dailyBriefing',
    label: 'Plant-driven briefing', kind: 'auto', severity: 'warning' },
  { id: 'H.weatherDriven', section: 'dailyBriefing',
    label: 'Weather-driven briefing', kind: 'auto', severity: 'warning' },
  { id: 'H.taskDriven',    section: 'dailyBriefing',
    label: 'Task-driven briefing', kind: 'auto', severity: 'warning' },
  { id: 'H.offlineCached', section: 'dailyBriefing',
    label: 'Offline cached briefing', kind: 'auto', severity: 'warning' },
  { id: 'H.noFakeRec',     section: 'dailyBriefing',
    label: 'No fake recommendations', kind: 'auto', severity: 'blocker' },
];

/* ── Section I — Real Plant Media ──────────────────────────── */
const I_MEDIA: ChecklistItem[] = [
  { id: 'I.flowers',     section: 'realPlantMedia',
    label: 'Flower images ≥ 100', kind: 'auto', severity: 'warning' },
  { id: 'I.vegetables',  section: 'realPlantMedia',
    label: 'Vegetable images ≥ 50', kind: 'auto', severity: 'warning' },
  { id: 'I.fruits',      section: 'realPlantMedia',
    label: 'Fruit images ≥ 50', kind: 'auto', severity: 'warning' },
  { id: 'I.herbs',       section: 'realPlantMedia',
    label: 'Herb images ≥ 50', kind: 'auto', severity: 'warning' },
  { id: 'I.houseplants', section: 'realPlantMedia',
    label: 'Houseplant images ≥ 50', kind: 'auto', severity: 'warning' },
  { id: 'I.crops',       section: 'realPlantMedia',
    label: 'Crop images ≥ 50', kind: 'auto', severity: 'warning' },
  { id: 'I.diseases',    section: 'realPlantMedia',
    label: 'Disease images ≥ 100', kind: 'auto', severity: 'warning' },
  { id: 'I.pests',       section: 'realPlantMedia',
    label: 'Pest images ≥ 100', kind: 'auto', severity: 'warning' },
];

/* ── Section J — Founder Dashboard ─────────────────────────── */
const J_FOUNDER: ChecklistItem[] = [
  { id: 'J.route',         section: 'founderDashboard',
    label: 'Route /internal/founder exists', kind: 'auto', severity: 'blocker' },
  { id: 'J.users',         section: 'founderDashboard',
    label: 'Users metric real', kind: 'auto', severity: 'blocker' },
  { id: 'J.dauWau',        section: 'founderDashboard',
    label: 'DAU/WAU real or "not enough data yet"', kind: 'auto', severity: 'warning' },
  { id: 'J.plants',        section: 'founderDashboard',
    label: 'Plants metric real', kind: 'auto', severity: 'blocker' },
  { id: 'J.scans',         section: 'founderDashboard',
    label: 'Scans metric real', kind: 'auto', severity: 'blocker' },
  { id: 'J.tasks',         section: 'founderDashboard',
    label: 'Tasks metric real', kind: 'auto', severity: 'warning' },
  { id: 'J.scanSuccess',   section: 'founderDashboard',
    label: 'Scan success metric real', kind: 'auto', severity: 'warning' },
  { id: 'J.offlineSync',   section: 'founderDashboard',
    label: 'Offline sync metric real', kind: 'auto', severity: 'warning' },
  { id: 'J.noFakeRevenue', section: 'founderDashboard',
    label: 'No fake revenue', kind: 'auto', severity: 'blocker' },
  { id: 'J.noFakeNgo',     section: 'founderDashboard',
    label: 'No fake NGO metrics', kind: 'auto', severity: 'blocker' },
  { id: 'J.noFakeCust',    section: 'founderDashboard',
    label: 'No fake customer counts', kind: 'auto', severity: 'blocker' },
];

/** Frozen consolidated list for diagnostics + UI consumers. */
export const RELEASE_CHECKLIST: ReadonlyArray<ChecklistItem> = Object.freeze(
  [].concat(
    A_SCAN_RUNTIME as any, B_PLANT_RUNTIME as any, C_SCAN_TO_PLANT as any,
    D_MY_PLANTS as any, E_PROFILE as any, F_TIMELINE as any,
    G_KNOWLEDGE as any, H_BRIEFING as any, I_MEDIA as any, J_FOUNDER as any,
    NO_FARMER_DASHBOARD as any,
  ).map((i: any) => Object.freeze(i))
);

export function sectionItems(section: ReleaseSectionKey):
    ReadonlyArray<ChecklistItem> {
  try {
    return Object.freeze(
      RELEASE_CHECKLIST.filter((i) => i.section === section));
  } catch { return Object.freeze([]); }
}

/** Compile-time sanity — every checklist item maps to a known section. */
const _knownSections = new Set<string>(RELEASE_SECTIONS as readonly string[]);
for (const i of RELEASE_CHECKLIST) {
  if (!_knownSections.has(i.section)) {
    // eslint-disable-next-line no-console
    console.warn('[release-checklist] unknown section', i.id, i.section);
  }
}
