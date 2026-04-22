/**
 * farrowayScore.js — client wrapper for the score-snapshot + history
 * endpoints on the notifications service.
 *
 *   postScoreSnapshot(farmerId, snapshot)
 *     → POST /api/notifications/farmer/:farmerId/score/snapshot
 *
 *   fetchScoreHistory(farmerId, { farmId?, limit? })
 *     → GET  /api/notifications/farmer/:farmerId/score/history
 *     → Array<{ date, overall, band, farmId, id }>  (newest first)
 *
 * Fire-and-forget style: both swallow errors via a fallback
 * because the card already renders a valid score from the local
 * engine even when the server is unreachable.
 */

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function postScoreSnapshot(farmerId, snapshot) {
  if (!farmerId || !snapshot) return null;
  try {
    const res = await fetch(
      `/api/notifications/farmer/${encodeURIComponent(farmerId)}/score/snapshot`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    if (!res.ok) return null;
    return await safeJson(res);
  } catch { return null; }
}

export async function fetchScoreHistory(farmerId, { farmId, limit = 14 } = {}) {
  if (!farmerId) return [];
  try {
    const qs = new URLSearchParams();
    if (farmId) qs.set('farmId', farmId);
    if (limit)  qs.set('limit', String(limit));
    const res = await fetch(
      `/api/notifications/farmer/${encodeURIComponent(farmerId)}/score/history?${qs}`,
      { credentials: 'include' });
    if (!res.ok) return [];
    const body = await safeJson(res);
    return (body && Array.isArray(body.data)) ? body.data : [];
  } catch { return []; }
}
