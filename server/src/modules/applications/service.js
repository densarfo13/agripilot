import prisma from '../../config/database.js';

const FULL_INCLUDE = {
  farmer: { select: { id: true, fullName: true, phone: true, region: true, primaryCrop: true, countryCode: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  assignedFieldOfficer: { select: { id: true, fullName: true, email: true } },
  farmLocation: true,
  farmBoundary: { include: { points: { orderBy: { pointOrder: 'asc' } } } },
  evidenceFiles: true,
  verificationResult: true,
  fraudResult: true,
  decisionResult: true,
  benchmarkResult: true,
  intelligenceResult: true,
  reviewAssignments: { include: { reviewer: { select: { id: true, fullName: true } } } },
  reviewNotes: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' } },
  fieldVisits: { include: { officer: { select: { id: true, fullName: true } } }, orderBy: { visitDate: 'desc' } },
};

// ═══════════════════════════════════════════════════════
//  Valid state transitions
// ═══════════════════════════════════════════════════════
const VALID_TRANSITIONS = {
  draft:                ['submitted'],
  submitted:            ['under_review', 'rejected'],
  under_review:         ['approved', 'conditional_approved', 'rejected', 'needs_more_evidence', 'escalated', 'fraud_hold', 'field_review_required'],
  needs_more_evidence:  ['under_review', 'rejected'],
  field_review_required:['under_review', 'rejected'],
  escalated:            ['under_review', 'approved', 'rejected'],
  fraud_hold:           ['under_review', 'rejected'],
  conditional_approved: ['approved', 'rejected', 'disbursed'],
  approved:             ['disbursed', 'fraud_hold'],
  rejected:             ['under_review'],  // reopen
  disbursed:            [],
};

function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition from '${currentStatus}' to '${newStatus}'`);
    err.statusCode = 400;
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
//  CRUD
// ═══════════════════════════════════════════════════════

export async function createApplication(data, userId) {
  const farmer = await prisma.farmer.findUnique({ where: { id: data.farmerId } });
  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.application.create({
    data: {
      farmerId: data.farmerId,
      createdById: userId,
      cropType: data.cropType,
      farmSizeAcres: parseFloat(data.farmSizeAcres),
      requestedAmount: parseFloat(data.requestedAmount),
      purpose: data.purpose || null,
      season: data.season || null,
      currencyCode: data.currencyCode || farmer.countryCode === 'TZ' ? 'TZS' : 'KES',
    },
    include: FULL_INCLUDE,
  });
}

export async function listApplications({ page = 1, limit = 20, status, farmerId, search, assignedReviewerId }) {
  const where = {};
  if (status) where.status = status;
  if (farmerId) where.farmerId = farmerId;
  if (assignedReviewerId) where.assignedReviewerId = assignedReviewerId;
  if (search) {
    where.OR = [
      { farmer: { fullName: { contains: search, mode: 'insensitive' } } },
      { cropType: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        farmer: { select: { id: true, fullName: true, region: true, countryCode: true } },
        createdBy: { select: { id: true, fullName: true } },
        verificationResult: { select: { verificationScore: true, confidence: true } },
        fraudResult: { select: { fraudRiskLevel: true, fraudRiskScore: true } },
        decisionResult: { select: { decision: true, riskLevel: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getApplicationById(id) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: FULL_INCLUDE,
  });
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  return app;
}

export async function updateApplication(id, data) {
  await getApplicationById(id);
  const updateData = {};
  if (data.cropType) updateData.cropType = data.cropType;
  if (data.farmSizeAcres !== undefined) updateData.farmSizeAcres = parseFloat(data.farmSizeAcres);
  if (data.requestedAmount !== undefined) updateData.requestedAmount = parseFloat(data.requestedAmount);
  if (data.purpose !== undefined) updateData.purpose = data.purpose;
  if (data.season !== undefined) updateData.season = data.season;
  if (data.currencyCode) updateData.currencyCode = data.currencyCode;

  return prisma.application.update({
    where: { id },
    data: updateData,
    include: FULL_INCLUDE,
  });
}

export async function getApplicationStats() {
  const statusCounts = await prisma.application.groupBy({
    by: ['status'],
    _count: true,
  });

  const totalRequested = await prisma.application.aggregate({
    _sum: { requestedAmount: true },
    _count: true,
    _avg: { requestedAmount: true, farmSizeAcres: true },
  });

  return { statusCounts, aggregates: totalRequested };
}

// ═══════════════════════════════════════════════════════
//  WORKFLOW ACTIONS
// ═══════════════════════════════════════════════════════

export async function submitApplication(id) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'submitted');
  return prisma.application.update({
    where: { id },
    data: { status: 'submitted' },
    include: FULL_INCLUDE,
  });
}

export async function approveApplication(id, userId, { reason, recommendedAmount } = {}) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'approved');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'approved' },
    include: FULL_INCLUDE,
  });

  // Add review note if reason provided
  if (reason) {
    await prisma.reviewNote.create({
      data: { applicationId: id, authorId: userId, content: `Approved: ${reason}`, internal: false },
    });
  }

  return { application: updated, previousStatus: app.status };
}

export async function rejectApplication(id, userId, reason) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'rejected');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'rejected' },
    include: FULL_INCLUDE,
  });

  await prisma.reviewNote.create({
    data: { applicationId: id, authorId: userId, content: `Rejected: ${reason}`, internal: false },
  });

  return { application: updated, previousStatus: app.status };
}

export async function escalateApplication(id, userId, reason) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'escalated');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'escalated' },
    include: FULL_INCLUDE,
  });

  await prisma.reviewNote.create({
    data: { applicationId: id, authorId: userId, content: `Escalated: ${reason}`, internal: true },
  });

  return { application: updated, previousStatus: app.status };
}

export async function disburseApplication(id, userId, { reason } = {}) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'disbursed');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'disbursed' },
    include: FULL_INCLUDE,
  });

  if (reason) {
    await prisma.reviewNote.create({
      data: { applicationId: id, authorId: userId, content: `Disbursed: ${reason}`, internal: false },
    });
  }

  return { application: updated, previousStatus: app.status };
}

export async function reopenApplication(id, userId, reason) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'under_review');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'under_review' },
    include: FULL_INCLUDE,
  });

  if (reason) {
    await prisma.reviewNote.create({
      data: { applicationId: id, authorId: userId, content: `Reopened: ${reason}`, internal: true },
    });
  }

  return { application: updated, previousStatus: app.status };
}

export async function requestEvidence(id, userId, { reason, requiredTypes }) {
  const app = await getApplicationById(id);
  validateTransition(app.status, 'needs_more_evidence');

  const updated = await prisma.application.update({
    where: { id },
    data: { status: 'needs_more_evidence' },
    include: FULL_INCLUDE,
  });

  await prisma.reviewNote.create({
    data: {
      applicationId: id, authorId: userId,
      content: `Evidence requested: ${reason}${requiredTypes ? ` (Types: ${requiredTypes.join(', ')})` : ''}`,
      internal: false,
    },
  });

  return { application: updated, previousStatus: app.status };
}

export async function updateStatus(id, newStatus, userId) {
  const app = await getApplicationById(id);
  validateTransition(app.status, newStatus);
  const previousStatus = app.status;

  const updated = await prisma.application.update({
    where: { id },
    data: { status: newStatus },
    include: FULL_INCLUDE,
  });

  return { application: updated, previousStatus };
}

// ═══════════════════════════════════════════════════════
//  ASSIGNMENTS
// ═══════════════════════════════════════════════════════

export async function assignReviewer(applicationId, reviewerId) {
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) {
    const err = new Error('Reviewer not found');
    err.statusCode = 404;
    throw err;
  }
  if (!['reviewer', 'institutional_admin', 'super_admin'].includes(reviewer.role)) {
    const err = new Error('User is not a reviewer');
    err.statusCode = 400;
    throw err;
  }

  await prisma.reviewAssignment.create({
    data: { applicationId, reviewerId, status: 'assigned' },
  });

  return prisma.application.update({
    where: { id: applicationId },
    data: { assignedReviewerId: reviewerId, status: 'under_review' },
    include: FULL_INCLUDE,
  });
}

export async function assignFieldOfficer(applicationId, officerId) {
  const officer = await prisma.user.findUnique({ where: { id: officerId } });
  if (!officer) {
    const err = new Error('Field officer not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: { assignedFieldOfficerId: officerId },
    include: FULL_INCLUDE,
  });
}
