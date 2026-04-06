import prisma from '../../config/database.js';

/**
 * Officer Validation Service
 *
 * Field officers validate farmer-reported season data to increase trust.
 * Validation types: stage, condition, harvest, milestone, credibility.
 *
 * Officers can only validate seasons for farmers assigned to them.
 * Validations are immutable records — append-only, no edits.
 *
 * Each validation improves credibility scoring for the season.
 */

const VALID_TYPES = ['stage', 'condition', 'harvest', 'milestone', 'credibility'];
const VALID_CONDITIONS = ['good', 'average', 'poor'];
const VALID_STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];

export async function createOfficerValidation(seasonId, officerId, data) {
  // Verify season exists
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { farmer: { select: { id: true, assignedOfficerId: true } } },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  // Verify officer is assigned to this farmer
  if (season.farmer.assignedOfficerId !== officerId) {
    // Check if user is admin (admins can validate any farmer)
    // This check is done at route level — here we just enforce assignment for field officers
    const officer = await prisma.user.findUnique({
      where: { id: officerId },
      select: { role: true },
    });
    if (!officer || (officer.role !== 'super_admin' && officer.role !== 'institutional_admin')) {
      const err = new Error('Officer not assigned to this farmer — cannot validate');
      err.statusCode = 403;
      throw err;
    }
  }

  // Validate type
  if (!data.validationType || !VALID_TYPES.includes(data.validationType)) {
    const err = new Error(`validationType is required and must be one of: ${VALID_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Validate conditional fields
  if (data.confirmedStage && !VALID_STAGES.includes(data.confirmedStage)) {
    const err = new Error(`confirmedStage must be one of: ${VALID_STAGES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (data.confirmedCondition && !VALID_CONDITIONS.includes(data.confirmedCondition)) {
    const err = new Error(`confirmedCondition must be one of: ${VALID_CONDITIONS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const validation = await prisma.officerValidation.create({
    data: {
      seasonId,
      officerId,
      validationType: data.validationType,
      confirmedStage: data.confirmedStage || null,
      confirmedCondition: data.confirmedCondition || null,
      confirmedHarvest: data.confirmedHarvest !== undefined ? !!data.confirmedHarvest : null,
      note: data.note || null,
      validatedAt: data.validatedAt ? new Date(data.validatedAt) : new Date(),
    },
  });

  return validation;
}

export async function listOfficerValidations(seasonId) {
  const season = await prisma.farmSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.officerValidation.findMany({
    where: { seasonId },
    orderBy: { validatedAt: 'desc' },
  });
}

/**
 * Get a validation summary for a season — useful for trust views.
 */
export async function getValidationSummary(seasonId) {
  const validations = await prisma.officerValidation.findMany({
    where: { seasonId },
    orderBy: { validatedAt: 'asc' },
  });

  if (validations.length === 0) {
    return {
      seasonId,
      hasValidation: false,
      totalValidations: 0,
      types: [],
      latestValidation: null,
      stageConfirmed: false,
      conditionConfirmed: false,
      harvestConfirmed: false,
    };
  }

  const types = [...new Set(validations.map(v => v.validationType))];
  const latest = validations[validations.length - 1];
  const stageValidations = validations.filter(v => v.confirmedStage);
  const conditionValidations = validations.filter(v => v.confirmedCondition);
  const harvestValidations = validations.filter(v => v.confirmedHarvest === true);

  return {
    seasonId,
    hasValidation: true,
    totalValidations: validations.length,
    types,
    latestValidation: {
      type: latest.validationType,
      date: latest.validatedAt,
      note: latest.note,
    },
    stageConfirmed: stageValidations.length > 0,
    latestConfirmedStage: stageValidations.length > 0
      ? stageValidations[stageValidations.length - 1].confirmedStage : null,
    conditionConfirmed: conditionValidations.length > 0,
    latestConfirmedCondition: conditionValidations.length > 0
      ? conditionValidations[conditionValidations.length - 1].confirmedCondition : null,
    harvestConfirmed: harvestValidations.length > 0,
  };
}
