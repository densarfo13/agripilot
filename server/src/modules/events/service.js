/**
 * events/service.js — persistence + aggregation logic for the
 * soft-launch events / errors / metrics endpoints.
 *
 *   await persistEvents(prisma, rows);
 *   await persistError(prisma, row);
 *   const metrics = await buildMetrics(prisma, { windowDays });
 *
 * Persistence
 *   Both events and errors land in the existing `client_events`
 *   table (Prisma model: ClientEvent). Errors carry
 *   `type='app_error'` and put `{message, stack, surface, …}`
 *   in `payload`. This avoids introducing a parallel table per
 *   the strict no-duplicates rule.
 *
 * Aggregation
 *   `buildMetrics` runs a small set of grouped queries against
 *   the same table. Output shape mirrors the frontend's
 *   `MonitoringDashboardPage.buildSnapshot()` so admins see the
 *   same numbers whether they hit the local dashboard or the
 *   server endpoint.
 *
 * Strict-rule audit
 *   • Pure functions over the prisma client — caller injects
 *     the client so tests can pass a stub.
 *   • Idempotent writes: `clientEvent.upsert` with empty update
 *     on the client-minted id; replays of the same event are
 *     no-ops.
 *   • Never throws on a single bad row — failed writes are
 *     counted into the response so the route can surface drift.
 *   • Reads cap at 5_000 rows per query to keep a runaway
 *     dashboard request bounded.
 */

const READ_CAP = 5000;
const DAY_MS   = 24 * 60 * 60 * 1000;

/**
 * persistEvents(prisma, rows[]) → { accepted, duplicates, rejected }
 *
 * Row shape: see schemas.toClientEventRow output. The row's
 * private `_ip` field is stripped before the DB call (we don't
 * persist raw IPs).
 */
export async function persistEvents(prisma, rows) {
  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { accepted, duplicates, rejected };
  }
  for (const r of rows) {
    if (!r || !r.id || !r.type) { rejected += 1; continue; }
    const data = {
      id:         r.id,
      type:       r.type,
      payload:    r.payload || null,
      createdAt:  r.createdAt || new Date(),
      farmerId:   r.farmerId || null,
      orgId:      r.orgId || null,
      appVersion: r.appVersion || null,
      offline:    !!r.offline,
    };
    try {
      // Upsert with empty update = idempotent insert. A second
      // POST of the same client-minted id is a no-op and counts
      // as a duplicate (both server-side accepted but only the
      // first inserted).
      const result = await prisma.clientEvent.upsert({
        where:  { id: r.id },
        create: data,
        update: {}, // empty update — duplicate POST is a no-op
      });
      // Distinguish first insert (createdAt === receivedAt) from
      // a duplicate (receivedAt earlier than now). Prisma's
      // upsert doesn't tell us which path ran; we approximate by
      // checking whether the row's receivedAt is within the last
      // 5 seconds of the call.
      const wasDuplicate = result.receivedAt
        && (Date.now() - result.receivedAt.getTime()) > 5_000;
      if (wasDuplicate) duplicates += 1; else accepted += 1;
    } catch {
      rejected += 1;
    }
  }
  return { accepted, duplicates, rejected };
}

/**
 * persistError(prisma, row) → { accepted, rejected }
 *
 * Convenience wrapper for the /api/errors endpoint. Coerces the
 * validated error body into a ClientEvent row tagged
 * `type='app_error'` with the error fields nested under
 * `payload`.
 */
export async function persistError(prisma, validated, ctx = {}) {
  const id = ctx.id || (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID()
    : `err-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  let createdAt = null;
  if (typeof validated.timestamp === 'number') {
    createdAt = new Date(validated.timestamp);
  } else if (typeof validated.timestamp === 'string') {
    const d = new Date(validated.timestamp);
    if (Number.isFinite(d.getTime())) createdAt = d;
  }
  if (!createdAt || createdAt.getTime() > Date.now() + 60_000) {
    createdAt = new Date();
  }
  const payload = {
    message:        validated.message,
    stack:          validated.stack || null,
    surface:        validated.surface || null,
    componentStack: validated.componentStack || null,
    route:          validated.route || null,
    userAgent:      validated.userAgent || null,
    context:        validated.context || null,
  };
  try {
    await prisma.clientEvent.upsert({
      where:  { id },
      create: {
        id,
        type:       'app_error',
        payload,
        createdAt,
        farmerId:   ctx.userId || null,
        orgId:      ctx.orgId || null,
        appVersion: ctx.appVersion || null,
        offline:    false,
      },
      update: {},
    });
    return { accepted: 1, rejected: 0, id };
  } catch {
    return { accepted: 0, rejected: 1, id };
  }
}

/**
 * buildMetrics(prisma, { windowDays = 7 }) → metrics shape.
 *
 * Returns the payload `/api/admin/metrics` serves. Mirrors the
 * frontend's `MonitoringDashboardPage.buildSnapshot()` so the
 * admin sees consistent numbers across surfaces.
 */
export async function buildMetrics(prisma, opts = {}) {
  // Use isFinite/clamping rather than `|| 7` so a literal 0 in
  // opts.windowDays clamps to 1 (the documented floor) instead
  // of silently coercing to the default 7.
  const raw = Number(opts.windowDays);
  const windowDays = Number.isFinite(raw) ? Math.max(1, Math.min(30, raw)) : 7;

  // Admin Monitoring Dashboard v1 — optional filter normalisation.
  // 'all' / undefined / empty string all mean "no filter".
  const filterUserType = (opts.userType && opts.userType !== 'all')
    ? String(opts.userType).toLowerCase() : null;
  const filterCountry  = opts.country ? String(opts.country).toUpperCase() : null;
  const filterRegion   = opts.region  ? String(opts.region).toLowerCase() : null;
  const filterLanguage = (opts.language && opts.language !== 'all')
    ? String(opts.language).toLowerCase() : null;
  const sinceMs    = Date.now() - windowDays * DAY_MS;
  const since      = new Date(sinceMs);
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);

  const events = await prisma.clientEvent.findMany({
    where: { createdAt: { gte: since } },
    take:  READ_CAP,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      farmerId: true,
    },
  });

  const usersToday      = new Set();
  const usersYesterday  = new Set();
  const usersWeek       = new Set();

  let taskViewed     = 0;
  let taskCompleted  = 0;
  let taskGenerated  = 0;       // AI Task Engine v1
  let taskFallbackHits = 0;     // generations that hit the fallback rule
  let appErrors      = 0;
  let screenStuck    = 0;
  let buyerInterest  = 0;
  let fundingViewed  = 0;
  let photoUploaded  = 0;
  let locationDenied = 0;
  let uploadFailed   = 0;       // Admin Monitoring v1
  let rateLimitHits  = 0;       // Admin Monitoring v1

  const errorRoutes  = Object.create(null);
  const stuckRoutes  = Object.create(null);
  const langCounts   = Object.create(null);
  const userTypes    = { farmer: 0, backyard: 0, ngo: 0, buyer: 0, other: 0 };
  const farmsCreated = { total: 0, today: 0 };
  const growsCreated = { total: 0, today: 0 };

  for (const ev of events) {
    const ts  = ev.createdAt instanceof Date ? ev.createdAt.getTime() : Date.parse(ev.createdAt);
    const uid = ev.farmerId || (ev.payload && ev.payload.userId) || null;
    const p = ev.payload || {};

    // Filter pass — drop events that don't match the supplied
    // userType / country / region / language. Filters compare
    // against payload fields that the frontend stamps onto the
    // event when known. An event missing the field is INCLUDED
    // by default so we don't silently zero a metric just because
    // older clients didn't ship the new tag.
    if (filterUserType) {
      const evUt = (p.userType || '').toLowerCase();
      if (evUt && evUt !== filterUserType) continue;
    }
    if (filterCountry) {
      const evCountry = (p.country || '').toUpperCase();
      if (evCountry && evCountry !== filterCountry) continue;
    }
    if (filterRegion) {
      const evRegion = (p.region || '').toLowerCase();
      if (evRegion && evRegion !== filterRegion && !evRegion.includes(filterRegion)) continue;
    }
    if (filterLanguage) {
      const evLang = (p.language || p.code || p.to || '').toLowerCase();
      if (evLang && evLang !== filterLanguage) continue;
    }

    if (uid) {
      usersWeek.add(uid);
      if (ts >= todayStart.getTime()) usersToday.add(uid);
      else if (ts >= yesterdayStart.getTime() && ts < todayStart.getTime()) usersYesterday.add(uid);
    }
    switch (ev.type) {
      case 'task_viewed':    taskViewed += 1; break;
      case 'task_completed': taskCompleted += 1; break;
      case 'task_generated': {
        taskGenerated += 1;
        if (p.fallback === true) taskFallbackHits += 1;
        break;
      }
      case 'app_error': {
        appErrors += 1;
        const r = (p.route || p.surface || 'unknown');
        errorRoutes[r] = (errorRoutes[r] || 0) + 1;
        break;
      }
      case 'screen_stuck': {
        screenStuck += 1;
        const r = p.route || 'unknown';
        stuckRoutes[r] = (stuckRoutes[r] || 0) + 1;
        break;
      }
      case 'buyer_interest':              buyerInterest += 1; break;
      case 'funding_viewed':              fundingViewed += 1; break;
      case 'photo_uploaded':              photoUploaded += 1; break;
      case 'location_permission_denied':  locationDenied += 1; break;
      case 'upload_failed':               uploadFailed  += 1; break;
      case 'rate_limit_hit':              rateLimitHits += 1; break;
      case 'language_changed': {
        const code = p.to || p.code || 'unknown';
        langCounts[code] = (langCounts[code] || 0) + 1;
        break;
      }
      case 'user_type_selected': {
        const t = p.userType || 'other';
        if (t === 'farmer' || t === 'backyard' || t === 'ngo' || t === 'buyer') {
          userTypes[t] += 1;
        } else {
          userTypes.other += 1;
        }
        break;
      }
      case 'farm_created': {
        farmsCreated.total += 1;
        if (ts >= todayStart.getTime()) farmsCreated.today += 1;
        break;
      }
      case 'grow_created':
      case 'garden_created': {
        growsCreated.total += 1;
        if (ts >= todayStart.getTime()) growsCreated.today += 1;
        break;
      }
      default: break;
    }
  }

  function topN(map, n) {
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }

  // Day-over-day retention: users seen yesterday AND today.
  let retained = 0;
  for (const u of usersToday) {
    if (usersYesterday.has(u)) retained += 1;
  }
  const retentionRate = usersYesterday.size > 0
    ? retained / usersYesterday.size
    : null;
  const completionRate = taskViewed > 0
    ? taskCompleted / taskViewed
    : null;

  return {
    windowDays,
    sampleSize:     events.length,
    builtAt:        new Date().toISOString(),
    dau:            usersToday.size,
    wau:            usersWeek.size,
    yesterdayUsers: usersYesterday.size,
    retainedUsers:  retained,
    retentionRate,
    taskViewed,
    taskCompleted,
    taskGenerated,
    taskFallbackHits,
    // AI Task Engine v1 — fraction of generations that hit the
    // profile_missing / fallback_check rule. A high number means
    // many users still need to complete onboarding.
    taskFallbackRate: taskGenerated > 0
      ? taskFallbackHits / taskGenerated
      : null,
    completionRate,
    appErrors,
    screenStuck,
    buyerInterest,
    fundingViewed,
    photoUploaded,
    locationDenied,
    uploadFailed,
    rateLimitHits,
    farmsCreated,
    growsCreated,
    userTypeSplit:  userTypes,
    languageUsage:  langCounts,
    topErrors:      topN(errorRoutes, 5),
    topStuckRoutes: topN(stuckRoutes, 5),
    // Admin Monitoring v1 — red-flag evaluator. Frontend uses
    // these booleans to colour-code KPI cards; the same numbers
    // are available raw for callers that want their own
    // threshold logic. Spec rule §"Red flags for":
    //   • crash count > 0
    //   • stuck screens > 0
    //   • task completion below 40%
    //   • rate-limit hits spike
    //   • upload failures spike
    // Spike heuristic: >= 5 in the window OR > 1% of any
    // event-volume comparator (whichever is lower) — keeps the
    // signal sensible at both small soak-test traffic and full
    // production volume.
    flags: {
      crashes:        appErrors > 0,
      stuck:          screenStuck > 0,
      lowCompletion:  completionRate != null && completionRate < 0.40,
      rateLimitSpike: rateLimitHits >= 5
                       || (events.length > 0 && rateLimitHits / events.length > 0.01),
      uploadFailures: uploadFailed >= 5
                       || (photoUploaded > 0 && uploadFailed / Math.max(1, photoUploaded + uploadFailed) > 0.10),
    },
    // Echo back the resolved filter context so the dashboard
    // can render "Showing: today · farmers · GH · en" without
    // inferring its own state.
    filters: {
      windowDays,
      userType: filterUserType || 'all',
      country:  filterCountry || null,
      region:   filterRegion || null,
      language: filterLanguage || 'all',
    },
  };
}

export const _internal = Object.freeze({
  READ_CAP,
  DAY_MS,
});
