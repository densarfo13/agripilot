/**
 * issueStore.js — local-first issue management for the farmer →
 * admin → field officer workflow.
 *
 * Storage key:   farroway.issues       — array of Issue objects
 * Legacy key:    farroway.lastSeenIssueUpdates — per-issue epoch ms
 *                so "Status changed since last visit" can light up.
 *
 * Every write is synchronous; every read is SSR-safe (returns [] /
 * null when localStorage is unavailable). Outputs are frozen so
 * consumers can't mutate the shared list.
 *
 * Status transitions (spec §2 + §6):
 *   open        → assigned          (admin assigns)
 *   assigned    → in_progress       (officer starts)
 *               → resolved          (officer closes immediately)
 *               → escalated         (officer bounces back to admin)
 *   in_progress → resolved | escalated
 *   escalated   → assigned | resolved (admin re-assigns or closes)
 *
 * Role contract (spec §1):
 *   farmer        — createIssue, getIssuesForRole('farmer', {farmerId})
 *   admin         — getIssuesForRole('admin'), assignIssue, updateIssueStatus
 *   field_officer — getIssuesForRole('field_officer', {officerId}),
 *                   addIssueNote, updateIssueStatus
 *
 * Notifications (spec §8): `getUnseenStatusChanges(lastSeenMap)`
 * tells the caller which issues changed since the last visit so the
 * UI can show "Status changed since last visit" without any push.
 */

import { planAutomation } from './automationRules.js';
import { getRegionProfile } from '../location/regionProfile.js';
import { getRisk }          from '../risk/riskEngine.js';

// Backward-compat bridge kept for the legacy autoTriage.js caller —
// it still self-wires, but we no longer depend on it; the direct
// import above is the source of truth.
let _autoTriageRef = null;
export function __wireAutoTriage(fn) { _autoTriageRef = fn || null; }

const STORAGE_KEY        = 'farroway.issues';
const LAST_SEEN_KEY      = 'farroway.lastSeenIssueUpdates';
const OFFICER_REG_KEY    = 'farroway.officerRegistry';
const AUDIT_KEY          = 'farroway.issueAutomationAudit';
const CLUSTERS_KEY       = 'farroway.issueClusters';

export const ISSUE_STATUS = Object.freeze({
  OPEN:        'open',
  ASSIGNED:    'assigned',
  IN_PROGRESS: 'in_progress',
  RESOLVED:    'resolved',
  ESCALATED:   'escalated',
});

export const ISSUE_SEVERITY = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
});

export const ISSUE_TYPES = Object.freeze([
  'pest',            // pest infestation
  'disease',         // plant disease
  'weather_damage',  // rain, wind, drought
  'soil',            // erosion, poor fertility
  'irrigation',      // water issues
  'input_shortage',  // seeds / fertilizer / tools
  'access',          // can't reach market / officer
  'other',
]);

const VALID_STATUSES = new Set(Object.values(ISSUE_STATUS));
const VALID_SEVERITIES = new Set(Object.values(ISSUE_SEVERITY));
const VALID_TYPES = new Set(ISSUE_TYPES);

// ─── Low-level storage access ────────────────────────────────────
function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readList() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeList(list) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function genId(prefix = 'iss') {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch { /* ignore */ }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function freezeIssue(issue) {
  if (!issue) return issue;
  const notes = Array.isArray(issue.notes)
    ? issue.notes.map((n) => Object.freeze({ ...n }))
    : [];
  return Object.freeze({ ...issue, notes: Object.freeze(notes) });
}

// ─── Listeners (spec §8 — simple in-process notification hook) ───
// Any subscriber (admin inbox, officer view, farmer status page) can
// register a callback and get re-rendered whenever an issue changes.
// Cross-tab updates fire via the `storage` event below.
const listeners = new Set();

function notify() {
  for (const cb of listeners) {
    try { cb(); } catch { /* ignore subscriber errors */ }
  }
}

export function subscribeIssues(callback) {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  // Cross-tab: fire when another tab writes to the store.
  const onStorage = (e) => {
    if (e && e.key === STORAGE_KEY) callback();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

// ─── Public reads ────────────────────────────────────────────────
export function getAllIssues() {
  return readList().map(freezeIssue);
}

export function getIssueById(id) {
  if (!id) return null;
  const list = readList();
  const found = list.find((i) => i && i.id === String(id));
  return found ? freezeIssue(found) : null;
}

/**
 * getIssuesForRole — scoped list for the requesting role.
 *
 *   role = 'farmer'        → only own issues (farmerId must match)
 *   role = 'admin'         → all issues
 *   role = 'field_officer' → issues assigned to the officer
 *
 * Results are sorted newest-first by `updatedAt` so the UI doesn't
 * have to re-sort. Filters are applied AFTER the role gate so an
 * admin can filter by `{ status: 'open' }`, etc.
 */
export function getIssuesForRole(role, {
  farmerId = null,
  officerId = null,
  status = null,
  crop = null,
  severity = null,
  location = null,
  program = null,
  issueType = null,       // filter by issueType (spec §1 "type" filter)
  farmerSearch = null,    // substring match on farmerName / farmerId (spec §1 "farmer" filter)
} = {}) {
  const list = readList();
  let out;
  if (role === 'farmer') {
    const id = farmerId ? String(farmerId) : null;
    out = list.filter((i) => i && id && String(i.farmerId || '') === id);
  } else if (role === 'field_officer') {
    const oid = officerId ? String(officerId) : null;
    out = list.filter((i) => i && oid && String(i.assignedTo || '') === oid);
  } else {
    // admin (or anything else with catch-all access)
    out = list.slice();
  }

  if (status)    out = out.filter((i) => i.status === status);
  if (crop)      out = out.filter((i) => i.crop === crop);
  if (severity)  out = out.filter((i) => i.severity === severity);
  if (location)  out = out.filter((i) => String(i.location || '').toLowerCase().includes(String(location).toLowerCase()));
  if (program)   out = out.filter((i) => i.program === program);
  if (issueType) out = out.filter((i) => i.issueType === issueType);
  if (farmerSearch) {
    const q = String(farmerSearch).toLowerCase().trim();
    if (q) {
      out = out.filter((i) => {
        const name = String(i.farmerName || '').toLowerCase();
        const fid  = String(i.farmerId   || '').toLowerCase();
        return name.includes(q) || fid.includes(q);
      });
    }
  }

  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out.map(freezeIssue);
}

// ─── Writes ──────────────────────────────────────────────────────
/**
 * createIssue — farmer-facing "Report Issue" submit.
 *
 * Required:   issueType + description
 * Optional:   severity (default 'medium'), imageUrl, farm context
 *
 * Returns the created Issue (frozen) or null on invalid input.
 */
export function createIssue({
  farmerId     = null,
  farmId       = null,
  farmerName   = null,
  program      = null,
  location     = null,
  crop         = null,
  issueType,
  severity     = null,        // null means "let triage decide"
  description,
  imageUrl     = null,
  // Opt-in automation. Existing callers (tests + legacy code) keep
  // the v1 shape (open, no notes). ReportIssuePage passes true so
  // the real farmer flow gets triage + suggested response + routing.
  autoTriage   = false,
  registry     = null,        // optional override; defaults to stored registry
  now          = null,
} = {}) {
  if (!issueType || !VALID_TYPES.has(String(issueType))) return null;
  const desc = typeof description === 'string' ? description.trim() : '';
  if (!desc) return null;
  const callerSeverity = severity && VALID_SEVERITIES.has(String(severity))
    ? String(severity)
    : null;
  const stamp = Number.isFinite(now) ? now : Date.now();

  // Derive region + riskLevel at creation time (spec §5) so they
  // travel with the issue object, can feed officer routing, and
  // don't depend on the UI having computed them beforehand. Both
  // are best-effort — missing inputs fall through to safe defaults.
  const countryForProfile = location && /^[A-Z]{2}$/.test(String(location).toUpperCase())
    ? String(location).toUpperCase()
    : null;
  const regionProfile = countryForProfile
    ? getRegionProfile({ countryCode: countryForProfile })
    : null;
  const region = regionProfile ? regionProfile.region : (location ? String(location).trim() : null);
  const risk   = regionProfile
    ? getRisk({ crop, regionProfile })
    : null;
  const riskLevel = risk ? risk.level : null;

  const baseIssue = {
    id:          genId(),
    farmerId:    farmerId ? String(farmerId) : null,
    farmId:      farmId   ? String(farmId)   : null,
    farmerName:  farmerName ? String(farmerName).trim() : null,
    program:     program ? String(program).trim() : null,
    location:    location ? String(location).trim() : null,
    crop:        crop ? String(crop).trim().toLowerCase() : null,
    issueType:   String(issueType),
    severity:    callerSeverity || ISSUE_SEVERITY.MEDIUM,
    description: desc,
    imageUrl:    imageUrl ? String(imageUrl) : null,
    status:      ISSUE_STATUS.OPEN,
    assignedTo:  null,
    notes:       [],
    // Location Intelligence Engine inputs — used by routing + risk
    // surfaces (admin + officer views read these straight off).
    region,
    riskLevel,
    createdAt:   stamp,
    updatedAt:   stamp,
  };

  let issue = baseIssue;

  if (autoTriage) {
    // Full automation plan from src/lib/issues/automationRules.js.
    // The planner is pure — it tallies classification, severity,
    // assignment, cluster, and escalation. This function just
    // applies the decisions.
    //
    // Pass the CALLER'S explicit severity separately so the planner
    // can still infer when the caller didn't set one; we reconcile
    // below (explicit caller severity always wins the stored value
    // but the scored plan is kept in the audit).
    const triageInput = { ...baseIssue, severity: callerSeverity };
    const plan = planAutomationSync(triageInput, { registry });

    const triageNotes = [];
    // Farmer-visible suggestion — gated by planAutomation's safety
    // rules. `suggested: true` so the farmer view hides it until an
    // officer explicitly re-sends, and the officer view labels it.
    if (plan.suggestion && plan.suggestion.text) {
      triageNotes.push({
        id:         genId('note'),
        authorRole: 'system',
        authorId:   null,
        text:       plan.suggestion.text,
        system:     true,
        suggested:  true,
        kind:       plan.suggestion.kind,
        createdAt:  stamp,
      });
    }
    // Assignment / admin-queue system note — gives context in both
    // the farmer timeline (hidden because system:true) and admin view.
    const assignText = plan.assignment && plan.assignment.officerId
      ? `Auto-assigned to ${plan.assignment.officerId} (${plan.assignment.reasonTier})`
      : `Routed to admin queue (${plan.assignment ? plan.assignment.reasonTier : 'no_registry'})`;
    triageNotes.push({
      id:         genId('note'),
      authorRole: 'system',
      authorId:   null,
      text:       assignText,
      system:     true,
      createdAt:  stamp,
    });
    // Escalation system note (spec §9)
    if (plan.escalate) {
      triageNotes.push({
        id:         genId('note'),
        authorRole: 'system',
        authorId:   null,
        text:       `Escalated: ${plan.escalateReasons.map((r) => r.rule).join(', ')}`,
        system:     true,
        createdAt:  stamp,
      });
    }

    const picked = plan.assignment && plan.assignment.officerId;
    issue = {
      ...baseIssue,
      // Explicit caller severity always wins the stored value;
      // otherwise the planner's scored severity applies.
      severity:   callerSeverity || (plan.severityPlan && plan.severityPlan.severity) || baseIssue.severity,
      // Expose the plan's classification + assignment reasoning so
      // admin / officer views can surface "why" alongside "what".
      autoTriage: {
        classifiedAs: plan.classification && plan.classification.issueType,
        confidence:   plan.classification && plan.classification.confidence,
        matchedRules: plan.classification && plan.classification.matchedRules,
      },
      autoSeverity: {
        severity: plan.severityPlan && plan.severityPlan.severity,
        reasons:  plan.severityPlan && plan.severityPlan.reasons,
      },
      assignment: {
        officerId:  plan.assignment && plan.assignment.officerId,
        reasonTier: plan.assignment && plan.assignment.reasonTier,
        reasons:    plan.assignment && plan.assignment.reasons,
      },
      notes:      triageNotes,
      assignedTo: picked || null,
      // Escalation overrides the normal assigned/open choice — the
      // admin queue always sees the escalated flag.
      status:     plan.escalate
        ? ISSUE_STATUS.ESCALATED
        : (picked ? ISSUE_STATUS.ASSIGNED : ISSUE_STATUS.OPEN),
      firstAssignedAt: picked ? stamp : null,
      escalatedAt:     plan.escalate ? stamp : null,
      escalatedAuto:   !!plan.escalate,
      escalateReasons: plan.escalateReasons || [],
      clusterId:       plan.cluster ? plan.cluster.clusterId : null,
      farmerAck:       plan.farmerAck,
    };

    // Persist the per-issue audit trail + any cluster record so
    // admin dashboards can correlate across refreshes.
    if (plan.audit && plan.audit.length > 0) appendAudit(baseIssue.id, plan.audit);
    if (plan.cluster) upsertCluster(plan.cluster);
  }

  const list = readList();
  list.push(issue);
  writeList(list);
  notify();
  return freezeIssue(issue);
}

// Direct planAutomation call — pure, imported at top. No circular
// dep (the rule modules don't import back into the store).
function planAutomationSync(baseIssue, { registry = null } = {}) {
  return planAutomation(baseIssue, {
    registry:  registry || getOfficerRegistry(),
    allIssues: readList(),
    now:       baseIssue.createdAt,
  });
}

/**
 * assignIssue — admin assigns a field officer. Moves the issue
 * out of `open` (or back out of `escalated`) into `assigned`. A
 * no-op with a null return if the issue or officer id is missing.
 */
export function assignIssue(issueId, officerId, { adminId = null } = {}) {
  if (!issueId || !officerId) return null;
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === String(issueId));
  if (idx < 0) return null;
  const now = Date.now();
  const before = list[idx];
  const next = {
    ...before,
    status: ISSUE_STATUS.ASSIGNED,
    assignedTo: String(officerId),
    updatedAt: now,
    firstAssignedAt: before.firstAssignedAt || now,
    notes: Array.isArray(before.notes) ? before.notes.slice() : [],
  };
  // System note so the timeline captures the assignment (spec §8).
  next.notes.push({
    id:         genId('note'),
    authorRole: 'admin',
    authorId:   adminId ? String(adminId) : null,
    text:       `Assigned to officer ${officerId}`,
    system:     true,
    createdAt:  now,
  });
  list[idx] = next;
  writeList(list);
  notify();
  return freezeIssue(next);
}

/**
 * updateIssueStatus — officer or admin updates the status. Only
 * valid transitions are accepted; anything else is a no-op.
 */
const VALID_TRANSITIONS = Object.freeze({
  open:        new Set(['assigned', 'resolved']),                // admin close allowed
  assigned:    new Set(['in_progress', 'resolved', 'escalated']),
  in_progress: new Set(['resolved', 'escalated']),
  escalated:   new Set(['assigned', 'resolved']),
  resolved:    new Set(), // terminal; re-report creates a new issue
});

export function updateIssueStatus(issueId, nextStatus, {
  authorRole = null, authorId = null,
} = {}) {
  if (!issueId) return null;
  if (!VALID_STATUSES.has(String(nextStatus))) return null;
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === String(issueId));
  if (idx < 0) return null;
  const before = list[idx];
  const allowed = VALID_TRANSITIONS[before.status] || new Set();
  if (!allowed.has(nextStatus)) return null; // invalid transition → no-op

  const now = Date.now();
  const next = {
    ...before,
    status: nextStatus,
    updatedAt: now,
    notes: Array.isArray(before.notes) ? before.notes.slice() : [],
  };
  if (nextStatus === ISSUE_STATUS.RESOLVED)  next.resolvedAt  = now;
  if (nextStatus === ISSUE_STATUS.ESCALATED) next.escalatedAt = now;

  // System note so the farmer timeline + officer notes stay coherent.
  next.notes.push({
    id:         genId('note'),
    authorRole: authorRole || null,
    authorId:   authorId ? String(authorId) : null,
    text:       `Status \u2192 ${nextStatus}`,
    system:     true,
    createdAt:  now,
  });

  list[idx] = next;
  writeList(list);
  notify();
  return freezeIssue(next);
}

/**
 * addIssueNote — free-text note from admin or field officer. Does
 * not change status; just appends to the notes timeline.
 */
export function addIssueNote(issueId, {
  authorRole = null, authorId = null, text = '',
} = {}) {
  if (!issueId) return null;
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) return null;
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === String(issueId));
  if (idx < 0) return null;
  const before = list[idx];
  const now = Date.now();
  const note = {
    id:         genId('note'),
    authorRole: authorRole || null,
    authorId:   authorId ? String(authorId) : null,
    text:       body,
    system:     false,
    createdAt:  now,
  };
  const next = {
    ...before,
    notes: (Array.isArray(before.notes) ? before.notes.slice() : []).concat([note]),
    updatedAt: now,
  };
  list[idx] = next;
  writeList(list);
  notify();
  return freezeIssue(next);
}

// ─── Metrics (spec §9) ────────────────────────────────────────────
/**
 * getIssueMetrics — counts + optional average response time.
 *   avgResponseMs — mean of (firstAssignedAt - createdAt) across
 *   issues that have ever been assigned. null when no samples.
 */
export function getIssueMetrics({ issues = null } = {}) {
  const list = issues ? issues : readList();
  let open = 0, assigned = 0, inProgress = 0, resolved = 0, escalated = 0, high = 0;
  let responseSum = 0, responseCount = 0;
  for (const i of list) {
    if (!i) continue;
    if (i.status === ISSUE_STATUS.OPEN)        open += 1;
    if (i.status === ISSUE_STATUS.ASSIGNED)    assigned += 1;
    if (i.status === ISSUE_STATUS.IN_PROGRESS) inProgress += 1;
    if (i.status === ISSUE_STATUS.RESOLVED)    resolved += 1;
    if (i.status === ISSUE_STATUS.ESCALATED)   escalated += 1;
    if (i.severity === ISSUE_SEVERITY.HIGH)    high += 1;
    if (Number.isFinite(i.firstAssignedAt) && Number.isFinite(i.createdAt)) {
      responseSum += (i.firstAssignedAt - i.createdAt);
      responseCount += 1;
    }
  }
  return Object.freeze({
    total:      list.length,
    open,
    assigned,
    inProgress,
    resolved,
    escalated,
    highSeverity: high,
    avgResponseMs: responseCount > 0 ? Math.round(responseSum / responseCount) : null,
  });
}

// ─── Farmer-facing status messages (spec §7) ─────────────────────
// ─── Health triage wrappers (spec §§ 5-11) ───────────────────────
/**
 * createHealthReport — the structured symptom-capture path. Runs the
 * pure `triageFarmHealthIssue` then persists via `createIssue` with
 * the triage output stamped on the issue. Callers can pass
 * `autoTriage: false` to skip the planner's own classification —
 * the health triage result is authoritative for these reports.
 *
 *   createHealthReport({
 *     farmerId, farmId, crop, region, symptoms, affectedPart,
 *     extent, duration, description, imageUrl, weather,
 *     recentFarmReports, now,
 *   }) → Issue | null
 */
export async function createHealthReport(input = {}) {
  const {
    farmerId = null, farmId = null, farmerName = null,
    program = null, location = null, crop = null,
    symptoms = [], affectedPart = null, extent = null, duration = null,
    description = '', imageUrl = null, weather = null,
    recentFarmReports = 0, region = null, now = null,
  } = input;

  // Lazy import avoids a top-level cycle (triage → types import).
  const { triageFarmHealthIssue } = await import('./healthTriageEngine.js');
  const triage = triageFarmHealthIssue({
    crop, region, symptoms, affectedPart, extent, duration,
    weather, description, recentFarmReports,
  });

  // Persist via the existing createIssue so every downstream reader
  // (admin inbox, officer view, NGO insights, impact reports) picks
  // up the row automatically. The triage output lands in metadata
  // fields we stamp via setIssueOverride right after creation.
  const issue = createIssue({
    farmerId, farmId, farmerName, program, location, crop,
    // Map structured categories to the store's existing issueType
    // set so filters + clustering keep working. Unknown falls
    // through to 'other'.
    issueType: mapCategoryToType(triage.predictedCategory),
    severity:  triage.severity,
    description: buildStructuredDescription({
      symptoms, affectedPart, extent, duration, description,
    }),
    imageUrl,
    // We deliberately DON'T run the automation planner here —
    // health triage IS our classifier.
    autoTriage: false,
    now,
  });
  if (!issue) return null;

  // Stamp the triage output on the stored issue via a direct
  // metadata update + a system note. Reuses the override writer so
  // the admin audit log captures the triage run.
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === issue.id);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      triage: {
        predictedCategory:       triage.predictedCategory,
        predictedCategoryKey:    triage.predictedCategoryKey,
        confidenceLevel:         triage.confidenceLevel,
        severity:                triage.severity,
        requiresOfficerReview:   triage.requiresOfficerReview,
        escalationFlag:          triage.escalationFlag,
        reasoning:               triage.reasoning,
        suggestedNextStepKey:    triage.suggestedNextStepKey,
      },
      // Persist the raw form fields so the officer view can render
      // exactly what the farmer submitted.
      symptoms: Array.isArray(symptoms) ? symptoms.slice() : [],
      affectedPart:   affectedPart || null,
      extent:         extent || null,
      duration:       duration || null,
      imageUrl:       imageUrl || null,
    };
    // Suggested-next-step note, marked `suggested: true` so the
    // farmer-facing timeline hides it until an officer confirms.
    list[idx].notes = (list[idx].notes || []).concat([{
      id:         genId('note'),
      authorRole: 'system',
      authorId:   null,
      text:       triage.suggestedNextStepFallback,
      system:     true,
      suggested:  true,
      createdAt:  list[idx].updatedAt || Date.now(),
    }]);
    // Officer-review flag → auto-escalate immediately.
    if (triage.escalationFlag) {
      list[idx].status = ISSUE_STATUS.ESCALATED;
      list[idx].escalatedAt   = list[idx].updatedAt;
      list[idx].escalatedAuto = true;
      list[idx].escalateReasons = (list[idx].escalateReasons || []).concat([{
        rule: 'health_triage_escalation',
        detail: `Severity ${triage.severity}`,
      }]);
    } else if (triage.requiresOfficerReview) {
      list[idx].requiresOfficerReview = true;
    }
    writeList(list);
    notify();
  }

  return freezeIssue(list[idx] || issue);
}

function buildStructuredDescription({
  symptoms = [], affectedPart = null, extent = null, duration = null, description = '',
}) {
  const parts = [];
  if (Array.isArray(symptoms) && symptoms.length > 0) {
    parts.push(`Symptoms: ${symptoms.join(', ')}`);
  }
  if (affectedPart) parts.push(`Affected: ${affectedPart}`);
  if (extent)       parts.push(`Extent: ${extent}`);
  if (duration)     parts.push(`Started: ${duration}`);
  if (description && String(description).trim()) {
    parts.push(String(description).trim());
  }
  const body = parts.join(' \u00B7 ');
  return body || 'Health issue reported';
}

function mapCategoryToType(category) {
  switch (String(category || '').toLowerCase()) {
    case 'pest':                return 'pest';
    case 'disease':             return 'disease';
    case 'nutrient_deficiency': return 'soil';          // closest existing bucket
    case 'water_stress':        return 'irrigation';
    case 'physical_damage':     return 'weather_damage';
    default:                    return 'other';
  }
}

/**
 * confirmHealthCategory — officer / admin final confirmation. Locks
 * in the human-validated category + optional diagnosis text, clears
 * the "needsOfficerReview" flag, and writes an audit row so the
 * learning loop can correlate predicted vs confirmed.
 *
 *   confirmHealthCategory(issueId, {
 *     category, diagnosis, note, confirmedBy,
 *   }) → Issue | null
 */
export function confirmHealthCategory(issueId, {
  category, diagnosis = null, note = null, confirmedBy = null, now = null,
} = {}) {
  if (!issueId || !category) return null;
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === String(issueId));
  if (idx < 0) return null;
  const before = list[idx];
  const ts = Number.isFinite(now) ? now : Date.now();

  const next = {
    ...before,
    triage: {
      ...(before.triage || {}),
      confirmedCategory: String(category),
      confirmedAt:       ts,
      confirmedBy:       confirmedBy ? String(confirmedBy) : null,
      confirmedDiagnosis: diagnosis ? String(diagnosis) : null,
    },
    requiresOfficerReview: false,
    updatedAt: ts,
    notes: Array.isArray(before.notes) ? before.notes.slice() : [],
  };
  // System note captures the confirmation in the timeline.
  next.notes.push({
    id:         genId('note'),
    authorRole: 'admin',
    authorId:   confirmedBy ? String(confirmedBy) : null,
    text:       diagnosis
      ? `Confirmed category: ${category} — ${diagnosis}`
      : `Confirmed category: ${category}`,
    system:     true,
    createdAt:  ts,
  });
  // Officer's optional response note — visible to the farmer.
  if (note && String(note).trim()) {
    next.notes.push({
      id:         genId('note'),
      authorRole: 'admin',
      authorId:   confirmedBy ? String(confirmedBy) : null,
      text:       String(note).trim(),
      system:     false,
      createdAt:  ts,
    });
  }
  list[idx] = next;
  writeList(list);
  appendAudit(next.id, [{
    action: 'health_category_confirmed',
    result: String(category),
    reasons: [{
      rule: 'officer_confirmation',
      detail: diagnosis || null,
    }],
    actorRole: 'admin',
    actorId:   confirmedBy || null,
    timestamp: ts,
  }]);
  notify();
  return freezeIssue(next);
}

// ─── Farmer-safe status wording (health triage extension) ────────
// Existing FARMER_STATUS_KEYS covers issue status; this map covers
// the category-level safe wording the triage engine emits.
export const FARMER_TRIAGE_CATEGORY_KEYS = Object.freeze({
  pest:                { key: 'health.category.pest',               fallback: 'Likely pest issue' },
  disease:             { key: 'health.category.disease',            fallback: 'Possible disease risk' },
  nutrient_deficiency: { key: 'health.category.nutrient_deficiency', fallback: 'Possible nutrient deficiency' },
  water_stress:        { key: 'health.category.water_stress',       fallback: 'Possible water stress' },
  physical_damage:     { key: 'health.category.physical_damage',    fallback: 'Physical damage noted' },
  unknown:             { key: 'health.category.unknown',            fallback: 'Needs officer review' },
});

export const FARMER_STATUS_KEYS = Object.freeze({
  open:        'issues.farmer.status.reported',     // "Reported"
  assigned:    'issues.farmer.status.assigned',     // "Assigned to field officer"
  in_progress: 'issues.farmer.status.in_progress',  // "Under review"
  resolved:    'issues.farmer.status.resolved',     // "Resolved"
  escalated:   'issues.farmer.status.escalated',    // "Escalated — admin follow-up"
});

export const FARMER_STATUS_FALLBACK = Object.freeze({
  open:        'Reported',
  assigned:    'Assigned to field officer',
  in_progress: 'Under review',
  resolved:    'Resolved',
  escalated:   'Escalated \u2014 admin follow-up',
});

// ─── Unseen-change tracking (spec §8) ─────────────────────────────
/**
 * lastSeenMap is stored as { [issueId]: epochMs }. The UI calls
 * markIssueSeen(id) after it has rendered the latest state for that
 * issue; getUnseenStatusChanges() then returns any issues whose
 * updatedAt is newer than the stored "last seen" timestamp.
 */
function readLastSeen() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeLastSeen(map) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
    return true;
  } catch { return false; }
}

export function markIssueSeen(issueId, { now = Date.now() } = {}) {
  if (!issueId) return false;
  const map = readLastSeen();
  map[String(issueId)] = now;
  return writeLastSeen(map);
}

export function getUnseenStatusChanges({ role = 'farmer', farmerId = null, officerId = null } = {}) {
  const list = getIssuesForRole(role, { farmerId, officerId });
  const lastSeen = readLastSeen();
  const unseen = [];
  for (const i of list) {
    const seen = Number(lastSeen[i.id]) || 0;
    if ((i.updatedAt || 0) > seen) unseen.push(i);
  }
  return unseen;
}

// ─── Field-officer registry (spec §2) ────────────────────────────
// Stored shape: Officer[]
//   { id, name?, regions: string[], crops: string[] }
//
// Kept deliberately simple for v1 — the list is local-first so admin
// tooling can seed it from a CSV or from the invite system without
// the auto-triage layer needing to change. An empty registry means
// every new issue routes to the admin queue.

export function getOfficerRegistry() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(OFFICER_REG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

export function setOfficerRegistry(list) {
  if (!hasStorage()) return false;
  const safe = Array.isArray(list) ? list.filter(Boolean) : [];
  try {
    window.localStorage.setItem(OFFICER_REG_KEY, JSON.stringify(safe));
    return true;
  } catch { return false; }
}

export function upsertOfficer(officer) {
  if (!officer || !officer.id) return null;
  const list = getOfficerRegistry();
  const idx = list.findIndex((o) => o && o.id === officer.id);
  if (idx < 0) list.push(officer); else list[idx] = { ...list[idx], ...officer };
  setOfficerRegistry(list);
  return officer;
}

// ─── Automation audit trail (spec §12) ───────────────────────────
// Shape: { [issueId]: AuditEntry[] }
//   AuditEntry = { action, result, reasons, timestamp, ... }
//
// Written by planAutomationSync + by manual-override calls. Admin
// reads it via getAutomationAudit(issueId).

function readAudit() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeAudit(map) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(map));
    return true;
  } catch { return false; }
}

function appendAudit(issueId, entries) {
  if (!issueId || !Array.isArray(entries) || entries.length === 0) return false;
  const map = readAudit();
  const list = Array.isArray(map[issueId]) ? map[issueId].slice() : [];
  for (const e of entries) if (e) list.push(e);
  map[issueId] = list;
  return writeAudit(map);
}

export function getAutomationAudit(issueId) {
  if (!issueId) return [];
  const map = readAudit();
  const list = map[String(issueId)];
  return Array.isArray(list)
    ? list.map((e) => Object.freeze({ ...e }))
    : [];
}

// ─── Clusters (spec §10) ─────────────────────────────────────────
function readClusters() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(CLUSTERS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeClusters(map) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(CLUSTERS_KEY, JSON.stringify(map));
    return true;
  } catch { return false; }
}

function upsertCluster(cluster) {
  if (!cluster || !cluster.clusterId) return false;
  const map = readClusters();
  map[cluster.clusterId] = {
    ...cluster,
    lastSeenAt: Date.now(),
  };
  return writeClusters(map);
}

export function getClusters() {
  const map = readClusters();
  return Object.values(map).map((c) => Object.freeze({ ...c }))
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
}

// ─── Manual override (spec §11) ──────────────────────────────────
/**
 * setIssueOverride — human re-classification / re-severity /
 * re-assignment. Records every change in the audit trail so the
 * automation's view and the human's view can be compared later.
 *
 *   setIssueOverride(issueId, patch, { actorRole, actorId })
 *     patch = { issueType?, severity?, assignedTo?, suggestedNoteText? }
 *   → the updated, frozen issue (or null)
 */
export function setIssueOverride(issueId, patch = {}, {
  actorRole = null, actorId = null,
} = {}) {
  if (!issueId) return null;
  const list = readList();
  const idx = list.findIndex((i) => i && i.id === String(issueId));
  if (idx < 0) return null;
  const before = list[idx];
  const now = Date.now();
  const changes = {};
  const auditReasons = [];

  if (patch.issueType && VALID_TYPES.has(String(patch.issueType))
      && patch.issueType !== before.issueType) {
    changes.issueType = String(patch.issueType);
    auditReasons.push({ rule: 'override_issueType',
      detail: `${before.issueType} → ${changes.issueType}` });
  }
  if (patch.severity && VALID_SEVERITIES.has(String(patch.severity))
      && patch.severity !== before.severity) {
    changes.severity = String(patch.severity);
    auditReasons.push({ rule: 'override_severity',
      detail: `${before.severity} → ${changes.severity}` });
  }
  if (patch.assignedTo && String(patch.assignedTo) !== String(before.assignedTo || '')) {
    changes.assignedTo = String(patch.assignedTo);
    changes.status = ISSUE_STATUS.ASSIGNED;
    auditReasons.push({ rule: 'override_assignedTo',
      detail: `${before.assignedTo || 'admin_queue'} → ${changes.assignedTo}` });
  }
  if (Object.keys(changes).length === 0) return freezeIssue(before);

  const next = {
    ...before,
    ...changes,
    updatedAt: now,
    notes: Array.isArray(before.notes) ? before.notes.slice() : [],
  };
  next.notes.push({
    id:         genId('note'),
    authorRole: actorRole || 'admin',
    authorId:   actorId ? String(actorId) : null,
    text:       `Manual override: ${auditReasons.map((r) => r.rule).join(', ')}`,
    system:     true,
    createdAt:  now,
  });
  list[idx] = next;
  writeList(list);
  appendAudit(next.id, [{
    action: 'manual_override',
    result: 'applied',
    reasons: auditReasons,
    actorRole: actorRole || 'admin',
    actorId:   actorId || null,
    timestamp: now,
  }]);
  notify();
  return freezeIssue(next);
}

// ─── Test-only helpers ───────────────────────────────────────────
export const _internal = Object.freeze({
  STORAGE_KEY,
  LAST_SEEN_KEY,
  OFFICER_REG_KEY,
  VALID_TRANSITIONS,
  clearAll: () => {
    if (!hasStorage()) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LAST_SEEN_KEY);
      window.localStorage.removeItem(OFFICER_REG_KEY);
      window.localStorage.removeItem(AUDIT_KEY);
      window.localStorage.removeItem(CLUSTERS_KEY);
    } catch { /* ignore */ }
  },
});
