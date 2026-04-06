import prisma from '../../config/database.js';

export async function addReviewNote(applicationId, authorId, content, internal = true) {
  // Verify application exists
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.reviewNote.create({
    data: { applicationId, authorId, content, internal },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  });
}

export async function listReviewNotes(applicationId) {
  return prisma.reviewNote.findMany({
    where: { applicationId },
    include: { author: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getReviewAssignments(applicationId) {
  return prisma.reviewAssignment.findMany({
    where: { applicationId },
    include: { reviewer: { select: { id: true, fullName: true, email: true } } },
    orderBy: { assignedAt: 'desc' },
  });
}

export async function completeReviewAssignment(assignmentId, reviewerId) {
  const assignment = await prisma.reviewAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    const err = new Error('Review assignment not found');
    err.statusCode = 404;
    throw err;
  }
  if (assignment.reviewerId !== reviewerId) {
    const err = new Error('Only the assigned reviewer can complete this assignment');
    err.statusCode = 403;
    throw err;
  }
  if (assignment.status === 'completed') {
    const err = new Error('Review assignment is already completed');
    err.statusCode = 409;
    throw err;
  }

  return prisma.reviewAssignment.update({
    where: { id: assignmentId },
    data: { status: 'completed', completedAt: new Date() },
  });
}

export async function getMyAssignments(reviewerId, status) {
  const where = { reviewerId };
  if (status) where.status = status;

  return prisma.reviewAssignment.findMany({
    where,
    include: {
      application: {
        include: {
          farmer: { select: { id: true, fullName: true, region: true } },
          verificationResult: { select: { verificationScore: true, confidence: true } },
          fraudResult: { select: { fraudRiskLevel: true } },
          decisionResult: { select: { decision: true } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}
