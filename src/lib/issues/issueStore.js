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

// ESM-safe lazy bridge to autoTriage so we don't create an eager
// top-level circular dep (autoTriage imports ISSUE_SEVERITY +
// ISSUE_STATUS from this file). Using a dynamic import would make
// createIssue async, which would be a breaking API change — instead
// we pre-wire the module handle from the consumer side via
// `__wireAutoTriage()`, called once at module graph init below.
let _autoTriageRef = null;
export function __wireAutoTriage(fn) { _autoTriageRef = fn || null; }

const STORAGE_KEY        = 'farroway.issues';
const LAST_SEEN_KEY      = 'farroway.lastSeenIssueUpdates';
const OFFICER_REG_KEY    = 'farroway.officerRegistry';

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

  if (status)   out = out.filter((i) => i.status === status);
  if (crop)     out = out.filter((i) => i.crop === crop);
  if (severity) out = out.filter((i) => i.severity === severity);
  if (location) out = out.filter((i) => String(i.location || '').toLowerCase().includes(String(location).toLowerCase()));
  if (program)  out = out.filter((i) => i.program === program);

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
    createdAt:   stamp,
    updatedAt:   stamp,
  };

  let issue = baseIssue;

  if (autoTriage) {
    // Lazy-import the triage module so the store can be consumed in
    // environments that never opt in (unit tests, SSR probes, etc.)
    // without paying for the extra code.
    //
    // The planner is pure — it returns the decisions, we apply them.
    // We NEVER change status here; assignment uses ISSUE_STATUS.ASSIGNED
    // only when a real officer is picked. Admin queue stays 'open'.
    //
    // Pass the CALLER'S explicit severity (or null) rather than the
    // already-defaulted `baseIssue.severity`, so inferSeverity can
    // actually infer when the caller didn't set one.
    const triageInput = { ...baseIssue, severity: callerSeverity };
    const triage = autoTriageSync(triageInput, { registry });
    const triageNotes = [];
    if (triage.suggestedNote) {
      triageNotes.push({
        id:         genId('note'),
        authorRole: 'system',
        authorId:   null,
        text:       triage.suggestedNote.text,
        system:     true,
        suggested:  true,
        createdAt:  stamp,
      });
    }
    if (triage.systemNote) {
      triageNotes.push({
        id:         genId('note'),
        authorRole: 'system',
        authorId:   null,
        text:       triage.systemNote.text,
        system:     true,
        createdAt:  stamp,
      });
    }

    issue = {
      ...baseIssue,
      // Severity respects the caller's explicit value; autoTriage only
      // refines when the caller sent null.
      severity:   triage.severity || baseIssue.severity,
      notes:      triageNotes,
      // Assignment side-effects — stamp assignedTo + firstAssignedAt
      // inline so we don't need a follow-up assignIssue call (which
      // would also append its own system note and duplicate the one
      // above).
      assignedTo: triage.assignTo || null,
      status:     triage.assignTo ? ISSUE_STATUS.ASSIGNED : ISSUE_STATUS.OPEN,
      firstAssignedAt: triage.assignTo ? stamp : null,
      farmerAck:  triage.farmerAck || null,
    };
  }

  const list = readList();
  list.push(issue);
  writeList(list);
  notify();
  return freezeIssue(issue);
}

// Sync bridge — the triage layer is wired via __wireAutoTriage at
// module-graph init time (see bottom of autoTriage.js). If it's not
// wired yet, createIssue({ autoTriage: true }) just behaves as if
// no officers matched — safe degradation, never a crash.
function autoTriageSync(baseIssue, { registry = null } = {}) {
  const plan = typeof _autoTriageRef === 'function'
    ? _autoTriageRef(baseIssue, {
        registry: registry || getOfficerRegistry(),
        allIssues: readList(),
        now: baseIssue.createdAt,
      })
    : null;
  return plan || {
    severity: baseIssue.severity,
    assignTo: null,
    systemNote: null,
    suggestedNote: null,
    farmerAck: null,
  };
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
    } catch { /* ignore */ }
  },
});
