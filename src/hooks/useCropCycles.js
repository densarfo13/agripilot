/**
 * useCropCycles — tiny wrappers around the crop-cycle endpoints.
 *
 *   startCropCycle(farmProfileId, recommendation, plantedDate)
 *   listCropCycles()
 *   getCropCycle(id)
 *   completeCycleTask(taskId, note)
 *   getTodayFeed()
 */

async function handle(res) {
  if (!res.ok) {
    let code = `request_failed_${res.status}`;
    try { code = (await res.json())?.error || code; } catch { /* ignore */ }
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const JSON_POST = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
};

export async function startCropCycle({ farmProfileId, recommendation, plantedDate }) {
  return handle(await fetch('/api/v2/crop-cycles', {
    ...JSON_POST,
    body: JSON.stringify({ farmProfileId, recommendation, plantedDate }),
  }));
}

export async function listCropCycles() {
  return handle(await fetch('/api/v2/crop-cycles', { credentials: 'include' }));
}

export async function getCropCycle(id) {
  return handle(await fetch(`/api/v2/crop-cycles/${encodeURIComponent(id)}`, { credentials: 'include' }));
}

export async function completeCycleTask(taskId, note) {
  return handle(await fetch(`/api/v2/crop-cycles/tasks/${encodeURIComponent(taskId)}/complete`, {
    ...JSON_POST,
    body: JSON.stringify({ note }),
  }));
}

export async function skipCycleTask(taskId, reason) {
  return handle(await fetch(`/api/v2/crop-cycles/tasks/${encodeURIComponent(taskId)}/skip`, {
    ...JSON_POST,
    body: JSON.stringify({ reason }),
  }));
}

export async function reportCycleIssue(cycleId, { category, severity, description, photoUrl } = {}) {
  return handle(await fetch(`/api/v2/crop-cycles/${encodeURIComponent(cycleId)}/issues`, {
    ...JSON_POST,
    body: JSON.stringify({ category, severity, description, photoUrl }),
  }));
}

export async function submitCycleHarvest(cycleId, {
  actualYieldKg, yieldUnit, qualityBand, issues, harvestedAt, notes,
} = {}) {
  return handle(await fetch(`/api/v2/crop-cycles/${encodeURIComponent(cycleId)}/harvest`, {
    ...JSON_POST,
    body: JSON.stringify({
      actualYieldKg, yieldUnit, qualityBand, issues, harvestedAt, notes,
    }),
  }));
}

export async function getTodayFeed() {
  return handle(await fetch('/api/v2/farmer/today', { credentials: 'include' }));
}

export async function getCycleSummary(cycleId) {
  return handle(await fetch(
    `/api/v2/crop-cycles/${encodeURIComponent(cycleId)}/summary`,
    { credentials: 'include' },
  ));
}

export async function getNextCycleOptions(cycleId = null) {
  const q = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
  return handle(await fetch(`/api/v2/farmer/next-cycle-options${q}`, { credentials: 'include' }));
}
