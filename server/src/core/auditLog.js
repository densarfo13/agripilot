/**
 * auditLog.js — helper for writing audit rows. Never throws,
 * never blocks the caller. Meant to be called in fire-and-forget
 * style after the primary write succeeds so NGO dashboards can
 * answer "who did what, when".
 *
 *   logAuditAction(prisma, {
 *     actorId, actorRole, action, targetId, targetKind,
 *     payload, ip, userAgent,
 *   })
 */

const ALLOWED_ACTIONS = Object.freeze(new Set([
  'ngo_import',
  'ngo_import_failed',
  'farmer_update',
  'farm_created',
  'farm_switched',
  'program_change',
  'payment_initiated',
  'payment_failed',
  'admin_login',
  'csv_export',
  'role_change',
]));

const ALLOWED_TARGET_KINDS = Object.freeze(new Set([
  'farm', 'user', 'listing', 'program', 'payment',
]));

async function logAuditAction(prisma, input = {}) {
  if (!prisma?.auditLog?.create) return { ok: false, reason: 'no_prisma' };
  const {
    actorId    = null,
    actorRole  = null,
    action,
    targetId   = null,
    targetKind = null,
    payload    = null,
    ip         = null,
    userAgent  = null,
  } = input;

  if (!action || typeof action !== 'string') {
    return { ok: false, reason: 'missing_action' };
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return { ok: false, reason: 'unknown_action', action };
  }
  if (targetKind && !ALLOWED_TARGET_KINDS.has(targetKind)) {
    return { ok: false, reason: 'unknown_target_kind', targetKind };
  }

  try {
    const row = await prisma.auditLog.create({
      data: {
        actorId, actorRole,
        action,
        targetId, targetKind,
        payload: payload ?? undefined,
        ip, userAgent,
      },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLog]', err?.message || err);
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

export { logAuditAction, ALLOWED_ACTIONS, ALLOWED_TARGET_KINDS };
export default { logAuditAction, ALLOWED_ACTIONS, ALLOWED_TARGET_KINDS };
