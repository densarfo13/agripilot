/**
 * organizations.js — client wrapper for the organization dashboard
 * + farmer-management endpoints.
 *
 *   fetchOrganizationDashboard(orgId, { windowDays? })
 *     → GET  /api/organizations/:id/dashboard
 *   listOrganizationFarmers(orgId, { region?, crop?, scoreMin?,
 *                                     scoreMax?, page?, limit? })
 *     → GET  /api/organizations/:id/farmers
 *   exportOrganizationFarmersCsv(orgId, filters?)
 *     → triggers browser download of the CSV
 *   exportOrganizationDashboardCsv(orgId, { windowDays? })
 *     → compact-report CSV download
 *
 * All helpers swallow errors and return null / empty on failure
 * so UI never hangs on a broken API call.
 */

async function handle(res) {
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const code = (body && (body.error || body.reason)) || `request_failed_${res.status}`;
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return body;
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

export async function fetchOrganizationDashboard(orgId, { windowDays } = {}) {
  if (!orgId) return null;
  try {
    const qs = buildQuery({ windowDays });
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(orgId)}/dashboard${qs ? `?${qs}` : ''}`,
      { credentials: 'include' });
    return await handle(res);
  } catch {
    return null;
  }
}

export async function listOrganizationFarmers(orgId, filters = {}) {
  if (!orgId) return { data: [], total: 0, page: 1, limit: 50 };
  try {
    const qs = buildQuery({
      region:   filters.region   || '',
      crop:     filters.crop     || '',
      scoreMin: filters.scoreMin ?? '',
      scoreMax: filters.scoreMax ?? '',
      page:     filters.page     || '',
      limit:    filters.limit    || '',
    });
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(orgId)}/farmers${qs ? `?${qs}` : ''}`,
      { credentials: 'include' });
    return await handle(res);
  } catch {
    return { data: [], total: 0, page: 1, limit: 50 };
  }
}

/**
 * Trigger a CSV download. Uses an anchor click so the browser
 * handles the filename + save dialog.
 */
export async function exportOrganizationFarmersCsv(orgId, filters = {}) {
  if (!orgId) return false;
  const qs = buildQuery({
    kind:     'farmers',
    region:   filters.region   || '',
    crop:     filters.crop     || '',
    scoreMin: filters.scoreMin ?? '',
    scoreMax: filters.scoreMax ?? '',
    limit:    filters.limit    || 1000,
  });
  const url = `/api/organizations/${encodeURIComponent(orgId)}/export?${qs}`;
  return downloadUrl(url);
}

export async function exportOrganizationDashboardCsv(orgId, { windowDays } = {}) {
  if (!orgId) return false;
  const qs = buildQuery({ kind: 'dashboard', windowDays });
  const url = `/api/organizations/${encodeURIComponent(orgId)}/export?${qs}`;
  return downloadUrl(url);
}

async function downloadUrl(url) {
  try {
    if (typeof window === 'undefined' || !window.document) return false;
    // Same-origin fetch with credentials, then build an object URL
    // so we don't need a full page navigation.
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    // Filename suggestion from the server's Content-Disposition.
    const disp = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(disp);
    const filename = match ? match[1] : 'farroway_export.csv';
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return true;
  } catch {
    return false;
  }
}
