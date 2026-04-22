/**
 * progressScoreEngine.js — blends completion rate, recent activity,
 * issue load and current streak into one 0–100 "how's the farm
 * holding up" score.
 *
 *   getProgressScore({ tasks, completions, issues, streak, risk,
 *                      farmType }) → {
 *     score:        0..100,
 *     label:        'low' | 'fair' | 'good' | 'strong',
 *     labelKey,     labelFallback,
 *     explanation,  explanationKey,
 *     reasons: Array<{ tag, detail, delta, tone }>,
 *   }
 *
 * Principles (spec §3):
 *   • never punitive — the baseline is 40, so a brand-new farmer
 *     lands at "fair" not "low"
 *   • encouraging wording at every band
 *   • reasons[] explain every adjustment so the UI can render "why"
 *   • farmType shifts the target so backyard farmers aren't judged
 *     against commercial standards
 *
 * Score components (all clamped):
 *   +20 for completing ≥1 task today            (today_action)
 *   +10 extra when ALL of today's tasks done    (today_complete)
 *   +15 streak bonus — scaled to 7 days         (streak)
 *   +10 recent completion-rate bonus            (recent_completion)
 *   -15 elevated risk (medium/high)              (risk)
 *   -10 for each 2 unresolved open issues (cap -20)  (issues)
 *   -10 for ≥3 missed tasks in last 3 days      (missed)
 *
 * Clamped to [0, 100] then labelled:
 *   ≥ 80 → strong        (✨ encouraging)
 *   ≥ 60 → good
 *   ≥ 40 → fair
 *   else → low           (still framed as "get started", not "bad")
 */

function ymd(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = date instanceof Date ? date : new Date(date || Date.now());
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

function labelFor(score) {
  if (score >= 80) return { key: 'progress.label.strong', fallback: 'Strong' };
  if (score >= 60) return { key: 'progress.label.good',   fallback: 'Good' };
  if (score >= 40) return { key: 'progress.label.fair',   fallback: 'Fair' };
  return           { key: 'progress.label.low',           fallback: 'Getting started' };
}

function explanationFor(score, farmType) {
  const simple = farmType === 'backyard';
  if (score >= 80) {
    return { key: 'progress.explain.strong',
             fallback: simple
               ? 'Everything looks great. Keep it up!'
               : 'Your farm is on track. Keep the daily actions going.' };
  }
  if (score >= 60) {
    return { key: 'progress.explain.good',
             fallback: 'Solid progress — a couple of small actions will strengthen it.' };
  }
  if (score >= 40) {
    return { key: 'progress.explain.fair',
             fallback: 'A few quick wins today will lift your farm status.' };
  }
  return { key: 'progress.explain.low',
           fallback: simple
             ? 'No problem — complete one task today and we\u2019ll build from there.'
             : 'Let\u2019s pick one task to start. Every action moves the needle.' };
}

export function getProgressScore({
  tasks        = [],
  completions  = [],
  issues       = [],
  streak       = null,
  risk         = null,     // { level: 'low' | 'medium' | 'high' } | null
  farmType     = 'small_farm',
  now          = null,
} = {}) {
  const today = ymd(now || Date.now()) || ymd(new Date());
  const tier  = canonicalFarmType(farmType);
  const reasons = [];
  let score = 40;  // neutral baseline — never starts at zero

  // ── Today action ───────────────────────────────────────────────
  const todaysTasks = tasks.filter((t) => t && t.date === today);
  const todaysDone  = todaysTasks.filter((t) => t.status === 'complete');
  const anyDoneToday =
      todaysDone.length > 0
   || completions.some((c) => c && (c.completed || c.status === 'complete')
        && ymd(c.timestamp || c.completedAt) === today);

  if (anyDoneToday) {
    score += 20;
    reasons.push({ tag: 'today_action', delta: +20, tone: 'positive',
      detail: 'You\u2019ve completed at least one task today.' });
  } else if (todaysTasks.length > 0) {
    reasons.push({ tag: 'today_pending', delta: 0, tone: 'neutral',
      detail: 'You still have today\u2019s tasks to finish.' });
  }

  if (todaysTasks.length > 0 && todaysDone.length === todaysTasks.length) {
    score += 10;
    reasons.push({ tag: 'today_complete', delta: +10, tone: 'positive',
      detail: 'All of today\u2019s tasks are done — excellent.' });
  }

  // ── Streak bonus ───────────────────────────────────────────────
  const currentStreak = streak && streak.currentStreak ? streak.currentStreak : 0;
  if (currentStreak > 0) {
    const bonus = Math.round(clamp(currentStreak, 0, 7) * (15 / 7));
    score += bonus;
    reasons.push({ tag: 'streak', delta: +bonus, tone: 'positive',
      detail: `Your ${currentStreak}-day streak is keeping the farm healthy.` });
  }

  // ── Recent completion rate (last ~7 days) ──────────────────────
  if (Array.isArray(tasks) && tasks.length > 0) {
    const recent = tasks.slice(-30);  // cheap window bound
    const done = recent.filter((t) => t && t.status === 'complete').length;
    const rate = recent.length ? done / recent.length : 0;
    if (rate >= 0.75) {
      score += 10;
      reasons.push({ tag: 'recent_completion', delta: +10, tone: 'positive',
        detail: 'Strong recent completion rate — keep it up.' });
    } else if (rate >= 0.5) {
      score += 5;
      reasons.push({ tag: 'recent_completion', delta: +5, tone: 'positive',
        detail: 'Solid recent completion rate.' });
    }
  }

  // ── Risk (from riskInsightEngine if the caller passes it) ──────
  if (risk && (risk.level === 'medium' || risk.level === 'high')) {
    const delta = risk.level === 'high' ? -15 : -8;
    score += delta;
    reasons.push({ tag: 'risk', delta, tone: 'caution',
      detail: risk.level === 'high'
        ? 'High-risk signal — a quick inspection will help.'
        : 'Some risk detected — worth a check this week.' });
  }

  // ── Unresolved issues ──────────────────────────────────────────
  const openIssues = Array.isArray(issues)
    ? issues.filter((i) => i && i.status !== 'resolved').length : 0;
  if (openIssues >= 2) {
    const delta = -clamp(Math.floor(openIssues / 2) * 10, 10, 20);
    score += delta;
    reasons.push({ tag: 'issues', delta, tone: 'caution',
      detail: `${openIssues} open issue${openIssues > 1 ? 's' : ''} — resolve one to lift your status.` });
  }

  // ── Missed tasks in last 3 days ────────────────────────────────
  const threeDaysAgo = ymd(new Date(Date.now() - 3 * 86400000));
  const missed = tasks.filter((t) =>
    t && t.date >= threeDaysAgo && t.date < today && t.status === 'pending').length;
  if (missed >= 3) {
    score -= 10;
    reasons.push({ tag: 'missed', delta: -10, tone: 'caution',
      detail: 'A few tasks slipped by — today\u2019s action puts it right.' });
  }

  // Backyard: nudge the score up slightly so the label matches the
  // simpler expectations of a home plot.
  if (tier === 'backyard' && score > 0) {
    score += 5;
    reasons.push({ tag: 'backyard_baseline', delta: +5, tone: 'neutral',
      detail: 'Backyard baseline applied — small actions matter.' });
  }

  score = clamp(Math.round(score), 0, 100);
  const { key: labelKey, fallback: labelFallback } = labelFor(score);
  const { key: explanationKey, fallback: explanationFallback } = explanationFor(score, tier);

  return Object.freeze({
    score,
    label: labelFallback.toLowerCase().split(' ')[0],   // 'strong' | 'good' | 'fair' | 'getting'
    labelKey, labelFallback,
    explanation: explanationFallback,
    explanationKey,
    reasons: Object.freeze(reasons),
    farmType: tier,
  });
}

export const _internal = Object.freeze({
  ymd, clamp, labelFor, explanationFor, canonicalFarmType,
});
