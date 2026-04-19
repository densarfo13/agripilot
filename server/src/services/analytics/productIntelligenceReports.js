/**
 * productIntelligenceReports.js — the top-level report builders
 * that tie hesitation, trust breaks, drop-offs, conversions,
 * recommendations, and cohorts into the questions the product
 * team actually asks:
 *
 *   buildOnboardingHealthReport(users)
 *     → Where do users hesitate? Where do they drop? How does
 *       Backyard compare to Farm? How does Detect compare to
 *       Manual?
 *
 *   buildRecommendationHealthReport(users, history)
 *     → Which recs get accepted vs rejected? Which crops are
 *       top performers? Is the rec-to-harvest pipeline alive?
 *
 *   buildTrustHealthReport(users)
 *     → Which trust-break patterns dominate? Which stages lose
 *       trust most often?
 *
 *   buildFullProductReport(users, history)
 *     → One rollup object combining all three, suitable for a
 *       single dashboard endpoint.
 *
 * Every report is a pure function of its inputs. No Prisma calls.
 */

import { aggregateDropOffCounts } from './dropOffDetectionService.js';
import { aggregateHesitationCounts } from './hesitationDetector.js';
import { aggregateTrustBreakCounts, TRUST_BREAK_PATTERNS } from './trustBreakDetector.js';
import { aggregateFlowOutcomes } from './flowOutcomeClassifier.js';
import {
  computeFunnelConversions,
  computeDecisionFunnel,
} from './funnelConversionService.js';
import {
  groupByMode,
  groupByLocationMethod,
  groupByCountry,
} from './cohortGrouper.js';
import {
  getRecommendationAcceptanceRate,
  getCropSwitchRateAfterRecommendation,
} from '../recommendations/recommendationFeedbackService.js';
import {
  rankCountriesByFeedbackHealth,
  summarizeCountryPerformance,
} from '../recommendations/recommendationRankingService.js';

function flattenEvents(users = []) {
  const out = [];
  for (const u of users || []) {
    const events = Array.isArray(u?.events) ? u.events : [];
    for (const e of events) out.push(e);
  }
  return out;
}

function extractUsersForGroup(group) {
  // groupByMode/Country/etc. returns { [key]: { count, users: [{userId, keys}] } }
  // — to compute per-cohort metrics we need the original user
  //   objects keyed by id. Caller provides a lookup to avoid
  //   re-scanning.
  return Object.entries(group || {}).map(([key, val]) => ({
    key,
    count: val.count,
    userIds: (val.users || []).map((u) => u.userId).filter(Boolean),
  }));
}

function usersByIds(users = [], ids = []) {
  const set = new Set(ids);
  return users.filter((u) => set.has(u?.userId));
}

/**
 * buildOnboardingHealthReport — the core question "where are we
 * losing people during onboarding, and why?".
 */
export function buildOnboardingHealthReport(users = []) {
  const safe = Array.isArray(users) ? users : [];
  const funnel    = computeFunnelConversions(safe);
  const dropOffs  = aggregateDropOffCounts(safe);
  const hesitation = aggregateHesitationCounts(safe);
  const trustBreaks = aggregateTrustBreakCounts(safe);
  const flow = aggregateFlowOutcomes(safe);

  // Mode comparison (Backyard vs Farm)
  const modeGroups = groupByMode(safe);
  const modeBreakdown = {};
  for (const g of extractUsersForGroup(modeGroups)) {
    const cohort = usersByIds(safe, g.userIds);
    const subFunnel = computeFunnelConversions(cohort);
    modeBreakdown[g.key] = {
      count: g.count,
      overallConversion: subFunnel.overall.overallConversion,
      biggestDropOff: subFunnel.overall.biggestDropOff,
    };
  }

  // Location method comparison
  const methodGroups = groupByLocationMethod(safe);
  const methodBreakdown = {};
  for (const g of extractUsersForGroup(methodGroups)) {
    const cohort = usersByIds(safe, g.userIds);
    const subFunnel = computeFunnelConversions(cohort);
    methodBreakdown[g.key] = {
      count: g.count,
      overallConversion: subFunnel.overall.overallConversion,
    };
  }

  return {
    generatedAt: Date.now(),
    totalUsers: safe.length,
    funnel: funnel.perStep,
    overallConversion: funnel.overall.overallConversion,
    biggestDropOff: funnel.overall.biggestDropOff,
    dropOffs,
    hesitation,
    flowOutcomes: flow,
    trustBreaks,
    byMode: modeBreakdown,
    byLocationMethod: methodBreakdown,
    insights: buildOnboardingInsights({
      funnel, dropOffs, hesitation, trustBreaks, flow, modeBreakdown, methodBreakdown,
    }),
  };
}

/**
 * buildRecommendationHealthReport — "which recs work, which don't".
 *
 * Takes both the user stream (for real-time acceptance / switch /
 * harvest stats) and the accumulated feedback history (for the
 * long-term bias ranking).
 */
export function buildRecommendationHealthReport(users = [], history = {}) {
  const safe = Array.isArray(users) ? users : [];
  const events = flattenEvents(safe);
  const accRate = getRecommendationAcceptanceRate(events);
  const switchRate = getCropSwitchRateAfterRecommendation(events);
  const decisionFunnel = computeDecisionFunnel(safe);

  const countryHealth = rankCountriesByFeedbackHealth(history);
  const perCountry = {};
  for (const row of countryHealth) {
    perCountry[row.country] = summarizeCountryPerformance(history, row.country);
  }

  return {
    generatedAt: Date.now(),
    acceptance: accRate,
    switch: switchRate,
    decisionFunnel,
    countryHealth,
    perCountry,
    insights: buildRecommendationInsights({ accRate, switchRate, decisionFunnel, countryHealth, perCountry }),
  };
}

/**
 * buildTrustHealthReport — "where does trust break most?".
 */
export function buildTrustHealthReport(users = []) {
  const safe = Array.isArray(users) ? users : [];
  const breaks = aggregateTrustBreakCounts(safe);
  const flow = aggregateFlowOutcomes(safe);

  const patterns = Object.values(TRUST_BREAK_PATTERNS);
  const sortedPatterns = patterns
    .map((p) => ({ pattern: p, count: breaks.byPattern[p] || 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: Date.now(),
    totalUsers: breaks.totalUsers,
    usersWithBreaks: breaks.usersWithBreaks,
    trustBreakRate: breaks.trustBreakRate,
    sortedPatterns,
    flowOutcomes: flow,
    insights: buildTrustInsights({ breaks, sortedPatterns, flow }),
  };
}

export function buildFullProductReport(users = [], history = {}) {
  return {
    generatedAt: Date.now(),
    onboarding: buildOnboardingHealthReport(users),
    recommendation: buildRecommendationHealthReport(users, history),
    trust: buildTrustHealthReport(users),
  };
}

// ─── Insight synthesizers ────────────────────────────────
// Each returns a short array of plain-English strings ready to
// render in a dashboard sidebar.
function buildOnboardingInsights({ funnel, dropOffs, hesitation, trustBreaks, flow, modeBreakdown, methodBreakdown }) {
  const insights = [];
  if (funnel.overall.overallConversion != null) {
    insights.push(`Overall onboarding conversion: ${(funnel.overall.overallConversion * 100).toFixed(1)}%`);
  }
  if (funnel.overall.biggestDropOff) {
    const b = funnel.overall.biggestDropOff;
    insights.push(`Biggest drop-off: "${b.step}" (${b.dropOff} users)`);
  }
  if (hesitation.hesitationRate != null && hesitation.hesitationRate > 0.2) {
    insights.push(`High hesitation: ${(hesitation.hesitationRate * 100).toFixed(1)}% of users hesitated somewhere`);
  }
  if (trustBreaks.trustBreakRate != null && trustBreaks.trustBreakRate > 0.1) {
    insights.push(`Trust breaks affecting ${(trustBreaks.trustBreakRate * 100).toFixed(1)}% of users`);
  }
  const bModes = Object.entries(modeBreakdown || {});
  const modeA = bModes.find(([m]) => m === 'backyard');
  const modeB = bModes.find(([m]) => m === 'farm');
  if (modeA && modeB && modeA[1].overallConversion != null && modeB[1].overallConversion != null) {
    const diff = modeA[1].overallConversion - modeB[1].overallConversion;
    const arrow = diff > 0 ? 'higher' : 'lower';
    insights.push(`Backyard mode converts ${Math.abs(diff * 100).toFixed(1)}% ${arrow} than Farm`);
  }
  const d = methodBreakdown || {};
  if (d.detect?.overallConversion != null && d.manual?.overallConversion != null) {
    const diff = d.detect.overallConversion - d.manual.overallConversion;
    const arrow = diff > 0 ? 'higher' : 'lower';
    insights.push(`Detect converts ${Math.abs(diff * 100).toFixed(1)}% ${arrow} than Manual`);
  }
  const dropReason = Object.entries(dropOffs.byReason || {})
    .filter(([r]) => r && r !== 'no_drop_off_detected')
    .sort((a, b) => b[1] - a[1])[0];
  if (dropReason) {
    insights.push(`Top drop-off reason: ${dropReason[0]} (${dropReason[1]} users)`);
  }
  if (flow.rates?.actionRate != null) {
    insights.push(`Action rate: ${(flow.rates.actionRate * 100).toFixed(1)}%`);
  }
  return insights;
}

function buildRecommendationInsights({ accRate, switchRate, decisionFunnel, countryHealth, perCountry }) {
  const insights = [];
  if (accRate.acceptanceRate != null) {
    insights.push(`Recommendation acceptance rate: ${(accRate.acceptanceRate * 100).toFixed(1)}%`);
  }
  if (switchRate.switchRate != null) {
    insights.push(`Crop-switch rate after selection: ${(switchRate.switchRate * 100).toFixed(1)}%`);
  }
  if (decisionFunnel.rates.viewedToHarvest != null) {
    insights.push(
      `Recommendation → harvest pipeline: ${(decisionFunnel.rates.viewedToHarvest * 100).toFixed(1)}%`,
    );
  }
  const topCountry = countryHealth[0];
  const bottomCountry = countryHealth[countryHealth.length - 1];
  if (topCountry && bottomCountry && topCountry.country !== bottomCountry.country) {
    insights.push(
      `Best-performing country: ${topCountry.country} (avg ${topCountry.averageScore.toFixed(2)})`,
    );
    insights.push(
      `Lowest-performing country: ${bottomCountry.country} (avg ${bottomCountry.averageScore.toFixed(2)})`,
    );
  }
  for (const [country, perf] of Object.entries(perCountry || {})) {
    if (perf.contested && perf.contested.length > 0) {
      insights.push(`[${country}] contested crops: ${perf.contested.join(', ')}`);
    }
  }
  return insights;
}

function buildTrustInsights({ breaks, sortedPatterns, flow }) {
  const insights = [];
  if (breaks.trustBreakRate != null) {
    insights.push(`Trust break rate: ${(breaks.trustBreakRate * 100).toFixed(1)}%`);
  }
  const top = sortedPatterns[0];
  if (top && top.count > 0) {
    insights.push(`Most common trust break: ${top.pattern} (${top.count})`);
  }
  if (flow.byOutcome && flow.byOutcome.confused > 0) {
    insights.push(`Confused sessions: ${flow.byOutcome.confused}`);
  }
  return insights;
}
