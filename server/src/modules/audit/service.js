import prisma from '../../config/database.js';

/**
 * Write an audit log entry.
 * Called by every major workflow action.
 *
 * Designed to be non-blocking: callers use writeAuditLog({...}).catch(() => {}).
 * If userId is missing or invalid, we still attempt to log with a null userId
 * by catching FK errors gracefully.
 */
export async function writeAuditLog({
  applicationId = null,
  userId = null,
  organizationId = null,
  action,
  details = null,
  previousStatus = null,
  newStatus = null,
  ipAddress = null,
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        applicationId,
        userId,
        organizationId,
        action,
        details,
        previousStatus,
        newStatus,
        ipAddress,
      },
    });
  } catch (err) {
    // If FK constraint fails (user deleted, stale JWT), log to console but don't throw
    if (err.code === 'P2003' || err.code === 'P2025') {
      console.warn(`[AUDIT] FK constraint failed for action="${action}" userId="${userId}" — skipping DB write`);
      return null;
    }
    // For other errors, still log warning and swallow
    console.warn(`[AUDIT] Failed to write log for action="${action}":`, err.message);
    return null;
  }
}
