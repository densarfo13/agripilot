import prisma from '../../config/database.js';

/**
 * Write an audit log entry.
 * Called by every major workflow action.
 */
export async function writeAuditLog({
  applicationId = null,
  userId,
  action,
  details = null,
  previousStatus = null,
  newStatus = null,
  ipAddress = null,
}) {
  return prisma.auditLog.create({
    data: {
      applicationId,
      userId,
      action,
      details,
      previousStatus,
      newStatus,
      ipAddress,
    },
  });
}
