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

export async function getTodayFeed() {
  return handle(await fetch('/api/v2/farmer/today', { credentials: 'include' }));
}
