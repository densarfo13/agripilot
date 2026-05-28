// runtime/data/scanHistory.js — Wave 4 RUNTIME facade.
// NOTE: For READ-side scan history, prefer src/hooks/useScanHistory.js
// (the dedicated hook with cross-tab refresh). This facade exists for
// the legacy ScanPage write path which still references saveScanEntry
// directly; that call site is gated behind `if (false)` dead-code paths
// after the scanPersistenceBridge migration.
export * from '../../data/scanHistory.js';
