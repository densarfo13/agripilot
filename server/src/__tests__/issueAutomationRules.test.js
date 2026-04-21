/**
 * issueAutomationRules.test.js — covers the full automation plan:
 * classifier + severity + assignment + cluster + escalation + audit.
 *
 * Spec §15 mapping:
 *   1. pest keywords classify correctly             ✓ classifier
 *   2. flood/waterlogging becomes high severity      ✓ severity
 *   3. low-confidence unknown issue escalates        ✓ orchestrator
 *   4. auto-assignment picks correct regional officer ✓ assignment
 *   5. no officer match falls back to admin queue    ✓ assignment
 *   6. safe suggestion shown only for allowed cases  ✓ orchestrator
 *   7. critical issue does not auto-resolve          ✓ orchestrator
 *   8. repeated farm issues raise severity           ✓ severity
 *   9. cluster detection creates admin alert         ✓ cluster
 *  10. manual override still works after automation  ✓ store
 *  11. audit log written for every automated step    ✓ store
 *  12. farmer always gets acknowledgement            ✓ orchestrator
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import { classifyIssue } from '../../../src/lib/issues/issueClassifier.js';
import { scoreSeverity } from '../../../src/lib/issues/issueSeverity.js';
import { pickAssignment } from '../../../src/lib/issues/issueAssignment.js';
import { detectCluster } from '../../../src/lib/issues/clusterDetection.js';
import { planAutomation } from '../../../src/lib/issues/automationRules.js';
import {
  createIssue, getIssueById, getClusters, getAutomationAudit,
  setOfficerRegistry, setIssueOverride, ISSUE_STATUS, ISSUE_SEVERITY, _internal,
} from '../../../src/lib/issues/issueStore.js';

beforeEach(() => {
  installLocalStorage();
  _internal.clearAll();
});

// ─── Classifier ──────────────────────────────────────────────────
describe('classifyIssue', () => {
  it('pest keywords classify as pest with high confidence', () => {
    const r = classifyIssue({
      description: 'armyworms eating leaves everywhere',
      issueType:   'pest',
    });
    expect(r.issueType).toBe('pest');
    expect(r.confidence).toBe('high');
    expect(r.matchedRules.some((m) => m.keyword === 'armyworm')).toBe(true);
  });

  it('disease keywords classify as disease', () => {
    const r = classifyIssue({
      description: 'severe leaf blight spreading fast',
      issueType:   'disease',
    });
    expect(r.issueType).toBe('disease');
  });

  it('flood words classify as water', () => {
    const r = classifyIssue({
      description: 'standing water and flooded furrows after the rain',
      issueType:   'weather_damage',
    });
    expect(r.issueType).toBe('water');
  });

  it('drought words classify as water', () => {
    const r = classifyIssue({
      description: 'no rain for two weeks, plants are wilting',
      issueType:   'irrigation',
    });
    expect(r.issueType).toBe('water');
  });

  it('vague text with no form hint → unknown, low confidence', () => {
    const r = classifyIssue({
      description: 'something odd with the field',
      issueType:   'other',
    });
    expect(r.issueType).toBe('unknown');
    expect(r.confidence).toBe('low');
  });

  it('ambiguous "yellow leaves" resolves via form-picked hint', () => {
    const nut = classifyIssue({
      description: 'just a few yellow leaves',
      issueType:   'soil',
    });
    // Tie between nutrient + disease, form says soil (→ nutrient),
    // so nutrient wins.
    expect(nut.issueType).toBe('nutrient');
  });
});

// ─── Severity ────────────────────────────────────────────────────
describe('scoreSeverity', () => {
  it('flood + waterlogging → high severity', () => {
    const classification = classifyIssue({
      description: 'whole field is waterlogged after flooding',
      issueType:   'irrigation',
    });
    const s = scoreSeverity({
      description: 'whole field is waterlogged after flooding',
      classification,
      crop: 'maize',
    });
    expect(['high', 'critical']).toContain(s.severity);
    expect(s.reasons.some((r) => r.rule === 'flood_or_waterlogging')).toBe(true);
  });

  it('emergency words → critical', () => {
    const classification = classifyIssue({
      description: 'the crop is dying, emergency, whole farm destroyed',
      issueType:   'pest',
    });
    const s = scoreSeverity({
      description: 'the crop is dying, emergency, whole farm destroyed',
      classification,
      crop: 'rice',
    });
    expect(s.severity).toBe('critical');
  });

  it('disease on staple crop bumps from medium → high', () => {
    const classification = classifyIssue({
      description: 'rust on the leaves',
      issueType:   'disease',
    });
    const s = scoreSeverity({
      description: 'rust on the leaves',
      classification,
      crop: 'maize', // staple
    });
    expect(s.severity).toBe('high');
    expect(s.reasons.some((r) => r.rule === 'staple_crop_disease')).toBe(true);
  });

  it('pest on a few plants stays medium', () => {
    const classification = classifyIssue({
      description: 'aphids on a few plants',
      issueType:   'pest',
    });
    const s = scoreSeverity({
      description: 'aphids on a few plants',
      classification,
      crop: 'tomato',
    });
    expect(s.severity).toBe('medium');
  });

  it('repeated farm reports bumps severity one band', () => {
    const classification = classifyIssue({
      description: 'aphids here and there',
      issueType:   'pest',
    });
    const before = scoreSeverity({
      description: 'aphids here and there',
      classification,
      crop: 'tomato',
      recentFarmIssueCount: 1,
    });
    const after = scoreSeverity({
      description: 'aphids here and there',
      classification,
      crop: 'tomato',
      recentFarmIssueCount: 3,
    });
    const order = ['low', 'medium', 'high', 'critical'];
    expect(order.indexOf(after.severity))
      .toBeGreaterThan(order.indexOf(before.severity));
    expect(after.reasons.some((r) => r.rule === 'repeated_farm_reports')).toBe(true);
  });

  it('low-confidence classification caps severity at medium', () => {
    const classification = {
      issueType: 'weather_damage', confidence: 'low', matchedRules: [],
    };
    const s = scoreSeverity({
      description: 'some damage I think',
      classification,
      crop: 'maize',
    });
    expect(['low', 'medium']).toContain(s.severity);
    expect(s.reasons.some((r) => r.rule === 'low_confidence_capped_to_medium')).toBe(true);
  });
});

// ─── Assignment ──────────────────────────────────────────────────
describe('pickAssignment', () => {
  const registry = [
    // ofc_a + ofc_b cover region AS; only ofc_a covers maize there.
    { id: 'ofc_a', regions: ['AS'], crops: ['maize'] },
    { id: 'ofc_b', regions: ['AS'], crops: ['cassava'] },
    // ofc_c covers region CP.
    { id: 'ofc_c', regions: ['CP'], crops: ['tomato'] },
    // ofc_d is a program-only officer (no region/crop coverage).
    { id: 'ofc_d', regions: [],     crops: [],        programs: ['p1'] },
  ];

  it('region + crop wins over region-only', () => {
    const r = pickAssignment({
      issue: { crop: 'maize', stateCode: 'AS', program: 'p1' },
      registry,
    });
    expect(r.officerId).toBe('ofc_a');
    expect(r.reasonTier).toBe('region_and_crop');
  });

  it('region-only picks up when crop doesn\u2019t match', () => {
    const r = pickAssignment({
      issue: { crop: 'yam', stateCode: 'AS' },
      registry,
    });
    expect(r.reasonTier).toBe('region_only');
    // a and b both cover region AS, tie broken by position.
    expect(['ofc_a', 'ofc_b']).toContain(r.officerId);
  });

  it('program match fires when region/crop fail', () => {
    const r = pickAssignment({
      issue: { crop: 'yam', stateCode: 'XX', program: 'p1' },
      registry,
    });
    expect(r.reasonTier).toBe('program_match');
    expect(r.officerId).toBe('ofc_d');
  });

  it('admin queue fallback when nothing matches', () => {
    const r = pickAssignment({
      issue: { crop: 'barley', stateCode: 'XX' },
      registry,
    });
    expect(r.officerId).toBeNull();
    expect(r.reasonTier).toBe('admin_queue');
  });

  it('workload tiebreaker prefers the less-loaded officer', () => {
    const r = pickAssignment({
      issue: { crop: 'yam', stateCode: 'AS' },
      registry,
      workload: { ofc_a: 10, ofc_b: 0 },
    });
    expect(r.officerId).toBe('ofc_b');
  });
});

// ─── Cluster detection ───────────────────────────────────────────
describe('detectCluster', () => {
  function issueAt(overrides, ts) {
    return { id: `i_${ts}`, stateCode: 'AS', issueType: 'pest',
             crop: 'maize', createdAt: ts, ...overrides };
  }

  it('does not fire below the 5-report threshold', () => {
    const now = Date.now();
    const set = [
      issueAt({}, now - 1_000),
      issueAt({}, now - 2_000),
      issueAt({}, now - 3_000),
    ];
    const c = detectCluster(issueAt({ id: 'i_new' }, now), set, { now });
    expect(c).toBeNull();
  });

  it('fires when region + issueType match across ≥5 issues (inclusive of new)', () => {
    const now = Date.now();
    const set = [];
    // Four pre-existing siblings → this new one is the 5th total.
    for (let k = 0; k < 4; k += 1) set.push(issueAt({}, now - (k + 1) * 1000));
    const c = detectCluster(issueAt({ id: 'new' }, now), set, { now });
    expect(c).toBeTruthy();
    expect(c.count).toBe(5);     // inclusive count
    expect(c.region).toBe('AS');
    expect(c.issueType).toBe('pest');
    expect(c.ids).toContain('new');
  });

  it('ignores issues older than the window', () => {
    const now = Date.now();
    const windowMs = 7 * 24 * 3600 * 1000;
    const set = [];
    for (let k = 0; k < 5; k += 1) {
      set.push(issueAt({}, now - windowMs - k * 1000));
    }
    const c = detectCluster(issueAt({ id: 'new' }, now), set, { now });
    expect(c).toBeNull();
  });
});

// ─── Orchestrator end-to-end ─────────────────────────────────────
describe('planAutomation — integration', () => {
  it('escalates when unknown + low confidence', () => {
    const plan = planAutomation({
      id: 'x', description: 'the field is strange',
      issueType: 'other', crop: 'maize',
    }, { registry: [], allIssues: [] });
    expect(plan.classification.issueType).toBe('unknown');
    expect(plan.escalate).toBe(true);
    expect(plan.escalateReasons.some((r) => r.rule === 'unknown_low_confidence')).toBe(true);
  });

  it('escalates on staple-crop disease', () => {
    const plan = planAutomation({
      id: 'x', description: 'leaf rust spreading on the cobs',
      issueType: 'disease', crop: 'maize',
    }, { registry: [], allIssues: [] });
    expect(plan.escalate).toBe(true);
    expect(plan.escalateReasons.some((r) => r.rule === 'staple_crop_disease')).toBe(true);
  });

  it('safe suggestion ONLY shows for medium+ confidence and non-critical', () => {
    // High confidence pest, medium severity → pest containment line.
    const pest = planAutomation({
      id: 'p', description: 'armyworms chewing leaves',
      issueType: 'pest', crop: 'maize',
    }, { registry: [], allIssues: [] });
    expect(pest.suggestion.kind).toBe('safe_containment');

    // Critical → falls back to neutral line (never operational advice).
    const crit = planAutomation({
      id: 'c', description: 'emergency, whole farm dying',
      issueType: 'pest', crop: 'maize',
    }, { registry: [], allIssues: [] });
    expect(crit.suggestion.kind).toBe('none');
  });

  it('always produces a farmer acknowledgement', () => {
    const plan = planAutomation({
      id: 'x', description: 'something weird',
      issueType: 'other', crop: 'onion',
    }, { registry: [], allIssues: [] });
    expect(typeof plan.farmerAck).toBe('string');
    expect(plan.farmerAck.length).toBeGreaterThan(0);
  });

  it('builds a 4-step audit trail (+ escalate + cluster when applicable)', () => {
    const plan = planAutomation({
      id: 'x', description: 'leaf rust on the cobs',
      issueType: 'disease', crop: 'maize',
    }, { registry: [], allIssues: [] });
    const actions = plan.audit.map((a) => a.action);
    expect(actions).toContain('auto_triage');
    expect(actions).toContain('auto_severity');
    expect(actions).toContain('auto_assign');
    expect(actions).toContain('auto_acknowledge');
    expect(actions).toContain('auto_escalate');
  });
});

// ─── End-to-end via createIssue ──────────────────────────────────
describe('createIssue({ autoTriage: true }) — full pipeline', () => {
  it('escalates + routes to admin when no officer matches', () => {
    const iss = createIssue({
      farmId: 'f1', description: 'rust on cobs spreading everywhere',
      issueType: 'disease', crop: 'maize', location: 'AS',
      autoTriage: true,
    });
    expect(iss.status).toBe(ISSUE_STATUS.ESCALATED);
    expect(iss.assignedTo).toBeNull();
    expect(iss.escalatedAuto).toBe(true);
    expect(iss.autoTriage.classifiedAs).toBe('disease');
    // "everywhere" triggers widespread_damage which bumps a staple-
    // crop disease from high → critical. Either is a valid verdict
    // for auto-escalation.
    expect(['high', 'critical']).toContain(iss.autoSeverity.severity);
    expect(iss.assignment.reasonTier).toBe('admin_queue');
    const audit = getAutomationAudit(iss.id);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((e) => e.action === 'auto_escalate')).toBe(true);
  });

  it('assigns to regional+crop officer when one exists and issue is routine', () => {
    setOfficerRegistry([
      { id: 'ofc_1', regions: ['AS'], crops: ['tomato'] },
    ]);
    const iss = createIssue({
      farmId: 'f1', description: 'aphids on a few plants',
      issueType: 'pest', crop: 'tomato', location: 'AS',
      autoTriage: true,
    });
    expect(iss.status).toBe(ISSUE_STATUS.ASSIGNED);
    expect(iss.assignedTo).toBe('ofc_1');
    expect(iss.assignment.reasonTier).toBe('region_and_crop');
    expect(iss.farmerAck).toMatch(/received and assigned/i);
  });

  it('never auto-resolves a critical issue', () => {
    setOfficerRegistry([
      { id: 'ofc_1', regions: ['AS'], crops: ['maize'] },
    ]);
    const iss = createIssue({
      description: 'emergency, whole farm dying', issueType: 'pest',
      crop: 'maize', location: 'AS', autoTriage: true,
    });
    expect(iss.status).not.toBe(ISSUE_STATUS.RESOLVED);
  });

  it('farmer always gets an ack string', () => {
    const iss = createIssue({
      description: 'mild yellowing', issueType: 'soil',
      crop: 'tomato', autoTriage: true,
    });
    expect(typeof iss.farmerAck).toBe('string');
    expect(iss.farmerAck.length).toBeGreaterThan(0);
  });

  it('cluster detection fires on the 5th similar issue in the region', () => {
    setOfficerRegistry([]);
    for (let k = 0; k < 4; k += 1) {
      createIssue({
        farmId: `f_${k}`, description: 'armyworm damage', issueType: 'pest',
        crop: 'maize', location: 'AS', autoTriage: true,
      });
    }
    const fifth = createIssue({
      farmId: 'f_5', description: 'armyworm damage here too', issueType: 'pest',
      crop: 'maize', location: 'AS', autoTriage: true,
    });
    expect(fifth.clusterId).toBeTruthy();
    const clusters = getClusters();
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBeGreaterThanOrEqual(5);
  });
});

// ─── Manual override (spec §11 + §15 #10) ────────────────────────
describe('setIssueOverride', () => {
  it('admin can override issueType + severity + assignedTo', () => {
    const iss = createIssue({
      description: 'weird farm issue', issueType: 'other', crop: 'tomato',
      autoTriage: true,
    });
    const after = setIssueOverride(iss.id, {
      issueType: 'pest',
      severity:  ISSUE_SEVERITY.HIGH,
      assignedTo: 'ofc_manual',
    }, { actorRole: 'admin', actorId: 'admin_1' });
    expect(after.issueType).toBe('pest');
    expect(after.severity).toBe(ISSUE_SEVERITY.HIGH);
    expect(after.assignedTo).toBe('ofc_manual');
    expect(after.status).toBe(ISSUE_STATUS.ASSIGNED);

    const audit = getAutomationAudit(iss.id);
    const overrideEntry = audit.find((e) => e.action === 'manual_override');
    expect(overrideEntry).toBeTruthy();
    expect(overrideEntry.reasons.some((r) => r.rule === 'override_issueType')).toBe(true);
  });

  it('returns the existing issue unchanged when no fields changed', () => {
    const iss = createIssue({
      description: 'x', issueType: 'pest', crop: 'maize', autoTriage: true,
    });
    const after = setIssueOverride(iss.id, {
      issueType: iss.issueType,
      severity:  iss.severity,
    }, { actorRole: 'admin' });
    expect(after.id).toBe(iss.id);
    // No override audit entry since nothing changed.
    const audit = getAutomationAudit(iss.id);
    expect(audit.some((e) => e.action === 'manual_override')).toBe(false);
  });

  it('is a no-op for unknown ids', () => {
    expect(setIssueOverride('missing', { severity: 'high' })).toBeNull();
  });
});
