/**
 * smartAlertDispatcher.js — persists smart-alert engine output as
 * FarmerNotification rows.
 *
 *   dispatchSmartAlerts({ prisma, farmerId, alerts })
 *     → { ok, created: Notification[], skipped: number }
 *
 * Dedup: every alert id is stable for (farmId, date, rule, ref),
 * so we look up any existing notification whose metadata.alertId
 * matches and skip it. This keeps the farmer from getting the same
 * alert five times when the engine runs on every dashboard load.
 *
 * Mapping to FarmerNotification:
 *   notificationType  ← alert.type mapped to the existing enum
 *                       (weather | reminder | system | post_harvest)
 *   title             ← alert.action (imperative)
 *   message           ← alert.reason + ' · ' + alert.consequence
 *   metadata          ← {
 *     kind: 'smart_alert',
 *     alertId: alert.id,
 *     action, reason, consequence, messageKey,
 *     priority, type, triggeredBy,
 *   }
 *
 * Pure-ish: no network, only prisma. Safe to call from an HTTP
 * handler OR a future cron without changes.
 */

// Map engine alert types → FarmerNotification enum values. The
// `market` and `weather` enums already exist; the rest collapse to
// 'reminder' which is the closest generic farm-guidance type.
const TYPE_MAP = Object.freeze({
  weather:          'weather',
  pest:             'reminder',
  disease:          'reminder',
  missed_task:      'reminder',
  planting_window:  'reminder',
  yield:            'reminder',
  stage_transition: 'reminder',
});

function toNotificationType(alertType) {
  return TYPE_MAP[alertType] || 'reminder';
}

/**
 * dispatchSmartAlerts({ prisma, farmerId, alerts })
 */
export async function dispatchSmartAlerts({ prisma, farmerId, alerts = [] } = {}) {
  if (!prisma?.farmerNotification?.create || !prisma?.farmerNotification?.findMany) {
    return { ok: false, reason: 'no_prisma', created: [], skipped: 0 };
  }
  if (!farmerId || typeof farmerId !== 'string') {
    return { ok: false, reason: 'missing_farmer_id', created: [], skipped: 0 };
  }
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return { ok: true, created: [], skipped: 0 };
  }

  // ── Load existing alert IDs to dedup ─────────────────────────
  const existing = await prisma.farmerNotification.findMany({
    where: { farmerId, notificationType: { in: ['reminder', 'weather'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const existingAlertIds = new Set();
  for (const n of existing) {
    let meta = n.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (meta && meta.kind === 'smart_alert' && typeof meta.alertId === 'string') {
      existingAlertIds.add(meta.alertId);
    }
  }

  // ── Create new notifications ─────────────────────────────────
  const created = [];
  let skipped = 0;
  for (const a of alerts) {
    if (!a || !a.id) { skipped += 1; continue; }
    if (existingAlertIds.has(a.id)) { skipped += 1; continue; }
    try {
      const row = await prisma.farmerNotification.create({
        data: {
          farmerId,
          notificationType: toNotificationType(a.type),
          title:   a.action || 'New farm alert',
          message: [a.reason, a.consequence].filter(Boolean).join(' · '),
          metadata: {
            kind:        'smart_alert',
            alertId:     a.id,
            action:      a.action,
            reason:      a.reason,
            consequence: a.consequence,
            messageKey:  a.messageKey || null,
            priority:    a.priority || 'medium',
            type:        a.type || 'reminder',
            triggeredBy: a.triggeredBy || null,
          },
        },
      });
      created.push(row);
    } catch (err) {
      // Skip but don't fail the batch — one bad row shouldn't block
      // the rest of the alerts from landing.
      skipped += 1;
    }
  }

  return { ok: true, created, skipped };
}

export const _internal = Object.freeze({ TYPE_MAP, toNotificationType });
