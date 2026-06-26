/**
 * DigitalTwin.ts — Farroway v13 agricultural digital twin (honest).
 *
 * A real node hierarchy — Farm › Field › Zone › Bed › Greenhouse › Container ›
 * Tree › Plant — that scans update. The twin holds LAST-KNOWN state plus honest
 * staleness; it does NOT fabricate a "continuous future prediction". Future state
 * is only ever an explicit, evidence-tagged estimate when a real basis exists
 * (e.g. a crop-calendar harvest date), otherwise `unknown`.
 *
 * Pure, total, browser-safe. No network, no clock dependence (callers pass nowMs).
 */
export type TwinNodeType =
  | 'farm' | 'field' | 'zone' | 'bed' | 'greenhouse' | 'container' | 'tree' | 'plant';

export const TWIN_NODE_TYPES: ReadonlyArray<TwinNodeType> = Object.freeze([
  'farm', 'field', 'zone', 'bed', 'greenhouse', 'container', 'tree', 'plant',
]);

export type TwinHealth = 'unknown' | 'ok' | 'watch' | 'at_risk';

export interface TwinNode {
  id: string;
  type: TwinNodeType;
  parentId: string | null;
  label: string;
  crop: string | null;
  plantingDate: string | null;
  lastScanMs: number | null;
  lastHealth: TwinHealth;       // last OBSERVED health — never a forecast
  observationCount: number;
  /** Honest forward estimate: only set when an evidence basis exists. */
  estimatedHarvestDate: string | null;
  estimateBasis: string | null; // e.g. 'crop-calendar' — null means no estimate
}

export interface TwinUpdate {
  nodeId: string;
  scanMs: number;
  health?: TwinHealth;
  crop?: string | null;
  plantingDate?: string | null;
  estimatedHarvestDate?: string | null;
  estimateBasis?: string | null;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const VALID_HEALTH: TwinHealth[] = ['unknown', 'ok', 'watch', 'at_risk'];

export function createTwinNode(input: Partial<TwinNode> & { id: string; type: TwinNodeType }): TwinNode {
  return Object.freeze({
    id: _str(input.id) || 'node',
    type: TWIN_NODE_TYPES.includes(input.type) ? input.type : 'plant',
    parentId: input.parentId ?? null,
    label: _str(input.label) || _str(input.id),
    crop: input.crop ?? null,
    plantingDate: input.plantingDate ?? null,
    lastScanMs: input.lastScanMs ?? null,
    lastHealth: VALID_HEALTH.includes(input.lastHealth as TwinHealth) ? (input.lastHealth as TwinHealth) : 'unknown',
    observationCount: Number.isFinite(input.observationCount as number) ? (input.observationCount as number) : 0,
    estimatedHarvestDate: input.estimatedHarvestDate ?? null,
    estimateBasis: input.estimateBasis ?? null,
  });
}

/**
 * Apply a scan to a twin node → a NEW node (immutable). Updates last-known state;
 * a forward estimate is carried ONLY when the update names a real basis.
 */
export function applyScanToTwin(node: TwinNode, update: TwinUpdate): TwinNode {
  return _safe(() => {
    if (!node || update.nodeId !== node.id) return node;
    const health = VALID_HEALTH.includes(update.health as TwinHealth) ? (update.health as TwinHealth) : node.lastHealth;
    // A harvest estimate is only honest if a basis is named. No basis → drop it.
    const hasBasis = !!update.estimateBasis && !!update.estimatedHarvestDate;
    return Object.freeze({
      ...node,
      crop: update.crop ?? node.crop,
      plantingDate: update.plantingDate ?? node.plantingDate,
      lastScanMs: Number.isFinite(update.scanMs) ? update.scanMs : node.lastScanMs,
      lastHealth: health,
      observationCount: node.observationCount + 1,
      estimatedHarvestDate: hasBasis ? update.estimatedHarvestDate! : node.estimatedHarvestDate,
      estimateBasis: hasBasis ? update.estimateBasis! : node.estimateBasis,
    });
  }, node);
}

export type TwinStaleness = 'never_scanned' | 'fresh' | 'aging' | 'stale';

/** Honest staleness from the last scan — NOT a prediction, just elapsed time. */
export function twinStaleness(node: TwinNode, nowMs: number): TwinStaleness {
  if (!node || node.lastScanMs == null) return 'never_scanned';
  const days = (nowMs - node.lastScanMs) / 86_400_000;
  if (days <= 7) return 'fresh';
  if (days <= 30) return 'aging';
  return 'stale';
}

/** Roll observed health up a subtree. Worst observed child wins; unknown if none. */
export function rollUpHealth(nodes: ReadonlyArray<TwinNode>): TwinHealth {
  return _safe(() => {
    const order: TwinHealth[] = ['at_risk', 'watch', 'ok'];
    for (const h of order) if (nodes.some(n => n.lastHealth === h)) return h;
    return 'unknown';
  }, 'unknown');
}

export function digitalTwinHealth() {
  const farm = createTwinNode({ id: 'farm-1', type: 'farm', label: 'Farm' });
  const plant = createTwinNode({ id: 'p-1', type: 'plant', parentId: 'farm-1', crop: 'maize' });
  const scanned = applyScanToTwin(plant, { nodeId: 'p-1', scanMs: 1000, health: 'watch' });
  const noBasis = applyScanToTwin(plant, { nodeId: 'p-1', scanMs: 1000, estimatedHarvestDate: '2026-09-01' }); // no basis → dropped
  return Object.freeze({
    ok: true,
    nodeTypes: TWIN_NODE_TYPES.length,
    updatesLastKnown: scanned.observationCount === 1 && scanned.lastHealth === 'watch',
    // Honesty: a forward estimate without a named basis is NEVER carried.
    predictionNeverFabricated: noBasis.estimatedHarvestDate === null,
    stalenessIsElapsedOnly: twinStaleness(farm, 2000) === 'never_scanned',
  });
}

export function installDigitalTwinHealth(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__digitalTwinHealth) return;
    Object.defineProperty(window, '__digitalTwinHealth', {
      configurable: true, enumerable: false, writable: false, value: () => digitalTwinHealth(),
    });
  }, undefined);
}
