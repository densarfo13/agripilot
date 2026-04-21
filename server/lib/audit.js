import prisma from './prisma.js';

/**
 * Write an audit log row.
 *
 * The Prisma AuditLog model has no dedicated `entityType` / `entityId`
 * columns — only `details` (Json). We keep the caller-facing shape
 * (`entityType`, `entityId`, `metadata`) so routes never changed, and
 * fold those values into the JSON `details` column here. This is what
 * the sister `src/modules/audit/service.js` writer does implicitly;
 * aligning them fixes every forgot-password / register / reset /
 * farm-profile audit write that was silently erroring on Prisma
 * 6.19.3 with "Unknown argument entityType/entityId".
 *
 * Always non-blocking: failures are logged but never propagate.
 */
export async function writeAuditLog(
  req,
  { userId = null, action, entityType = null, entityId = null, metadata = null } = {},
) {
  try {
    // Compose a safe details payload. Null / undefined keys are dropped
    // so the JSON column stays lean and queryable.
    const details = {};
    if (metadata && typeof metadata === 'object') Object.assign(details, metadata);
    if (entityType) details.entityType = entityType;
    if (entityId)   details.entityId   = entityId;
    const hasDetails = Object.keys(details).length > 0;

    await prisma.auditLog.create({
      data: {
        userId:    userId || null,
        action,
        details:   hasDetails ? details : null,
        ipAddress: (req && req.ip) || null,
      },
    });
  } catch (error) {
    // FK failures (user deleted, stale JWT) are routine — warn, don't
    // scream. Other errors get the full dump so we can diagnose.
    if (error && (error.code === 'P2003' || error.code === 'P2025')) {
      console.warn(`[AUDIT] FK constraint failed for action="${action}" userId="${userId}" — skipping DB write`);
      return;
    }
    console.error('Failed to write audit log:', error);
  }
}
