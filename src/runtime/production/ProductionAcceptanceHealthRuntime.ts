/**
 * src/runtime/production/ProductionAcceptanceHealthRuntime.ts —
 * operator-facing production acceptance composite.
 *
 *   window.__productionAcceptanceHealth()
 *
 * Returns the 13-step contract envelope plus an `overallReady`
 * AND-fold and a `failingSteps` array — the EXACT steps that
 * fail right now. Never fakes PASS.
 *
 * Composition only. Reads existing health globals; does not
 * install or modify any engine. SSR-safe. Frozen envelope.
 * Never throws.
 */

export const PRODUCTION_ACCEPTANCE_RUNTIME_VERSION = 'production-acceptance-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

/**
 * Step-evaluation contract. Each step computes:
 *   ok      — true when ALL of its checks pass
 *   reasons — array of human-readable blocker strings (empty
 *             when ok=true; non-empty when ok=false)
 *
 * No fake PASS — `ok` is the strict AND of explicit checks.
 */
interface StepResult {
  ok:      boolean;
  reasons: string[];
}

function _step(checks: Array<{ name: string; pass: boolean }>): StepResult {
  const reasons: string[] = [];
  for (const c of checks) {
    if (!c.pass) reasons.push(c.name);
  }
  return { ok: reasons.length === 0, reasons };
}

// ─── Individual step evaluators ────────────────────────────────

function _accountCreation(): StepResult {
  const onboarding = _probe('__onboardingHealth');
  return _step([
    { name: 'onboarding_runtime_unavailable',
      pass: !!(onboarding && onboarding.initialized) },
    { name: 'farmer_onboarding_unavailable',
      pass: !!(onboarding && onboarding.farmerOnboardingReady) },
    { name: 'gardener_onboarding_unavailable',
      pass: !!(onboarding && onboarding.gardenerOnboardingReady) },
    { name: 'forced_enterprise_setup_blocks_account_creation',
      pass: !!(onboarding && onboarding.forcedEnterpriseSetup === false) },
  ]);
}

function _inviteEmail(): StepResult {
  const invites = _probe('__inviteHealth');
  return _step([
    { name: 'invite_runtime_unavailable',
      pass: !!(invites && invites.initialized) },
    { name: 'invite_token_hashing_unavailable',
      pass: !!(invites && invites.tokenHashingReady) },
    { name: 'activation_route_not_mounted',
      pass: !!(invites && invites.activationRouteReady) },
    { name: 'fake_delivery_detected',
      pass: !!(invites && invites.fakeDelivery === false) },
    { name: 'email_provider_unconfigured',
      pass: !!(invites && invites.emailProviderConfigured) },
  ]);
}

function _inviteSMS(): StepResult {
  const invites = _probe('__inviteHealth');
  return _step([
    { name: 'invite_runtime_unavailable',
      pass: !!(invites && invites.initialized) },
    { name: 'invite_token_hashing_unavailable',
      pass: !!(invites && invites.tokenHashingReady) },
    { name: 'fake_delivery_detected',
      pass: !!(invites && invites.fakeDelivery === false) },
    { name: 'sms_provider_unconfigured',
      pass: !!(invites && invites.smsProviderConfigured) },
  ]);
}

function _scan(): StepResult {
  const scanCta    = _probe('__scanCtaHealth');
  const scanResult = _probe('__scanResultHealth');
  return _step([
    { name: 'scan_cta_unavailable',
      pass: !!(scanCta && scanCta.savePlantReady
               && scanCta.scanAgainReady) },
    { name: 'scan_result_unavailable',
      pass: !!(scanResult && scanResult.singleResultCard) },
    { name: 'duplicate_render_not_blocked',
      pass: !!(scanResult && scanResult.duplicateRenderBlocked) },
  ]);
}

function _taskGeneration(): StepResult {
  const taskStore = _probe('__taskStoreHealth');
  return _step([
    { name: 'task_store_unavailable',
      pass: !!(taskStore && taskStore.singleTaskSource) },
    { name: 'task_consistency_unavailable',
      pass: !!(taskStore && taskStore.taskConsistencyReady) },
    { name: 'duplicate_task_stores_present',
      pass: !!(taskStore && taskStore.duplicateStoresRemoved) },
  ]);
}

function _taskCompletion(): StepResult {
  const taskStore = _probe('__taskStoreHealth');
  const audit     = _probe('__auditHealth');
  // Audit must cover task_completed for true production-grade
  // task-completion observability.
  const auditCovers = !!(audit
    && Array.isArray(audit.eventCoverage)
    && audit.eventCoverage.some((e: any) => e && e.action === 'task_completed' && e.covered));
  return _step([
    { name: 'task_store_unavailable',
      pass: !!(taskStore && taskStore.singleTaskSource) },
    { name: 'task_completion_not_audited',
      pass: auditCovers },
  ]);
}

function _activityTimeline(): StepResult {
  const activity = _probe('__activityDataHealth');
  return _step([
    { name: 'activity_runtime_unavailable',
      pass: !!(activity && activity.activityKeyCorrect) },
    { name: 'activity_migration_pending',
      pass: !!(activity && activity.migrationReady) },
  ]);
}

function _plantSave(): StepResult {
  const scanCta = _probe('__scanCtaHealth');
  return _step([
    { name: 'plant_save_unavailable',
      pass: !!(scanCta && scanCta.savePlantReady) },
    { name: 'managed_plant_runtime_unavailable',
      pass: _hasGlobal('__plantRuntimeHealth')
            || _hasGlobal('__scanResultHealth') },
  ]);
}

function _offlineSync(): StepResult {
  const offline = _probe('__offlineValidationHealth');
  const queue   = _probe('__queueHealth');
  const sync    = _probe('__syncHealth');
  return _step([
    { name: 'offline_validation_unavailable',
      pass: !!(offline && offline.initialized) },
    { name: 'offline_add_plant_unavailable',
      pass: !!(offline && offline.offlineAddPlantReady) },
    { name: 'offline_task_complete_unavailable',
      pass: !!(offline && offline.offlineTaskCompleteReady) },
    { name: 'reconnect_sync_unavailable',
      pass: !!(offline && offline.reconnectSyncReady) },
    { name: 'duplicate_prevention_unavailable',
      pass: !!(offline && offline.duplicatePreventionReady) },
    { name: 'queue_health_runtime_unavailable',
      pass: !!(queue && queue.initialized) },
    { name: 'sync_runtime_unavailable',
      pass: !!(sync && sync.referenceErrorRemoved
               && sync.syncStateHonest) },
  ]);
}

function _persistence(): StepResult {
  const persistence = _probe('__persistenceHealth');
  if (!persistence) {
    return { ok: false, reasons: ['persistence_runtime_unavailable'] };
  }
  const isProd = persistence.isProduction === true;
  return _step([
    { name: 'database_url_missing',
      pass: !!persistence.databaseUrlPresent },
    { name: 'prisma_client_not_ready',
      pass: !!persistence.prismaClientReady },
    { name: 'migrations_not_applied',
      pass: !!persistence.migrationsApplied },
    { name: 'production_writes_unsafe',
      // In dev, writeEndpointsSafe must be true. In prod, both
      // writeEndpointsSafe AND productionWritesEnabled required.
      pass: !!(persistence.writeEndpointsSafe
               && (!isProd || persistence.productionWritesEnabled)) },
    { name: 'critical_writes_not_persisted',
      // In production, operator flips this flag after running
      // validate:persistence. In dev, this is informational only.
      pass: !isProd || persistence.criticalWritesPersisted === true },
  ]);
}

function _ngoOnboarding(): StepResult {
  const ngo = _probe('__ngoPilotHealth');
  if (!ngo) {
    return { ok: false, reasons: ['ngo_pilot_runtime_unavailable'] };
  }
  const reasons: string[] = [];
  if (Array.isArray(ngo.blockers) && ngo.blockers.length > 0) {
    // Surface the exact NGO blockers verbatim — pre-formatted by
    // the NGO pilot runtime.
    for (const b of ngo.blockers) reasons.push(`ngo_blocker:${b}`);
  }
  if (!ngo.pilotReady) {
    if (reasons.length === 0) reasons.push('ngo_pilot_not_ready');
  }
  return { ok: reasons.length === 0, reasons };
}

function _buyerRegistration(): StepResult {
  const buyer = _probe('__buyerOnboardingHealth');
  return _step([
    { name: 'buyer_runtime_unavailable',
      pass: !!(buyer && buyer.initialized) },
    { name: 'approved_listings_filter_not_enforced',
      pass: !!(buyer && buyer.approvedListingsOnly) },
    { name: 'interest_status_unavailable',
      pass: !!(buyer && buyer.interestStatusReady) },
    { name: 'private_farmer_data_leaked',
      pass: !!(buyer && buyer.privateFarmerDataHidden) },
    { name: 'payment_surface_detected',
      pass: !!(buyer && buyer.noPayments) },
  ]);
}

// ─── Composite envelope ────────────────────────────────────────

export interface ProductionAcceptanceHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  // Per-step booleans (spec contract).
  accountCreationReady:     boolean;
  inviteReady:              boolean;
  smsReady:                 boolean;
  scanReady:                boolean;
  taskReady:                boolean;
  activityReady:            boolean;
  persistenceReady:         boolean;
  ngoReady:                 boolean;
  buyerReady:               boolean;
  overallReady:             boolean;
  // Detailed step results — operator sees the exact gap.
  steps: Readonly<{
    accountCreation:   { ok: boolean; reasons: ReadonlyArray<string> };
    inviteEmail:       { ok: boolean; reasons: ReadonlyArray<string> };
    inviteSms:         { ok: boolean; reasons: ReadonlyArray<string> };
    scan:              { ok: boolean; reasons: ReadonlyArray<string> };
    taskGeneration:    { ok: boolean; reasons: ReadonlyArray<string> };
    taskCompletion:    { ok: boolean; reasons: ReadonlyArray<string> };
    activityTimeline:  { ok: boolean; reasons: ReadonlyArray<string> };
    plantSave:         { ok: boolean; reasons: ReadonlyArray<string> };
    offlineSync:       { ok: boolean; reasons: ReadonlyArray<string> };
    persistence:       { ok: boolean; reasons: ReadonlyArray<string> };
    ngoOnboarding:     { ok: boolean; reasons: ReadonlyArray<string> };
    buyerRegistration: { ok: boolean; reasons: ReadonlyArray<string> };
  }>;
  failingSteps:             ReadonlyArray<string>;
  /** "All clear" / "n step(s) failing" honest single-line summary. */
  summary:                  string;
}

function _freezeStep(r: StepResult) {
  return Object.freeze({
    ok: r.ok,
    reasons: Object.freeze([...r.reasons]),
  });
}

const FROZEN_FALLBACK: Readonly<ProductionAcceptanceHealth> = Object.freeze({
  runtimeVersion:        PRODUCTION_ACCEPTANCE_RUNTIME_VERSION,
  initialized:           false,
  accountCreationReady:  false,
  inviteReady:           false,
  smsReady:              false,
  scanReady:             false,
  taskReady:             false,
  activityReady:         false,
  persistenceReady:      false,
  ngoReady:              false,
  buyerReady:            false,
  overallReady:          false,
  steps: Object.freeze({
    accountCreation:   Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    inviteEmail:       Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    inviteSms:         Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    scan:              Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    taskGeneration:    Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    taskCompletion:    Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    activityTimeline:  Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    plantSave:         Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    offlineSync:       Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    persistence:       Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    ngoOnboarding:     Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
    buyerRegistration: Object.freeze({ ok: false, reasons: Object.freeze(['probe_failure']) }),
  }),
  failingSteps:          Object.freeze(['probe_failure']),
  summary:               'Probe failed to initialise',
});

export function productionAcceptanceHealth(): ProductionAcceptanceHealth {
  return _safe(() => {
    const accountCreation   = _accountCreation();
    const inviteEmail       = _inviteEmail();
    const inviteSms         = _inviteSMS();
    const scan              = _scan();
    const taskGeneration    = _taskGeneration();
    const taskCompletion    = _taskCompletion();
    const activityTimeline  = _activityTimeline();
    const plantSave         = _plantSave();
    const offlineSync       = _offlineSync();
    const persistence       = _persistence();
    const ngoOnboarding     = _ngoOnboarding();
    const buyerRegistration = _buyerRegistration();

    // Map step results to the spec's 9 contract booleans.
    const accountCreationReady = accountCreation.ok;
    const inviteReady          = inviteEmail.ok;
    const smsReady             = inviteSms.ok;
    const scanReady            = scan.ok;
    // taskReady = generation AND completion both green.
    const taskReady            = taskGeneration.ok && taskCompletion.ok && plantSave.ok;
    const activityReady        = activityTimeline.ok;
    // persistenceReady covers refresh AND logout/login — both
    // require Postgres + writeEndpointsSafe; covered by the
    // persistence step's checks.
    const persistenceReady     = persistence.ok && offlineSync.ok;
    const ngoReady             = ngoOnboarding.ok;
    const buyerReady           = buyerRegistration.ok;

    const overallReady =
         accountCreationReady
      && inviteReady
      && smsReady
      && scanReady
      && taskReady
      && activityReady
      && persistenceReady
      && ngoReady
      && buyerReady;

    // Failing-steps list — exact step keys whose ok=false.
    const stepsMap: Record<string, StepResult> = {
      'account-creation':    accountCreation,
      'invite-email':        inviteEmail,
      'invite-sms':          inviteSms,
      'scan':                scan,
      'task-generation':     taskGeneration,
      'task-completion':     taskCompletion,
      'activity-timeline':   activityTimeline,
      'plant-save':          plantSave,
      'offline-sync':        offlineSync,
      'persistence':         persistence,
      'ngo-onboarding':      ngoOnboarding,
      'buyer-registration':  buyerRegistration,
    };
    const failing: string[] = [];
    for (const key of Object.keys(stepsMap)) {
      if (!stepsMap[key].ok) failing.push(key);
    }

    const summary = overallReady
      ? 'All 13 acceptance steps ready'
      : `${failing.length} step(s) failing: ${failing.join(', ')}`;

    return Object.freeze({
      runtimeVersion:        PRODUCTION_ACCEPTANCE_RUNTIME_VERSION,
      initialized:           true,
      accountCreationReady,
      inviteReady,
      smsReady,
      scanReady,
      taskReady,
      activityReady,
      persistenceReady,
      ngoReady,
      buyerReady,
      overallReady,
      steps: Object.freeze({
        accountCreation:   _freezeStep(accountCreation),
        inviteEmail:       _freezeStep(inviteEmail),
        inviteSms:         _freezeStep(inviteSms),
        scan:              _freezeStep(scan),
        taskGeneration:    _freezeStep(taskGeneration),
        taskCompletion:    _freezeStep(taskCompletion),
        activityTimeline:  _freezeStep(activityTimeline),
        plantSave:         _freezeStep(plantSave),
        offlineSync:       _freezeStep(offlineSync),
        persistence:       _freezeStep(persistence),
        ngoOnboarding:     _freezeStep(ngoOnboarding),
        buyerRegistration: _freezeStep(buyerRegistration),
      }),
      failingSteps:          Object.freeze(failing),
      summary,
    });
  }, FROZEN_FALLBACK);
}

export function installProductionAcceptanceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__productionAcceptanceHealth !== 'function') {
      w.__productionAcceptanceHealth = function () {
        const out = productionAcceptanceHealth();
        try { console.log('[Farroway · Production Acceptance]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
