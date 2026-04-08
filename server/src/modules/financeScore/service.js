/**
 * Farm Finance Score Service
 *
 * Computes a 0–100 readiness score from existing farm data.
 * Weighted, explainable, deterministic — not a credit bureau score.
 */

import prisma from '../../config/database.js';

// ─── Score bands ───────────────────────────────────────

const BANDS = [
  { min: 80, band: 'Strong', readiness: 'Strong funding profile' },
  { min: 60, band: 'Good',   readiness: 'Funding-ready soon' },
  { min: 40, band: 'Fair',   readiness: 'Improving' },
  { min: 0,  band: 'Low',    readiness: 'Not ready yet' },
];

function getBand(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const entry = BANDS.find(b => clamped >= b.min);
  return { score: clamped, band: entry.band, readiness: entry.readiness };
}

// ─── Compute score ─────────────────────────────────────

export async function computeFinanceScore(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    include: {
      recommendations: { orderBy: { createdAt: 'desc' }, take: 20 },
      weatherSnapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }

  const factors = [];
  const nextSteps = [];
  let total = 0;
  let dataPoints = 0;

  // ── 1. Profile completeness (up to 20) ──────────────
  {
    let pts = 0;
    const fields = [
      { key: 'farmerName', label: 'farmer name' },
      { key: 'farmName', label: 'farm name' },
      { key: 'locationName', label: 'location' },
      { key: 'crop', label: 'crop type' },
      { key: 'farmSizeAcres', label: 'farm size' },
      { key: 'latitude', label: 'GPS coordinates' },
    ];
    let filled = 0;
    const missing = [];
    for (const f of fields) {
      if (profile[f.key] != null && profile[f.key] !== '') {
        filled++;
      } else {
        missing.push(f.label);
      }
    }
    pts = Math.round((filled / fields.length) * 20);
    dataPoints += filled;

    factors.push({
      label: 'Profile completeness',
      impact: `+${pts}`,
      maxPoints: 20,
      reason: filled === fields.length
        ? 'Farm profile is complete.'
        : `${filled}/${fields.length} fields filled. Missing: ${missing.join(', ')}.`,
    });
    total += pts;

    if (missing.length > 0) {
      nextSteps.push(`Complete your farm profile: add ${missing.slice(0, 2).join(', ')}`);
    }
  }

  // ── 2. Recommendation completion behavior (up to 25) ─
  {
    const recs = profile.recommendations;
    const total_recs = recs.length;
    const completed = recs.filter(r => r.status === 'completed').length;
    const skipped = recs.filter(r => r.status === 'skipped').length;
    const pending = recs.filter(r => r.status === 'pending').length;

    let pts = 0;
    if (total_recs === 0) {
      pts = 0;
      factors.push({
        label: 'Action completion',
        impact: '+0',
        maxPoints: 25,
        reason: 'No recommendations yet. Generate and complete actions to build your score.',
      });
      nextSteps.push('Generate farm recommendations and mark them as completed');
    } else {
      const completionRate = completed / total_recs;
      pts = Math.round(completionRate * 25);
      // Penalize high skip rate slightly
      if (total_recs > 3 && skipped / total_recs > 0.5) {
        pts = Math.max(0, pts - 5);
      }
      dataPoints += total_recs;

      factors.push({
        label: 'Action completion',
        impact: `+${pts}`,
        maxPoints: 25,
        reason: `${completed}/${total_recs} recommendations completed (${Math.round(completionRate * 100)}%).`,
      });

      if (pending > 0) {
        nextSteps.push(`Complete ${pending} pending recommendation${pending > 1 ? 's' : ''}`);
      }
    }
    total += pts;
  }

  // ── 3. Recency / activity (up to 15) ────────────────
  {
    const recs = profile.recommendations;
    const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days
    const recentRecs = recs.filter(r => new Date(r.createdAt) > recentCutoff);
    const recentCompleted = recentRecs.filter(r => r.status === 'completed').length;

    let pts = 0;
    if (recentRecs.length === 0) {
      pts = 0;
      factors.push({
        label: 'Recent activity',
        impact: '+0',
        maxPoints: 15,
        reason: 'No activity in the last 14 days.',
      });
      nextSteps.push('Stay active — log updates or complete actions weekly');
    } else {
      pts = Math.min(15, recentRecs.length * 3 + recentCompleted * 2);
      dataPoints += recentRecs.length;

      factors.push({
        label: 'Recent activity',
        impact: `+${pts}`,
        maxPoints: 15,
        reason: `${recentRecs.length} action${recentRecs.length > 1 ? 's' : ''} in the last 14 days, ${recentCompleted} completed.`,
      });
    }
    total += pts;
  }

  // ── 4. Farm data quality (up to 10) ─────────────────
  {
    let pts = 0;
    if (profile.farmSizeAcres && profile.farmSizeAcres > 0) pts += 3;
    if (profile.latitude != null && profile.longitude != null) pts += 4;
    if (profile.farmName) pts += 3;

    factors.push({
      label: 'Farm data quality',
      impact: `+${pts}`,
      maxPoints: 10,
      reason: pts >= 8
        ? 'Farm data is rich — size, location, and name present.'
        : pts >= 4
        ? 'Good farm data. Adding GPS location would improve your score.'
        : 'Limited farm data. Add farm size, name, and GPS location.',
    });

    if (!profile.latitude) {
      nextSteps.push('Add your GPS location for weather-based scoring');
    }

    total += pts;
    if (pts > 0) dataPoints += pts;
  }

  // ── 5. Weather risk adjustment (-10 to 0) ───────────
  {
    const snapshot = profile.weatherSnapshots[0];
    let pts = 0;

    if (!snapshot) {
      factors.push({
        label: 'Weather risk',
        impact: '0',
        maxPoints: 0,
        reason: 'No weather data available. Add GPS coordinates to enable weather scoring.',
      });
    } else {
      const rain = snapshot.rainForecastMm || 0;
      const temp = snapshot.temperatureC || 25;

      if (rain > 30) pts = -10;
      else if (rain > 15) pts = -5;
      else if (rain > 5) pts = -2;

      if (temp > 40) pts = Math.min(pts, -8);
      else if (temp > 35) pts -= 3;

      factors.push({
        label: 'Weather risk',
        impact: pts === 0 ? '0' : `${pts}`,
        maxPoints: 0,
        reason: pts === 0
          ? 'Weather conditions are favorable.'
          : `Weather conditions present risk: ${rain}mm rain forecast, ${temp}°C temperature.`,
      });
      dataPoints++;
    }
    total += pts;
  }

  // ── 6. Stability / consistency (up to 20) ───────────
  {
    let pts = 0;
    const recs = profile.recommendations;

    // Profile age bonus
    const profileAgeDays = (Date.now() - new Date(profile.createdAt)) / (1000 * 60 * 60 * 24);
    if (profileAgeDays > 30) pts += 5;
    else if (profileAgeDays > 7) pts += 2;

    // Consistent activity: at least some completed recs spread over time
    if (recs.length >= 5) {
      const completed = recs.filter(r => r.status === 'completed');
      if (completed.length >= 3) pts += 8;
      else if (completed.length >= 1) pts += 4;
    }

    // Stage progression (not stuck on default)
    if (profile.stage !== 'planting') pts += 4;

    // Notes show engagement
    const withNotes = recs.filter(r => r.farmerNote).length;
    if (withNotes >= 2) pts += 3;
    else if (withNotes >= 1) pts += 1;

    pts = Math.min(20, pts);

    factors.push({
      label: 'Stability & consistency',
      impact: `+${pts}`,
      maxPoints: 20,
      reason: pts >= 15
        ? 'Strong track record — consistent activity and progress.'
        : pts >= 8
        ? 'Growing track record. Continue completing actions regularly.'
        : 'Limited history. Build consistency by staying active over time.',
    });

    if (profile.stage === 'planting') {
      nextSteps.push('Update your farm stage as your crop progresses');
    }

    total += pts;
    if (pts > 0) dataPoints++;
  }

  // ── 7. Market opportunity adjustment (0 to +10) ─────
  {
    let pts = 0;
    // Crops with higher market demand get a small boost
    const highDemand = ['maize', 'rice'];
    if (highDemand.includes(profile.crop)) pts += 4;
    else pts += 2;

    // Harvest stage = closer to revenue
    if (profile.stage === 'harvest') pts += 4;
    else if (profile.stage === 'flowering') pts += 2;

    // Large farms have more opportunity
    if (profile.farmSizeAcres && profile.farmSizeAcres >= 5) pts += 2;

    pts = Math.min(10, pts);

    factors.push({
      label: 'Market opportunity',
      impact: `+${pts}`,
      maxPoints: 10,
      reason: pts >= 7
        ? `Strong market position — ${profile.crop} at ${profile.stage} stage.`
        : `Moderate market positioning. ${profile.crop} has ${highDemand.includes(profile.crop) ? 'strong' : 'steady'} demand.`,
    });

    total += pts;
  }

  // ── Finalize ─────────────────────────────────────────
  const { score, band, readiness } = getBand(total);

  // Confidence based on data completeness
  let confidence = 'low';
  if (dataPoints >= 10) confidence = 'high';
  else if (dataPoints >= 5) confidence = 'medium';

  // Cap next steps at 3
  const finalNextSteps = nextSteps.slice(0, 3);

  // Persist
  const saved = await prisma.farmFinanceScore.create({
    data: {
      farmProfileId,
      score,
      band,
      readiness,
      confidence,
      factors,
      nextSteps: finalNextSteps,
    },
  });

  return {
    id: saved.id,
    score,
    band,
    readiness,
    confidence,
    factors,
    nextSteps: finalNextSteps,
    updatedAt: saved.createdAt.toISOString(),
  };
}

// ─── Get latest score (or compute if none) ─────────────

export async function getFinanceScore(farmProfileId) {
  // Check for existing profile first
  const profileExists = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    select: { id: true },
  });
  if (!profileExists) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }

  const latest = await prisma.farmFinanceScore.findFirst({
    where: { farmProfileId },
    orderBy: { createdAt: 'desc' },
  });

  if (latest) {
    return {
      id: latest.id,
      score: latest.score,
      band: latest.band,
      readiness: latest.readiness,
      confidence: latest.confidence,
      factors: latest.factors,
      nextSteps: latest.nextSteps,
      updatedAt: latest.createdAt.toISOString(),
    };
  }

  // No score yet — compute one
  return computeFinanceScore(farmProfileId);
}

// ─── Finance summary (score + profile snapshot) ────────

export async function getFinanceSummary(farmProfileId) {
  const scoreData = await getFinanceScore(farmProfileId);

  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    select: {
      farmerName: true, farmName: true, crop: true, stage: true,
      farmSizeAcres: true, locationName: true,
    },
  });

  const recStats = await prisma.recommendationRecord.groupBy({
    by: ['status'],
    where: { farmProfileId },
    _count: true,
  });

  return {
    score: scoreData,
    profile: profile || null,
    recommendationStats: Object.fromEntries(
      recStats.map(s => [s.status, s._count])
    ),
  };
}
