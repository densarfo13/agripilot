// runtime/data/managedPlants.js — Wave 4 RUNTIME facade.
//
// Re-exports the managed-plant storage facade so UI pages can
// import from the runtime layer (UI → runtime is allowed; UI →
// service is not). Mirrors the runtime/data/scanHistory.js
// pattern for the wave-5 single-writer convention.
export * from '../../data/managedPlantsStore.js';
