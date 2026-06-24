/**
 * farmPersistenceBoot.js — FARM_PERSISTENCE_V1 boot + recovery.
 *
 * Installs the sync engine, registers the per-domain hydrators, and pulls
 * authoritative server state into the local caches. Called when a user
 * becomes authenticated (login or restored session) so a farmer who
 * cleared data / switched device gets their plants, scans, and tasks back.
 *
 * Never throws; if anything fails the app falls back to the localStorage
 * cache exactly as before.
 */
let _installed = false;

export async function bootFarmPersistence() {
  try {
    const { installFarmSync, registerHydrator, recoverAll } =
      await import('../../lib/sync/farmSync.js');
    if (!_installed) {
      installFarmSync();
      const [plants, history, tasks, outcomes, timeline] = await Promise.all([
        import('../../data/managedPlantsStore.js'),
        import('../../lib/scan/scanHistoryStore.js'),
        import('../../core/scanToTask.js'),
        import('../../lib/outcomes/outcomeStore.js'),
        import('../../lib/plant/timelineStore.js'),
      ]);
      registerHydrator('plants', plants.hydrateManagedPlants);
      registerHydrator('scanHistory', history.hydrateScanHistory);
      registerHydrator('tasks', tasks.hydrateScanTasks);
      registerHydrator('outcomes', outcomes.hydrateOutcomes);
      registerHydrator('timeline', timeline.hydrateTimeline);
      _installed = true;
    }
    await recoverAll();
    return true;
  } catch {
    return false;
  }
}

export default bootFarmPersistence;
