import prisma from '../../config/database.js';
import { logWorkflowEvent } from '../../utils/opsLogger.js';

/**
 * Harvest Report Service
 *
 * Formal harvest recording. A harvest report transitions the season to 'harvested'
 * (pending final review/closure). Final closure to 'completed' is a separate step.
 *
 * Status flow: active → harvested (on report) → completed (on final review)
 */

export async function createHarvestReport(seasonId, data, userId = null) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { harvestReport: true },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  if (season.status !== 'active') {
    const err = new Error('Harvest report can only be submitted for active seasons');
    err.statusCode = 400;
    throw err;
  }

  if (season.harvestReport) {
    const err = new Error('A harvest report already exists for this season');
    err.statusCode = 409;
    throw err;
  }

  if (!data.totalHarvestKg || parseFloat(data.totalHarvestKg) <= 0) {
    const err = new Error('totalHarvestKg is required and must be positive');
    err.statusCode = 400;
    throw err;
  }

  const totalHarvestKg = parseFloat(data.totalHarvestKg);

  // Auto-compute yield per acre if farm size is known
  const yieldPerAcre = data.yieldPerAcre
    ? parseFloat(data.yieldPerAcre)
    : season.farmSizeAcres > 0
      ? Math.round((totalHarvestKg / season.farmSizeAcres) * 100) / 100
      : null;

  const now = new Date();

  // Create report + transition to 'harvested' in an interactive transaction
  // Uses optimistic lock (status condition) to prevent concurrent double-harvest
  const report = await prisma.$transaction(async (tx) => {
    // Optimistic lock: only update if status is still 'active'
    const lockResult = await tx.farmSeason.updateMany({
      where: { id: seasonId, status: 'active' },
      data: {
        status: 'harvested',
        closedAt: now,
        closedBy: userId,
        closureReason: 'Harvest report submitted',
      },
    });

    if (lockResult.count === 0) {
      const err = new Error('Season status changed concurrently — please retry');
      err.statusCode = 409;
      throw err;
    }

    return tx.harvestReport.create({
      data: {
        seasonId,
        totalHarvestKg,
        yieldPerAcre,
        salesAmount: data.salesAmount ? parseFloat(data.salesAmount) : null,
        salesCurrency: data.salesCurrency || null,
        notes: data.notes || null,
      },
    });
  });

  logWorkflowEvent('season_status_changed', {
    seasonId,
    fromStatus: 'active',
    toStatus: 'harvested',
    userId,
    trigger: 'harvest_report',
  });

  return report;
}

/**
 * Update/correct an existing harvest report.
 * Only allowed when the season has been reopened (status = 'active') and a report exists.
 * This supports the correction flow: reopen → fix harvest data → re-submit.
 */
export async function updateHarvestReport(seasonId, data, userId = null) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { harvestReport: true },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  if (!season.harvestReport) {
    const err = new Error('No harvest report exists to correct. Submit a new one instead.');
    err.statusCode = 404;
    throw err;
  }

  // Only allow corrections on reopened (active) seasons
  if (season.status !== 'active') {
    const err = new Error('Harvest report can only be corrected on reopened (active) seasons. Reopen the season first.');
    err.statusCode = 400;
    throw err;
  }

  const updateData = {};
  if (data.totalHarvestKg !== undefined) {
    const val = parseFloat(data.totalHarvestKg);
    if (isNaN(val) || val <= 0) {
      const err = new Error('totalHarvestKg must be positive');
      err.statusCode = 400;
      throw err;
    }
    updateData.totalHarvestKg = val;
    // Recompute yield if farm size is known
    if (season.farmSizeAcres > 0) {
      updateData.yieldPerAcre = Math.round((val / season.farmSizeAcres) * 100) / 100;
    }
  }
  if (data.yieldPerAcre !== undefined) updateData.yieldPerAcre = parseFloat(data.yieldPerAcre);
  if (data.salesAmount !== undefined) updateData.salesAmount = data.salesAmount ? parseFloat(data.salesAmount) : null;
  if (data.salesCurrency !== undefined) updateData.salesCurrency = data.salesCurrency || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No fields to update');
    err.statusCode = 400;
    throw err;
  }

  const updated = await prisma.harvestReport.update({
    where: { seasonId },
    data: updateData,
  });

  logWorkflowEvent('harvest_report_corrected', {
    seasonId,
    userId,
    corrections: Object.keys(updateData),
  });

  return updated;
}

export async function getHarvestReport(seasonId) {
  const report = await prisma.harvestReport.findUnique({
    where: { seasonId },
    include: {
      season: {
        select: {
          id: true, cropType: true, farmSizeAcres: true, plantingDate: true,
          expectedHarvestDate: true, status: true,
          farmer: { select: { id: true, fullName: true, region: true } },
        },
      },
    },
  });
  if (!report) {
    const err = new Error('No harvest report found for this season');
    err.statusCode = 404;
    throw err;
  }
  return report;
}
