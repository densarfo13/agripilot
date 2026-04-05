import prisma from '../../config/database.js';

export async function createFieldVisit(applicationId, officerId, data) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.fieldVisit.create({
    data: {
      applicationId,
      officerId,
      visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
      notes: data.notes || null,
      findings: data.findings || null,
      completed: data.completed || false,
    },
    include: { officer: { select: { id: true, fullName: true } } },
  });
}

export async function listFieldVisits(applicationId) {
  return prisma.fieldVisit.findMany({
    where: { applicationId },
    include: { officer: { select: { id: true, fullName: true } } },
    orderBy: { visitDate: 'desc' },
  });
}

export async function completeFieldVisit(visitId, findings, notes) {
  const visit = await prisma.fieldVisit.findUnique({ where: { id: visitId } });
  if (!visit) {
    const err = new Error('Field visit not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.fieldVisit.update({
    where: { id: visitId },
    data: {
      completed: true,
      findings: findings || visit.findings,
      notes: notes || visit.notes,
    },
    include: { officer: { select: { id: true, fullName: true } } },
  });
}

export async function getMyFieldVisits(officerId) {
  return prisma.fieldVisit.findMany({
    where: { officerId },
    include: {
      application: {
        select: {
          id: true, status: true, cropType: true,
          farmer: { select: { fullName: true, region: true, village: true } },
        },
      },
    },
    orderBy: { visitDate: 'desc' },
  });
}
