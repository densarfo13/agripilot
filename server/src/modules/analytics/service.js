import prisma from '../../config/database.js';

/**
 * Track an analytics event. Fire-and-forget — never fails the caller.
 */
export async function trackEvent(event, userId = null, metadata = null) {
  try {
    await prisma.analyticsEvent.create({
      data: { event, userId, metadata },
    });
  } catch {
    // Silent — analytics should never break product flows
  }
}

/**
 * Get event counts for a time range (admin use).
 */
export async function getEventCounts(since = null) {
  const where = since ? { createdAt: { gte: new Date(since) } } : {};
  const counts = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where,
    _count: true,
    orderBy: { _count: { event: 'desc' } },
  });
  return counts.map(c => ({ event: c.event, count: c._count }));
}

// ─── Voice Analytics Summary ──────────────────────────────────

const VOICE_EVENTS = [
  'VOICE_PROMPT_SHOWN', 'VOICE_PROMPT_PLAYED', 'VOICE_PROMPT_REPLAYED',
  'VOICE_PROMPT_MUTED', 'VOICE_STEP_COMPLETED', 'VOICE_STEP_ABANDONED',
];

/**
 * Get aggregated voice analytics summary.
 * Returns: byEvent, topReplayed, topAbandoned, byLanguage, byScreen.
 */
export async function getVoiceAnalyticsSummary(since = null) {
  const where = {
    event: { in: VOICE_EVENTS },
    ...(since ? { createdAt: { gte: new Date(since) } } : {}),
  };

  // 1. Counts by event type
  const byEventRaw = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where,
    _count: true,
    orderBy: { _count: { event: 'desc' } },
  });
  const byEvent = Object.fromEntries(byEventRaw.map(r => [r.event, r._count]));

  // 2. Get all voice events with metadata for deeper aggregation
  const allVoice = await prisma.analyticsEvent.findMany({
    where,
    select: { event: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000, // cap for performance
  });

  // 3. Aggregate by promptKey (for top replayed / abandoned)
  const promptCounts = {};
  const langCounts = {};
  const screenCounts = {};

  for (const e of allVoice) {
    const meta = e.metadata || {};
    const pk = meta.promptKey || 'unknown';
    const lang = meta.language || 'unknown';
    const screen = meta.screenName || 'unknown';

    // Per prompt
    if (!promptCounts[pk]) promptCounts[pk] = { shown: 0, played: 0, replayed: 0, completed: 0, abandoned: 0 };
    if (e.event === 'VOICE_PROMPT_SHOWN') promptCounts[pk].shown++;
    if (e.event === 'VOICE_PROMPT_PLAYED') promptCounts[pk].played++;
    if (e.event === 'VOICE_PROMPT_REPLAYED') promptCounts[pk].replayed++;
    if (e.event === 'VOICE_STEP_COMPLETED') promptCounts[pk].completed++;
    if (e.event === 'VOICE_STEP_ABANDONED') promptCounts[pk].abandoned++;

    // By language
    langCounts[lang] = (langCounts[lang] || 0) + 1;

    // By screen
    screenCounts[screen] = (screenCounts[screen] || 0) + 1;
  }

  // 4. Top replayed (prompts users struggled with)
  const topReplayed = Object.entries(promptCounts)
    .filter(([, c]) => c.replayed > 0)
    .sort((a, b) => b[1].replayed - a[1].replayed)
    .slice(0, 10)
    .map(([key, c]) => ({ promptKey: key, replayed: c.replayed, played: c.played, shown: c.shown }));

  // 5. Top abandoned (steps where users drop off)
  const topAbandoned = Object.entries(promptCounts)
    .filter(([, c]) => c.abandoned > 0)
    .sort((a, b) => b[1].abandoned - a[1].abandoned)
    .slice(0, 10)
    .map(([key, c]) => ({ promptKey: key, abandoned: c.abandoned, completed: c.completed, shown: c.shown }));

  // 6. Completion rates per screen
  const screenCompletion = {};
  for (const e of allVoice) {
    const screen = e.metadata?.screenName || 'unknown';
    if (!screenCompletion[screen]) screenCompletion[screen] = { completed: 0, abandoned: 0 };
    if (e.event === 'VOICE_STEP_COMPLETED') screenCompletion[screen].completed++;
    if (e.event === 'VOICE_STEP_ABANDONED') screenCompletion[screen].abandoned++;
  }

  return {
    byEvent,
    topReplayed,
    topAbandoned,
    byLanguage: langCounts,
    byScreen: screenCounts,
    screenCompletion,
    totalEvents: allVoice.length,
  };
}
