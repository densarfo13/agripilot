import prisma from './prisma.js';

export async function writeAuditLog(req, { userId = null, action, entityType = null, entityId = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: metadata,
        ipAddress: req.ip || null,
        // userAgent stored in details since existing AuditLog model doesn't have a dedicated column
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
