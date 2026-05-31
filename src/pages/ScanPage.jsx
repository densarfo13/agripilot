/**
 * ScanPage — the new /scan flow entry point.
 *
 * State machine
 *   capture   → user picks/takes a photo (analysis auto-starts;
 *               there is no manual "Analyze" button)
 *   analyzing → engine runs (rule-based or API)
 *   result    → ScanResultCard renders the outcome
 *   error     → fallback rendered with retry
 *
 * Coexistence
 *   The existing /scan-crop surface (CameraScanPage) ships today.
 *   This page is the spec-aligned alternative behind the
 *   `scanDetection` feature flag. When the flag is off, the page
 *   bounces to /scan-crop so deep links still land somewhere.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { resolveRegionUX } from '../core/regionUXEngine.js';
import { analyzeScan } from '../core/scanDetectionEngine.js';
// Final Scan Consumer Migration — ScanPage.onContinue no longer
// calls analyzeScan / analyzeImageSafe DIRECTLY. The classifier
// is passed to ScanRuntime which enforces the spec contracts
// (assertValidScanInput, validateScanResult, isLowConfidenceAllowed,
// session-id verification). ScanPage becomes a runtime consumer
// for the analysis dispatch path.
import { useScanRuntime } from '../hooks/useScanRuntime.js';
// Phase 7E — ML scan safe mode: lightweight category enrichment.
// When mlScan is on, analyzeImageSafe attaches a structured
// category + message to the result so the result card can render
// the five safe categories (healthy / yellowing / holes or pest
// damage / spots or disease concern / needs review) without any
// heavy model loading or external API dependency.
import { analyzeImageSafe, ML_CATEGORIES, CATEGORY_MESSAGES } from '../lib/mlScanAnalyzer.js';
// Hybrid engine layers context (active experience + weather +
// region) on top of the image-only verdict so the result is
// safer + more actionable. See src/core/hybridScanEngine.js.
import { hybridAnalyze } from '../core/hybridScanEngine.js';
// High-trust scan output policy \u2014 sanitises forbidden wording
// and gives us the canonical "Check this again tomorrow" follow-up
// task we attach to Add to Today's Plan (spec \u00a77).
import { followUpTaskFor, sanitizeScanText } from '../core/scanResultPolicy.js';
// Runtime Authority Cleanup — direct persistence calls are now
// funneled through scanPersistenceBridge. The legacy direct
// imports (saveScanEntry / addScanTasks) stay accessible to other
// callers but ScanPage uses the bridge below.
import { saveScanEntry } from '../runtime/data/scanHistory.js';
import { addScanTasks } from '../core/scanToTask.js';
import {
  persistScanToJournal, persistScanUseful,
  markScanTaskAdded, createScanFollowUpTasks,
} from '../core/scan/scanPersistenceBridge.js';
import { trackEvent } from '../analytics/analyticsStore.js';
// Data Moat Layer follow-up \u2014 spec-shaped scan events fire
// through the canonical analytics service so eventStore +
// userMemory + insightAggregator pick them up. Legacy domain
// events (scan_opened / scan_photo_taken / scan_analyzed /
// scan_saved / etc.) keep their existing route via the
// analyticsStore import above so the older dashboard surfaces
// stay in sync.
import { trackEvent as moatTrack } from '../core/analytics.js';
// Final scan engine spec §2: scans must attach to the active
// context — gardenId when activeExperience='garden', farmId
// when 'farm'. useExperience reads the canonical multi-
// experience selector so the routing matches what BottomTabNav
// + ExperienceSwitcher are showing on screen.
import useExperience from '../hooks/useExperience.js';
import ScanCapture from '../components/scan/ScanCapture.jsx';
import ScanEntryCard from '../components/scan/ScanEntryCard.jsx';
import ScanHub from '../components/scan/ScanHub.jsx';
import IntelligentScanResult from '../components/scan/IntelligentScanResult.jsx';
// Wave-26 C-4 — single-result-card invariant. Gates IntelligentScanResult
// so it is mutually exclusive with the legacy UsefulResultCard /
// ScanResultCard path. Until the wave-21 analysis runtime is mounted
// end-to-end, this returns false and only the legacy card mounts.
import { shouldRenderIntelligentResult } from '../runtime/launchBlockers/ScanResultHealthRuntime';
// UI tightening pass §8 — chips + recent-scans hint that sit below
// the camera/upload card during the capture phase. Replaces the
// previously empty page real-estate the spec called out.
import ScanCaptureUpgrade from '../components/scan/ScanCaptureUpgrade.jsx';
import ScanAnalyzing from '../components/scan/ScanAnalyzing.jsx';
import ScanResultCard from '../components/scan/ScanResultCard.jsx';
// Crash-safe fallback used by:
//   • Setup-required guard ("setup_required" reason)
//   • Camera unavailable / permission denied
//   • 3s load timeout
import ScanFallback from '../components/scan/ScanFallback.jsx';
// Advanced ML scan layer §9: ask the user "Was this helpful?"
// after the result renders so we can build a training-data
// foundation. Self-suppresses after one tap per scanId.
import ScanFeedbackPrompt from '../components/scan/ScanFeedbackPrompt.jsx';
// High-confidence ML spec §2 + §5: 2-3 yes/no checks before we
// commit to a specific named condition; "Confirm with local
// expert" CTA when the verdict warrants a human second opinion.
import ScanVerificationChecklist from '../components/scan/ScanVerificationChecklist.jsx';
import ScanLocalExpertCTA from '../components/scan/ScanLocalExpertCTA.jsx';
// Treatment recommendation spec: structured non-chemical-first
// guidance + class-only chemical hints + prevention tips +
// warning + disclaimer. Renders below the result card.
import TreatmentGuidanceCard from '../components/scan/TreatmentGuidanceCard.jsx';
import ScanHistory from '../components/scan/ScanHistory.jsx';
// FEATURE_SCAN_USEFULNESS — clean farmer-friendly result card +
// local-first history at farroway_scan_history_v1.
import { FEATURE_SCAN_USEFULNESS } from '../lib/pilotFlags.js';
import UsefulResultCard from '../components/scan/UsefulResultCard.jsx';
import UsefulScanHistory from '../components/scan/UsefulScanHistory.jsx';
import { saveScanUseful, markTaskAdded } from '../lib/scan/scanHistoryStore.js';
// Gap-fix sprint §2 — Scan → Managed Plant confirmation card.
// Mounted under the result card; user MUST tap "Add to My
// Plants" to create a managed plant record. No auto-create.
import AddPlantConfirmationCard from '../components/plants/AddPlantConfirmationCard.jsx';
import {
  scanToManagedPlant as _scanToManagedPlant,
} from '../runtime/plants/index';
import {
  loadManagedPlants as _loadManagedPlants,
  appendManagedPlant as _appendManagedPlant,
} from '../runtime/data/managedPlants.js';
// Scan Pipeline Enforcement — race-condition guard. Each onContinue
// call starts a fresh scan session; result publications inside
// async callbacks (15s fallback, analyze response, ML-failure
// fallback) check isStaleScanSession() and silently drop if the
// user has already retaken / cancelled. Closes the "stale
// diagnosis leaks into new attempt" class of bug.
import {
  startScanSession,
  endScanSession,
  isStaleScanSession,
} from '../core/scan/scanSessionId.js';
// V5 stability pass — wide session manager. Composes with the
// existing race-guard above (createScanSession internally bumps
// the same id) and adds the persistent {sessionId, lifecycle,
// localUri, normalizedUri, uploadedUrl, aiStatus, retryCount, …}
// shape the V5 spec asks for. Every async-publish path below
// calls updateSession alongside its setResult so the debug
// overlay + offline-restore + __scanHistory all stay accurate.
import {
  createScanSession,
  updateSession,
  endSession as endScanSessionV5,
  getActiveSession,
} from '../core/scan/scanSessionManager.js';
import { LIFECYCLE_STATE } from '../core/scan/scanLifecycleStateMachine.js';
// V5 stability + production incident pass: append-only event log
// so a field operator can reconstruct the failure chain after the
// fact. Persisted to localStorage, surfaced via __scanTelemetry().
import { emitScanEvent, SCAN_EVENTS } from '../core/scan/scanTelemetry.js';
// Farm-intelligence loop §10 — minimum-viable offline scan queue.
// When the network call fails AND we have a usable base64 image,
// stash the scan locally so an online retry can run it through
// the real ML model. The queue auto-drains on the browser's
// `online` event AND on ScanPage mount when we're online.
import {
  enqueueScan,
  drainQueue,
  isLikelyOnline,
} from '../lib/offlineScanQueue.js';
import { PremiumPage, PremiumPageHero } from '../components/premium/index.js';
import { resolveRealismImage, REALISM_ASSETS } from '../lib/realVisuals.jsx';
// Premium line-icon system (May 2026 realism migration). Used by
// the soil-scan tile at the bottom of the Scan page; replaces the
// legacy plant-pot emoji that previously sat there.
import { default as RealisticIconLazy } from '../assets/realism/icons/RealisticIcon.jsx';
// Wave-28 Harvest Readiness — composition runtime evaluated AFTER
// ScanRuntime returns a normalized result. NEVER bypasses
// ScanRuntime; never owns camera; never writes tasks from UI.
// The runtime returns a frozen envelope that we attach to
// `result.harvest` for the ScanResultCard child to render.
import { evaluate as evaluateHarvest, isSupportedPlant as isHarvestSupportedPlant }
  from '../runtime/harvest';
import { logEvent as logHarvestEvent } from '../lib/events/eventLogger.js';
// Wave-29 Scan Intelligence V2 — four composition runtimes pinned
// to the same scan-result pipeline. Each is pure / SSR-safe /
// frozen / never throws. They attach onto `result.intelligence`
// so the ScanResultCard child can render them in the spec's
// order without architectural change.
import { evaluate as evaluateGrowthStage,
         getWeeksSincePlanting }                 from '../runtime/growth';
import { evaluate as evaluateSeverity }          from '../runtime/severity';
import { evaluate as evaluateOutcomeComparison } from '../runtime/outcomeComparison';
import { evaluate as evaluateWeatherRisk }       from '../runtime/weatherRisk';
// Wave-36 V5 Invisible Intelligence — three composition runtimes
// that produce decision-level signals. Output attaches to
// `result.intelligence.v5`. NEVER expose raw NDVI / graph JSON
// to growers — only the safeMessage from each runtime is rendered.
import { evaluate as evaluateYieldIntelligence } from '../runtime/yield';
import { evaluate as evaluateSatellite }         from '../runtime/satellite';
// Wave-37 risk-fix #4 — derive farmSizeHa from the canonical
// farm.size + farm.sizeUnit via the existing pure converter.
// Static import keeps the path simple and tree-shakable.
import { toSquareMeters as _farmSizeToSquareMeters } from '../lib/units/areaConversion.js';

// Unified Soft Ochre / Beige system. The mount-pending surface
// (rendered before <PremiumPage> takes over) now uses the locked
// page background + ink colors so cold-start does not flash the
// legacy dark-navy + white-on-navy text.
const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title:    { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: '#667085', lineHeight: 1.5 },
};

function _readExperience(profile) {
  // Prefer the local "experience" hint written by BackyardOnboarding;
  // fall back to resolveRegionUX from the active farm.
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('farroway_experience') : null;
    const stored = raw ? JSON.parse(raw) : null;
    if (stored === 'farm' || stored === 'backyard' || stored === 'generic') return stored;
  } catch { /* fall through */ }
  try {
    const ux = resolveRegionUX({
      detectedCountry: profile?.country || profile?.countryCode || null,
      detectedRegion:  profile?.region || null,
      farmType:        profile?.farmType || profile?.type || null,
    });
    return ux.experience;
  } catch { return 'generic'; }
}

// Single-interface scan fix: when the browser can open getUserMedia,
// /scan is JUST the camera — no PremiumPage chrome, no hero, no
// capability chips, no recent-scans summary. The previous wrapper
// surface was the "Ready to scan / Scan Crop / Photograph the
// affected area" hero painted behind LiveCameraScanner; this flag
// makes that whole wrapper disappear so the user lands directly
// on the camera viewfinder. The flag is computed at module load
// so SSR-safe consumers see `false` and render the normal page
// chrome (same fallback path as missing getUserMedia).
function _scanSupportsLiveCamera() {
  try {
    return typeof navigator !== 'undefined'
        && navigator.mediaDevices
        && typeof navigator.mediaDevices.getUserMedia === 'function';
  } catch { return false; }
}

export default function ScanPage() {
  // Subscribe to language change so labels refresh.
  useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Scan UX Final Fix — tapping the Scan bottom-nav navigates
  // to /scan?intent=camera with route state. Direct /scan URLs
  // (refresh, deep link, PWA restore) have NEITHER and stay
  // idle. This is the single decision point.
  const _launchedFromScanNav = (() => {
    try {
      const params = new URLSearchParams(location.search || '');
      if (params.get('intent') === 'camera') return true;
      const st = (location.state || {});
      return st.userInitiatedCamera === true
        && (st.source === 'bottom_nav' || st.cameraAttempted === true);
    } catch { return false; }
  })();

  const flagOn   = isFeatureEnabled('scanDetection');
  const mlScanOn = isFeatureEnabled('mlScan');

  // RC1 fix — scan no longer auto-opens the camera on mount.
  // Default phase is 'idle'; ScanEntryCard renders the calm
  // "Take photo / Use saved photo" landing. Camera only starts
  // when the user taps "Take photo" (sets phase='capture' AND
  // cameraAttempted=true so ScanFallback's "Camera ran into a
  // problem" card cannot fire on first load).
  const [phase, setPhase] = useState('idle');
  // True ONLY once the user has explicitly requested camera access
  // via the entry card. ScanFallback / overlays use this to suppress
  // the camera-error card during initial mount.
  const [cameraAttempted, setCameraAttempted] = useState(false);
  // scan-idle-entry-v3: explicit "user tapped Take photo / Retry
  // camera" flag. ScanFallback now refuses to render the camera-
  // error card unless BOTH cameraAttempted AND userInitiatedCamera
  // are true — hard-blocking the error card on first load even if
  // a downstream component throws.
  const [userInitiatedCamera, setUserInitiatedCamera] = useState(false);

  // Scan UX Final Fix — when the bottom-nav Scan tap brought the
  // user here (?intent=camera or route state), promote them
  // straight to the capture phase. Idle entry stays the default
  // for direct URLs / refreshes / PWA restores.
  const _launchedFromScanNavRef = useRef(_launchedFromScanNav);
  useEffect(() => {
    if (!_launchedFromScanNavRef.current) return;
    // Mark as consumed so a re-mount without a fresh nav tap
    // does not auto-launch the camera.
    _launchedFromScanNavRef.current = false;
    setCameraAttempted(true);
    setUserInitiatedCamera(true);
    setPhase('capture');
    // Strip the intent param from the URL so a refresh of the
    // resulting page lands back on the idle entry rather than
    // re-launching the camera. Replace history entry; no nav.
    try {
      if (typeof window !== 'undefined' && window.history
          && typeof window.history.replaceState === 'function'
          && location.search) {
        window.history.replaceState({}, '', location.pathname);
      }
    } catch { /* swallow */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Hidden gallery input ref — wired below so the "Use saved photo"
  // button on the entry card opens a file picker WITHOUT mounting
  // LiveCameraScanner (no getUserMedia call on the saved-photo path).
  const entryGalleryInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // Wave-28 — track which scanId already had harvest evaluation
  // attached so the useEffect below is idempotent (one evaluation
  // per scan). Prevents render-loops and prevents duplicate
  // timeline events / artifacts on reconnect-replay.
  const _harvestSeenRef = useRef(new Set());
  // Wave-35 H4 — keep window.__farrowayLastWeather populated even
  // when the user deep-links to /scan without visiting Home first.
  // Composes useLiveWeather indirectly: we check if the snapshot
  // is missing on mount and trigger a fresh resolve via a
  // lightweight hook import. Reads location from profile only —
  // never owns geolocation.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const w = window;
    if (w.__farrowayLastWeather
        && w.__farrowayLastWeather.snapshotAt) return undefined;
    let cancelled = false;
    // Lazy import — keeps the weather hook out of the scan-page
    // critical-path bundle when the snapshot is already fresh.
    import('../hooks/useLiveWeather.js')
      .then((m) => {
        if (cancelled) return;
        // The hook itself writes __farrowayLastWeather on resolve.
        // We can't call the hook here (rules-of-hooks); the host
        // page that DID mount it (Home) is the canonical writer.
        // What we CAN do: pre-warm by fetching the same endpoint
        // directly so the snapshot exists before the scan finishes.
        try {
          const lat = profile?.lat || profile?.latitude;
          const lng = profile?.lng || profile?.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number') return;
          const url = `/api/weather?lat=${lat}&lng=${lng}`;
          fetch(url, { credentials: 'include' }).then((r) => r.json()).then((j) => {
            if (cancelled) return;
            w.__farrowayLastWeather = Object.freeze({
              tempC:        j?.tempC ?? null,
              rainChance:   j?.rainChance ?? null,
              weatherType:  j?.weatherType ?? null,
              humidity:     j?.humidity ?? null,
              windKph:      j?.windKph ?? null,
              locationLabel: j?.locationLabel ?? null,
              source:       'ScanPage-prewarm',
              snapshotAt:   new Date().toISOString(),
            });
          }).catch(() => { /* swallow */ });
        } catch { /* swallow */ }
        void m;
      })
      .catch(() => { /* swallow — weather is non-critical */ });
    return () => { cancelled = true; };
  }, [profile]);

  // Wave-31 H4 — surface the Add-to-My-Plants result so the user
  // sees explicit feedback when the workflow returns ineligible
  // (e.g. plant not in catalog) or already-managed. Founder audit
  // flagged the previous silent return as a HIGH adoption blocker.
  // Three values: 'idle' | 'ineligible:{reason}' | 'added'.
  const [addPlantNotice, setAddPlantNotice] = useState('');
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [tasksAdded, setTasksAdded] = useState(false);
  // Wave-28 Harvest Readiness — single-shot evaluation per scan.
  // Runs AFTER ScanRuntime has populated `result` (we never call
  // ScanRuntime or the camera from here; we read the normalized
  // envelope). Attaches `harvest` to the result, emits two
  // timeline events through the canonical logEvent (whitelisted
  // in EVENT_TYPES), and composes createHarvestArtifact via the
  // existing ArtifactRuntime — no new architecture.
  useEffect(() => {
    if (!result) return undefined;
    const scanId = result.scanId || result.id || '';
    if (!scanId) return undefined;
    if (result.harvest) return undefined;            // already attached
    if (_harvestSeenRef.current.has(scanId)) return undefined;
    _harvestSeenRef.current.add(scanId);

    const ctxPlantId = (result.plantId
                     || result.crop
                     || result.cropId
                     || result.plantName
                     || result.cropName
                     || profile?.crop
                     || profile?.cropId
                     || '') + '';
    // Plant-not-supported gate — runtime would also return
    // category:'unknown' but the upfront check saves a no-op
    // evaluate() call and keeps the CI gate's audit clean
    // (the gate enforces that unsupported plants never see the card).
    if (!isHarvestSupportedPlant(ctxPlantId)) return undefined;

    const harvest = evaluateHarvest({
      scanResult: result,
      plantContext: {
        plantId:        ctxPlantId,
        plantName:      result.plantName || result.cropName || result.crop || null,
        // Wave-28 risk-fix #6 — source lifecycleStage from the
        // canonical farm/profile context, with the scan-envelope
        // value taking precedence when present. cropStage is the
        // existing MyFarm-edit-flow field; lifecycleStage is the
        // scan-runtime field; either is acceptable as a hint to
        // the ripeness engine (it lowercases + substring-matches
        // 'mature', 'bud', etc).
        lifecycleStage: result.lifecycleStage
                     || profile?.lifecycleStage
                     || profile?.cropStage
                     || null,
        region:         profile?.region    || null,
        season:         profile?.season    || null,
        recentScanCategory: result.category || null,
      },
      timestamp: new Date().toISOString(),
    });

    // Wave-29 Scan Intelligence V2 — compose four additional
    // runtimes against the same normalized scan result. Order is
    // important: severity MUST run before outcomeComparison so
    // the comparison can read the just-appended history row.
    // All four are pure + SSR-safe + frozen-envelope.
    const tsIso = new Date().toISOString();
    const severity = evaluateSeverity({
      scanResult: result,
      plantContext: { plantId: ctxPlantId },
      timestamp: tsIso,
    });
    // Wave-30 gap-fix #3 — derive weeksSincePlanting from the
    // canonical farroway.plantingDates store with a sensible
    // key composition: prefer `${farmId}:${plantId}`, fall back to
    // bare `${plantId}`. Returns null when no date is stored, in
    // which case the growth engine uses its keyword signals only.
    const _plantKey      = (activeFarmId && ctxPlantId)
                            ? `${activeFarmId}:${ctxPlantId}` : ctxPlantId;
    const _wksFromStore  = getWeeksSincePlanting(_plantKey || '');
    const _wksFromKeyOnly = (!_wksFromStore && activeFarmId && ctxPlantId)
                            ? getWeeksSincePlanting(ctxPlantId) : null;
    const weeksSincePlanting = (typeof profile?.weeksSincePlanting === 'number')
                              ? profile.weeksSincePlanting
                              : (_wksFromStore ?? _wksFromKeyOnly ?? undefined);

    const growthStage = evaluateGrowthStage({
      scanResult: result,
      plantContext: {
        plantId:          ctxPlantId,
        lifecycleStage:   result.lifecycleStage
                          || profile?.lifecycleStage
                          || profile?.cropStage,
        weeksSincePlanting,
      },
      timestamp: tsIso,
    });
    const outcomeComparison = evaluateOutcomeComparison({
      currentScan: { ...result, scanId },
      plantContext: { plantId: ctxPlantId },
      timestamp: tsIso,
    });
    const weatherRisk = evaluateWeatherRisk({
      scanResult: { ...result, scanId },
      plantContext: { plantId: ctxPlantId, region: profile?.region },
      // useLiveWeather is the existing canonical hook; we read the
      // last weather snapshot the host page already resolved via
      // window.__farrowayLastWeather if available (no new fetch).
      weather: (typeof window !== 'undefined'
                && (window).__farrowayLastWeather) || {},
      timestamp: tsIso,
    });

    // Wave-36 V5 Invisible Intelligence — composes three new
    // runtimes against the V2 outputs. Satellite returns
    // `unavailable:true` when no provider configured — that's
    // an honest signal, NEVER fake values. Yield returns
    // `hasEnoughData:false` when signals are too thin —
    // farmer UI then shows "Not enough data yet". Knowledge
    // graph is invisible: the runtime is queryable via
    // window.__knowledgeGraphHealth() but never rendered.
    const satellite = evaluateSatellite({
      farmId: activeFarmId || undefined,
      scanId,
      region: profile?.region,
      cropType: ctxPlantId,
      timestamp: tsIso,
    });
    // Wave-37 risk-fix #4 — derive farmSizeHa from the canonical
    // farm record (profile.size + profile.sizeUnit) via the
    // existing toSquareMeters converter. Returns undefined when
    // the farm record is missing a size; yield runtime then
    // returns "Not enough data yet" via hasEnoughData=false.
    let _farmSizeHa;
    try {
      if (typeof profile?.farmSizeHa === 'number') {
        _farmSizeHa = profile.farmSizeHa;
      } else if (profile?.size != null && profile?.sizeUnit) {
        const sqm = _farmSizeToSquareMeters(profile.size, profile.sizeUnit);
        if (Number.isFinite(sqm) && sqm > 0) _farmSizeHa = sqm / 10000;
      }
    } catch { /* swallow — yield falls back to "not enough data" */ }

    const yieldIntel = evaluateYieldIntelligence({
      plantId: ctxPlantId,
      scanId,
      farmSizeHa:         _farmSizeHa,
      growthStage:        growthStage?.stage,
      // Wave-37 risk-fix #2 — region multiplier wired through.
      // Normalizes the profile region (e.g. "South Africa") to the
      // multiplier lookup key (south_africa).
      region:             typeof profile?.region === 'string'
                          ? profile.region.toLowerCase().replace(/\s+/g, '_')
                          : undefined,
      scanHealthScore:    typeof result.confidence === 'number'
                          ? (result.confidence > 1
                              ? result.confidence
                              : result.confidence * 100)
                          : undefined,
      severityLevel:      severity?.level,
      pestPressure:       (severity && Array.isArray(severity.damageSigns)
                            && severity.damageSigns.some((s) =>
                              /pest|aphid|beetle|borer|mite|caterpil/i.test(String(s))))
                          ? 'high' : undefined,
      weatherRiskLevel:   weatherRisk?.overallRisk,
      vegetationHealth:   satellite?.vegetationHealth,
      moistureRisk:       satellite?.moistureRisk,
      heatStress:         satellite?.heatStress,
      ndviTrend:          satellite?.ndviTrend,
      timestamp: tsIso,
    });

    // Attach to the result so child cards (HarvestReadinessCard /
    // BloomStageCard) can render. Spread keeps every other field
    // including imageUrl + thumbnail intact. wave-29 adds
    // `intelligence` as a single frozen sub-envelope.
    setResult((prev) => prev ? {
      ...prev,
      harvest,
      intelligence: Object.freeze({
        severity,
        growthStage,
        outcomeComparison,
        weatherRisk,
        // Wave-36 V5 — invisible-intelligence outputs. UI renders
        // ONLY the safeMessage from each runtime, never NDVI /
        // graph JSON / raw yield numbers. The yield forecast band
        // is the only numeric we expose, and only when
        // hasEnoughData is true.
        v5: Object.freeze({ yieldIntel, satellite }),
      }),
    } : prev);

    // Timeline emissions — canonical eventLogger only. Two events:
    //   • harvest_readiness_checked — always (every evaluation)
    //   • fruit_ripeness_checked    — when category is fruit/vegetable/crop
    //   • bloom_stage_checked       — when category is flower
    // logEvent is fail-soft: missing type → silent drop.
    try {
      logHarvestEvent({
        type: 'harvest_readiness_checked',
        farmId: activeFarmId || null,
        payload: {
          scanId,
          plantId: ctxPlantId,
          ripenessStatus: harvest.ripenessStatus,
          score: harvest.harvestReadinessScore,
          needsReview: harvest.needsReview,
        },
      });
      if (harvest.category === 'flower') {
        logHarvestEvent({
          type: 'bloom_stage_checked',
          farmId: activeFarmId || null,
          payload: { scanId, plantId: ctxPlantId, bloomStage: harvest.bloomStage },
        });
      } else if (harvest.category && harvest.category !== 'unknown') {
        logHarvestEvent({
          type: 'fruit_ripeness_checked',
          farmId: activeFarmId || null,
          payload: { scanId, plantId: ctxPlantId,
                     ripenessStatus: harvest.ripenessStatus },
        });
      }
      // Wave-28 risk-fix #2 — emit harvest_task_generated when the
      // runtime returned ≥1 recommended task. Surfaces in the
      // activity timeline so QA can see the task-suggestion fan-out
      // without scraping localStorage. Idempotency-key carried so
      // the event is unique per (scan, status) tuple.
      if (Array.isArray(harvest.recommendedTasks)
          && harvest.recommendedTasks.length > 0) {
        logHarvestEvent({
          type: 'harvest_task_generated',
          farmId: activeFarmId || null,
          payload: {
            scanId, plantId: ctxPlantId,
            ripenessStatus: harvest.ripenessStatus,
            taskCount:      harvest.recommendedTasks.length,
            idempotencyKey: harvest.idempotencyKey,
          },
        });
      }
      // Wave-29 Scan Intelligence V2 — three new timeline events
      // matching the V2 envelope. Each fires only when the
      // corresponding runtime produced a meaningful result (the
      // runtime's needsReview flag is the gate — UNKNOWN/needsReview
      // skips the event to keep activity timelines clean).
      if (growthStage && !growthStage.needsReview) {
        logHarvestEvent({
          type: 'growth_stage_detected',
          farmId: activeFarmId || null,
          payload: { scanId, plantId: ctxPlantId,
                     stage: growthStage.stage,
                     model: growthStage.model },
        });
      }
      if (severity && !severity.needsReview) {
        logHarvestEvent({
          type: 'severity_updated',
          farmId: activeFarmId || null,
          payload: { scanId, plantId: ctxPlantId,
                     level: severity.level, score: severity.score },
        });
      }
      if (outcomeComparison && !outcomeComparison.needsReview) {
        logHarvestEvent({
          type: 'outcome_compared',
          farmId: activeFarmId || null,
          payload: { scanId, plantId: ctxPlantId,
                     status: outcomeComparison.status,
                     beforeSeverity: outcomeComparison.beforeSeverity,
                     afterSeverity:  outcomeComparison.afterSeverity },
        });
      }
    } catch { /* swallow — timeline is non-critical */ }

    // Artifact composition — ArtifactRuntime already has
    // createHarvestArtifact. Fire-and-forget; the runtime is
    // idempotent on (plantId, scanId, idempotencyKey).
    try {
      import('../runtime/artifacts/index').then((m) => {
        try {
          if (m && typeof m.createHarvestArtifact === 'function'
              && ctxPlantId) {
            m.createHarvestArtifact({
              userId:   (profile?.id || profile?.userId || ''),
              plantId:  ctxPlantId,
              farmId:   activeFarmId || profile?.farmId || '',
              gardenId: activeGardenId || profile?.gardenId || '',
              photoUrl: result.imageUrl || result.thumbnail || '',
              metadata: {
                scanId,
                ripenessStatus:  harvest.ripenessStatus,
                readinessScore:  harvest.harvestReadinessScore,
                estimatedWindow: harvest.estimatedHarvestWindow || null,
                confidence:      harvest.confidence,
                idempotencyKey:  harvest.idempotencyKey,
              },
              source: 'farroway-harvest-runtime',
            });
          }
        } catch { /* swallow — artifact creation is non-critical */ }
      }).catch(() => { /* swallow */ });
    } catch { /* swallow */ }

    return undefined;
  }, [result, profile, activeFarmId, activeGardenId]);

  // May 2026 scan-crash hardening §7-§8 — show "Preparing
  // camera…" instead of a blank screen during initial mount;
  // flip to true after the first useEffect tick so the spinner
  // doesn't flash on a fast mount. A 3-second hard-stop in the
  // same effect surfaces ScanFallback if the page somehow
  // doesn't reach interactive state.
  const [mounted, setMounted] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  // Thumbnail produced by ScanCapture for the history list.
  // Persisted via saveScanEntry; expires with the rest of the
  // history slot.
  const [pendingThumbnail, setPendingThumbnail] = useState(null);

  // Photo URL captured at the moment analysis auto-started —
  // shown in the premium ScanAnalyzing surface so the analysis
  // sequence is visually anchored to the actual photo, not a
  // black rectangle. Cleared when phase moves back to capture.
  const [analyzingImageUrl, setAnalyzingImageUrl] = useState(null);
  // Scan Pipeline Audit §4 — staged-timeout escalation flag.
  // null         → default "Analyzing crop" copy
  // 'still_checking' → escalated "Still checking your crop" copy
  //                    (set after 5s of pending analysis)
  const [analyzingEscalation, setAnalyzingEscalation] = useState(null);
  // Phase 11 — focus context captured by ScanCapture's
  // leafFocusEngine. ScanAnalyzing reads this to render the
  // bbox-overlay preview + the live guidance chips ("move closer",
  // "lighting too dark", "multiple leaves"). Cleared on retake so
  // the next scan starts with a clean slate.
  const [analyzingFocusContext, setAnalyzingFocusContext] = useState(null);

  // Read profile defensively — the page must work in a logged-out
  // / no-active-farm state.
  const profile = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem('farroway_active_farm') : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);
  const experience = useMemo(() => _readExperience(profile), [profile]);

  // Final scan engine spec §2: prefer the canonical
  // multi-experience selector for the active id pair so the
  // scan attaches to whichever experience the BottomTabNav +
  // ExperienceSwitcher are currently showing.
  //
  // Hook-ordering fix (May 2026 scan-crash hardening): the
  // previous version called useExperience() inside a try/catch.
  // That is the React #310 anti-pattern — if the hook ever
  // throws on a re-render the surrounding catch silently
  // shifts React's hook counter and the page crashes with
  // "Rendered more hooks than during the previous render",
  // surfacing as "We hit a problem rendering this page" via
  // the global ErrorBoundary. useExperience is documented
  // never-throws (its read is a snapshot from the local
  // multiExperience store), so we call it unconditionally and
  // defensively coerce the result.
  const xp = useExperience();
  let activeExperience = experience;
  let activeGardenId = null;
  let activeFarmId   = null;
  try {
    if (xp && xp.experience) {
      activeExperience = xp.experience === xp.EXPERIENCE.GARDEN ? 'garden'
                       : xp.experience === xp.EXPERIENCE.FARM   ? 'farm'
                       : experience;
      activeGardenId = xp.activeGardenId || null;
      activeFarmId   = xp.activeFarmId   || null;
    }
  } catch { /* defensive — coercion shouldn't throw, but guard anyway */ }

  // Canonical scan system lock (May 2026 §12) — `/scan` IS the
  // single canonical scan surface. The previous off-flag bounce
  // to `/scan-crop` was a latent infinite-redirect trap: App.jsx
  // already redirects `/scan-crop` → `/scan`, so flipping the
  // flag would loop the browser between the two routes. The
  // `scanDetection` flag has been permanent since the v2 rollout;
  // we keep `flagOn` in the file so the existing render guards
  // (early return `if (!flagOn) return null`) still respect a
  // hard kill switch, but the bounce-to-legacy is gone.
  useEffect(() => {
    if (flagOn) {
      try { trackEvent('scan_opened', { experience }); } catch { /* ignore */ }
    }
  }, [flagOn, experience]);

  // scan-idle-entry-v3 § ROUTE-ENTRY RESET — on every entry to
  // /scan we force the route into idle mode and wipe any stale
  // transient "camera_error" state that a prior session may have
  // restored from localStorage / sessionStorage / runtime
  // snapshots. Scan HISTORY is preserved — we only clear the
  // transient UI error/status keys.
  //
  // Mount-only effect so this never fights with mid-session
  // state changes.
  useEffect(() => {
    let cancelled = false;
    // 1. Reset React-local transient state.
    setPhase('idle');
    setCameraAttempted(false);
    setUserInitiatedCamera(false);
    setError('');
    setResult(null);
    setAddPlantNotice('');
    setLoadTimedOut(false);
    // 2. Clear browser-storage camera/scan-UI error keys. NEVER
    //    touch farroway_scan_history_* — history must survive.
    try {
      if (typeof localStorage !== 'undefined') {
        const KEYS = [
          'farroway_scan_camera_error',
          'farroway_scan_capture_error',
          'farroway_scan_ui_error',
          'farroway_scan_phase',
          'farroway_camera_status',
        ];
        for (const k of KEYS) {
          try { localStorage.removeItem(k); } catch { /* swallow */ }
        }
      }
      if (typeof sessionStorage !== 'undefined') {
        const KEYS = [
          'farroway_scan_camera_error',
          'farroway_scan_phase',
        ];
        for (const k of KEYS) {
          try { sessionStorage.removeItem(k); } catch { /* swallow */ }
        }
      }
    } catch { /* never block mount on storage cleanup */ }
    // 3. Pin window.__forceScanIdle so QA / Sentry can yank the
    //    route back to idle from the console without a reload.
    try {
      if (typeof window !== 'undefined' && !cancelled) {
        window.__forceScanIdle = function _forceScanIdle() {
          try {
            setPhase('idle');
            setCameraAttempted(false);
            setUserInitiatedCamera(false);
            setError('');
            setResult(null);
    setAddPlantNotice('');
            setLoadTimedOut(false);
            return true;
          } catch { return false; }
        };
      }
    } catch { /* swallow */ }
    return () => { cancelled = true; };
    // Intentional one-shot — runs once per /scan route mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // iPhone Safari camera hardening (2026-05-13) §1 — the previous
  // 3-second hard-stop fired whenever phase === 'capture', which
  // is the DEFAULT phase. On iOS Safari getUserMedia + the
  // permission prompt routinely take 3–8s, so the timer was
  // racing the camera and surfacing "Camera didn't start in
  // time" before iOS had even granted permission.
  //
  // New behaviour:
  //   • The hard-stop is gated on `!mounted` only — it protects
  //     the case where React itself never reached interactive
  //     state (lazy chunk fetch stalled, render frozen). The
  //     LiveCameraScanner owns its own camera-ready timeout and
  //     surfaces its own Try-again / Upload from gallery panel,
  //     so the page does NOT need to second-guess it.
  //   • Deadline extended to 15s (well above the iOS cold-start
  //     budget) — `mounted` flips after a microtask in practice,
  //     so this only fires on genuine mount failures.
  // Real-device root-cause fix — on iPhone Safari the previous
  // `setTimeout(... 0)` macrotask sat behind a backlogged boot
  // queue, leaving `mounted` false for several visible seconds.
  // Use queueMicrotask so the flip lands before the next paint
  // regardless of how busy the macrotask queue is. Also use a
  // ref so the hard-stop's stale-closure read of `mounted` is
  // replaced by the live current value.
  const _mountedRef = useRef(false);
  useEffect(() => {
    if (!flagOn) return undefined;
    let cancelled = false;
    const flip = () => {
      if (cancelled) return;
      _mountedRef.current = true;
      setMounted(true);
    };
    try {
      if (typeof queueMicrotask === 'function') queueMicrotask(flip);
      else Promise.resolve().then(flip);
    } catch {
      try { setTimeout(flip, 0); } catch { /* swallow */ }
    }
    // Real-device root-cause fix — drop hard-stop from 15s to 5s
    // (matches wave-real-device spec) and consult the ref so a
    // successful late flip isn't mis-stamped as a stall.
    const tHardStop = setTimeout(() => {
      if (cancelled) return;
      if (!_mountedRef.current) {
        setLoadTimedOut(true);
        try { trackEvent('scan_load_failed', { reason: 'mount_stall_5s' }); }
        catch { /* swallow */ }
      }
    }, 5000);
    return () => { cancelled = true; clearTimeout(tHardStop); };
    // Intentional one-shot — only fires on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn]);

  // §10 offline-first auto-drain — when ScanPage mounts AND the
  // user is online, try to retry any queued scans in the background.
  // Also listen for the browser's `online` event so a queue that
  // built up while the user was offline gets drained as soon as
  // the network returns. The retry function re-runs analyzeScan
  // and persists each success via saveScanUseful so the journal
  // catches up automatically. Failures bump each entry's attempt
  // counter (capped inside drainQueue) so we don't loop forever
  // on a permanently bad image.
  useEffect(() => {
    if (!flagOn) return undefined;
    let cancelled = false;

    const retryFn = async (entry) => {
      const out = await analyzeScan({
        imageBase64: entry.imageBase64,
        imageUrl:    null,
        cropId:      entry.cropName || null,
        cropName:    entry.cropName || null,
        plantName:   null,
        country:     null,
        region:      entry.region || null,
        experience:  entry.experience || 'generic',
        activeExperience: entry.experience || 'generic',
        weather:     null,
      });
      // Best-effort persist so the timeline picks it up. We don't
      // overwrite the user's CURRENT result — they may have already
      // moved on. The journal entry is enough.
      if (FEATURE_SCAN_USEFULNESS) {
        persistScanUseful(out, { experience: entry.experience || 'generic' });
      }
      try { moatTrack('scan_offline_retry_success', { scanId: out?.scanId || null }); }
      catch { /* swallow */ }
      return out;
    };

    const tryDrain = async () => {
      if (cancelled) return;
      if (!isLikelyOnline()) return;
      try { await drainQueue(retryFn); } catch { /* never propagate */ }
    };

    // Drain on mount (when we're online).
    tryDrain();

    // Drain on the browser's online event.
    let onlineHandler = null;
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        onlineHandler = () => { tryDrain(); };
        window.addEventListener('online', onlineHandler);
      }
    } catch { /* swallow */ }

    return () => {
      cancelled = true;
      try {
        if (onlineHandler && typeof window !== 'undefined') {
          window.removeEventListener('online', onlineHandler);
        }
      } catch { /* swallow */ }
    };
    // Intentional one-shot — drain wiring runs once per ScanPage
    // mount + persists across phase changes.
     
  }, [flagOn]);

  // Scan Hardening §6 — duplicate-scan prevention. A simple ref
  // guard prevents a second analyzeScan from kicking off while one
  // is already in flight. A re-fired capture event (common on
  // touch devices with imprecise hit detection) previously created
  // parallel requests that fought for setResult — now the second
  // tap is a no-op until the first call returns.
  const _scanInflightRef = useRef(false);
  // Per-call scan session id. Set at the start of onContinue;
  // every setResult below checks `isStaleScanSession(_sessionRef.current)`
  // before publishing so a fallback timer / late analyze response
  // can never overwrite a fresher attempt.
  const _sessionRef = useRef(null);

  // ─── Final Scan Consumer Migration ──────────────────────────
  // The classifier wrapper that ScanRuntime invokes. It calls the
  // existing analyzeScan + hybridAnalyze + analyzeImageSafe path
  // — ScanPage no longer calls them DIRECTLY in onContinue. The
  // runtime applies assertValidScanInput before invoking this
  // classifier and validateScanResult on the return.
  //
  // We pass classifier inputs via a stable ref so the classifier
  // closure stays cheap to recreate while still seeing the latest
  // focusContext / weather / cropId per call.
  const _classifierInputRef = useRef(null);

  const _runActiveScanClassifier = useCallback(async () => {
    const ctx = _classifierInputRef.current;
    if (!ctx) return null;
    // Primary engine call — unchanged signature.
    const out = await analyzeScan({
      imageBase64:      ctx.aiImageBase64,
      imageUrl:         ctx.imageUrl,
      cropId:           ctx.cropId,
      cropName:         ctx.cropName,
      plantName:        ctx.plantName,
      country:          ctx.country,
      region:           ctx.region,
      experience:       ctx.experience,
      activeExperience: ctx.activeExperience,
      weather:          ctx.weather,
      focusContext:     ctx.focusContext,
      originalBase64:   ctx.imageBase64,
      lesionCropBase64: ctx.lesionCropBase64,
    });
    // Hybrid refinement — same as the legacy inline path.
    let refinedOut = out;
    try {
      const hybrid = hybridAnalyze({
        imageResult:      out,
        plantName:        ctx.plantName,
        cropName:         ctx.cropName,
        activeExperience: ctx.activeExperience,
        country:          ctx.country,
        region:           ctx.region,
        weather:          ctx.weatherSnapshot,
        sizeSqFt:         ctx.landSizeSqFt,
        growingSetup:     ctx.growingSetup,
      });
      refinedOut = {
        ...out,
        possibleIssue:      hybrid.possibleIssue,
        confidence:         hybrid.confidence,
        recommendedActions: hybrid.recommendedActions,
        suggestedTasks: (() => {
          const existing = Array.isArray(out?.suggestedTasks) ? out.suggestedTasks : [];
          const seen = new Set(existing.map((t) => String(t?.title || '').toLowerCase()));
          const followUp = hybrid.followUpTask;
          if (followUp && !seen.has(String(followUp.title || '').toLowerCase())) {
            return [followUp, ...existing].slice(0, 2);
          }
          return existing.slice(0, 2);
        })(),
        hybridReason:    hybrid.reason,
        hybridUrgency:   hybrid.urgency,
        hybridContext:   hybrid.contextType,
        disclaimer:      hybrid.disclaimer,
      };
    } catch { /* hybrid disabled — fall through to engine output */ }
    // ML augmentation when the flag is on.
    if (ctx.mlScanOn) {
      try {
        const mlResult = analyzeImageSafe({
          cropId:    ctx.cropId,
          plantName: ctx.plantName,
          experience: ctx.experience,
          imageBase64: ctx.imageBase64,
        });
        refinedOut = {
          ...refinedOut,
          category:  mlResult.category,
          mlStatus:  mlResult.status,
          mlLabel:   mlResult.label,
          message:   refinedOut.message || mlResult.message,
        };
      } catch { /* analyzeImageSafe should not throw, but guard */ }
    }
    // Map confidence band → confidenceTone for the spec §12 result
    // contract. All legacy fields pass through unchanged so the
    // existing ScanResultCard renderer continues to work.
    const _confidenceTone = refinedOut?.confidence === 'high' ? 'high_confidence'
                          : refinedOut?.confidence === 'medium' ? 'medium_confidence'
                          : 'needs_review';
    return Object.freeze({
      diagnosis:      refinedOut?.possibleIssue || refinedOut?.diagnosis || 'Needs Review',
      confidenceTone: _confidenceTone,
      severity:       refinedOut?.urgency || null,
      recommendation: refinedOut?.recommendedActions
        ? { actions: refinedOut.recommendedActions } : null,
      // Pass-through every legacy field so downstream rendering +
      // journal save logic continues to read the same envelope shape.
      ...refinedOut,
    });
  }, []);

  // Mount the runtime once. The classifier closures over the ref
  // so input changes don't re-create the runtime.
  //
  // EMERGENCY FIX (scan-idle-entry-v3): the prior version passed
  // `locale: lang`, but `lang` was never declared in this file.
  // That ReferenceError fired on every ScanPage render, was caught
  // by ScanErrorBoundary, and surfaced ScanFallback with
  // reason='crash' — the on-screen camera-error card. Per the
  // Emergency Fix, ScanFallback now never shows the banned
  // wording: it renders the upload-first landing card instead.
  // useScanRuntime tolerates a null/empty locale, so we pass
  // null. Locale is resolved downstream via tSafe envelopes.
  const _scanRuntime = useScanRuntime({
    activeFarm: profile,
    locale:     null,
    classifier: _runActiveScanClassifier,
    autoRegisterDiagnostic: true,
  });

  const onContinue = useCallback(async ({ imageBase64, imageUrl, thumbnail, file, focusContext }) => {
    // §6 — inflight guard. Bail silently if a scan is already
    // running; the in-progress analyzing surface is its own UI
    // feedback that the request is live.
    if (_scanInflightRef.current) {
      try {
         
        console.log('[FARROWAY_SCAN_PIPELINE] duplicate_suppressed');
      } catch { /* swallow */ }
      return;
    }
    _scanInflightRef.current = true;
    // V5 stability — create a fresh scan session via the session
    // manager. Internally bumps the same race-guard id every async
    // callback below checks, and seeds the wide session record
    // (localUri / lifecycle / source / device) for the debug
    // overlay + offline restore. Returns the frozen record so we
    // can pluck the id without a second read.
    const sessionRec = createScanSession({ source: file ? 'live_camera_or_gallery' : 'unknown' });
    _sessionRef.current = sessionRec ? sessionRec.sessionId : startScanSession();
    const _localSessionId = _sessionRef.current;
    setError('');
    try { emitScanEvent(SCAN_EVENTS.SCAN_START, {
      sessionId: _localSessionId,
      hasBase64: !!imageBase64,
      hasThumbnail: !!thumbnail,
      hasFile: !!file,
      // Phase 11 — leaf-focus telemetry. The full crops are way
      // too large for the event log, so we strip them here and
      // keep just the metrics + guidance flags. Restorable from
      // the session manager when the bridge needs the visual.
      focusOk:         !!(focusContext && focusContext.ok),
      focusReason:     (focusContext && focusContext.reason) || null,
      focusGuidance:   (focusContext && focusContext.guidance) || null,
      focusCoveragePct: (focusContext && focusContext.metrics
        && focusContext.metrics.leafCoveragePct) || null,
    }); } catch { /* never block analysis on telemetry */ }

    // Scan V5 Stability — survive ObjectURL revocation by ALWAYS
    // preferring a dataURL. ScanCapture's unmount cleanup revokes
    // its objectURL the instant the page advances to 'analyzing',
    // so a revoked URL would render the "broken ? preview" bug.
    //
    // Priority change (V5): imageBase64 wins over thumbnail. After
    // the imageNormalization pass landed in acceptCapturedFile,
    // imageBase64 is the 2048-px normalized JPEG (~300-800 KB) —
    // the SAME bytes the AI receives. Rendering THAT in the result
    // card means the user sees the exact photo that was analyzed,
    // not a 96-px pixelated thumbnail.
    //
    // If both are missing (a rare path where FileReader failed AND
    // canvas thumbnailing failed) we still try the objectURL as a
    // last resort — that URL may have been revoked but the
    // <img> error event will catch and the recovery surface fires.
    const safeImageUrl = imageBase64 || thumbnail || imageUrl || null;
    if (!safeImageUrl) {
      _scanInflightRef.current = false;
      setError(tSafe(
        'scan.error.image_invalid',
        'Photo could not be loaded. Please choose the photo again.',
      ));
      setPhase('error');
      try { trackEvent('scan_failed', { reason: 'no_safe_image_url' }); }
      catch { /* swallow */ }
      return;
    }
    setPhase('analyzing');
    setPendingThumbnail(thumbnail || null);
    setAnalyzingImageUrl(safeImageUrl);
    setAnalyzingFocusContext(focusContext || null);
    // V5 — mirror the preview into the session manager so the
    // debug overlay shows `previewStatus: ready` + `localUri`.
    try {
      updateSession(_localSessionId, {
        lifecycle:     LIFECYCLE_STATE.AI_PROCESSING,
        localUri:      safeImageUrl,
        normalizedUri: imageBase64 || '',
        previewStatus: 'ready',
        aiStatus:      'processing',
      });
    } catch { /* never block analysis on bookkeeping */ }
    try {
      emitScanEvent(SCAN_EVENTS.PREVIEW_READY, { sessionId: _localSessionId,
        previewLen: safeImageUrl ? safeImageUrl.length : 0 });
      emitScanEvent(SCAN_EVENTS.AI_REQUEST_STARTED, { sessionId: _localSessionId });
    } catch { /* swallow */ }
    // §7 — production pipeline trace. Dev-only via _devLog
    // would tree-shake; we keep this production-visible for ops
    // diagnostics. Fires once per scan.
    try {
       
      console.log('[FARROWAY_SCAN_PIPELINE] imageCaptured', {
        hasBase64:    !!imageBase64,
        hasThumbnail: !!thumbnail,
        hasFile:      !!file,
        fileSize:     file && file.size || null,
        previewSource: thumbnail ? 'thumbnail' : (imageBase64 ? 'base64' : 'object_url'),
      });
    } catch { /* swallow */ }
    try {
      try { trackEvent('scan_photo_taken', { experience, hasFile: !!file }); }
      catch { /* ignore */ }
      // Data Moat Layer \u00a78 \u2014 spec-shaped scan_started event.
      // Fires alongside the legacy scan_photo_taken so existing
      // dashboards keep working AND eventStore picks the
      // canonical event up. The moat service enriches the
      // payload with active context + weather summary; we add
      // the event-specific bits (hasFile flag).
      try { moatTrack('scan_started', { hasFile: !!file }); }
      catch { /* ignore */ }

      // Scan Pipeline Audit §4 — staged timeout messaging.
      // The prior 2s hard-fallback was too aggressive: users saw
      // a rule-based result flash on screen and then watched it
      // get overwritten when the real analysis landed a beat
      // later. New staging:
      //   0-5s   "Analyzing crop"         (default spinner copy)
      //   5-15s  "Still checking your crop" (escalation message)
      //   15s+   real fallback hybrid result + retry surface
      // The escalation messages are state flags read by
      // ScanAnalyzing for the spinner caption. Only the 15s
      // hard-stop triggers the rule-based fallback verdict.
      let fallbackTimer = null;
      let fallbackShown = false;
      let escalationTimer = null;
      try {
        escalationTimer = setTimeout(() => {
          try { setAnalyzingEscalation('still_checking'); }
          catch { /* swallow */ }
        }, 5000);
      } catch { /* swallow */ }
      try {
        fallbackTimer = setTimeout(() => {
          if (fallbackShown) return;
          fallbackShown = true;
          try {
            const fallbackHybrid = hybridAnalyze({
              imageResult:      { possibleIssue: '', confidence: 'low' },
              plantName:        profile?.plantName || null,
              cropName:         profile?.crop || profile?.cropId || null,
              activeExperience,
              country:          profile?.country || null,
              region:           profile?.region  || null,
              sizeSqFt:         profile?.landSizeSqFt || profile?.farmSize || null,
              growingSetup:     profile?.growingSetup || null,
            });
            // Scan Pipeline Enforcement — drop if the user has
            // already moved on (retake / cancel / new scan).
            if (isStaleScanSession(_localSessionId)) return;
            setResult({
              scanId:             'scan_fb_' + Date.now().toString(36),
              // Stale-closure fix — see the main publish path
              // comment below. Use the LOCAL safeImageUrl +
              // thumbnail (closed over by this setTimeout but
              // computed fresh PER onContinue call), not the
              // React state vars that were null at closure
              // creation time.
              imageUrl:           safeImageUrl || null,
              thumbnail:          thumbnail || safeImageUrl || null,
              possibleIssue:      fallbackHybrid.possibleIssue,
              confidence:         fallbackHybrid.confidence,
              recommendedActions: fallbackHybrid.recommendedActions,
              suggestedTasks:     fallbackHybrid.followUpTask
                                    ? [fallbackHybrid.followUpTask]
                                    : [],
              hybridReason:       fallbackHybrid.reason,
              hybridUrgency:      fallbackHybrid.urgency,
              hybridContext:      fallbackHybrid.contextType,
              disclaimer:         fallbackHybrid.disclaimer,
              meta:               { source: 'fallback_15s_timer' },
            });
            setPhase('result');
            try { trackEvent('scan_fallback_used', { reason: '15s_timeout' }); }
            catch { /* swallow */ }
          } catch { /* swallow — wait for the real result */ }
        }, 15000);
      } catch { /* swallow */ }

      // Pre-fetch the weather snapshot so the backend's context
      // fusion engine layers environmental signals on top of the
      // image-only inference (raises confidence when image +
      // weather agree, lowers it when they conflict). Same cache
      // the hybridAnalyze call below uses — single read shared
      // across both pipelines.
      let weatherForBackend = null;
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage?.getItem('farroway_weather_cache');
          if (raw) weatherForBackend = JSON.parse(raw);
        }
      } catch { /* swallow — backend treats null as no-weather */ }

      // Phase 11 — when leaf isolation succeeded, prefer the
      // isolated-leaf crop as the AI input. Backgrounds bias the
      // classifier toward "low confidence / hard to read"; an
      // isolated leaf cuts that noise. Falls through to the
      // normalized base64 when isolation failed.
      const aiImageBase64 = (focusContext && focusContext.ok
        && focusContext.isolatedLeafDataUrl)
        ? focusContext.isolatedLeafDataUrl
        : imageBase64;

      // Routed through canonical ScanRuntime. Stage classifier
      // inputs in the stable ref the classifier closures over,
      // then call rt.choosePhoto() + rt.analyzeImage() so the
      // spec contracts (assertValidScanInput, validateScanResult,
      // isLowConfidenceAllowed) all run before any setResult.
      let _weatherSnapshotForHybrid = null;
      try {
        if (typeof window !== 'undefined') {
          const _w = window.localStorage?.getItem('farroway_weather_cache');
          if (_w) _weatherSnapshotForHybrid = JSON.parse(_w);
        }
      } catch { /* swallow */ }
      _classifierInputRef.current = {
        imageBase64,
        aiImageBase64,
        imageUrl,
        cropId:           profile?.crop || profile?.cropId || null,
        cropName:         profile?.crop || profile?.cropId || null,
        plantName:        profile?.plantName || null,
        country:          profile?.country || null,
        region:           profile?.region  || null,
        experience,
        activeExperience: activeExperience,
        weather:          weatherForBackend,
        weatherSnapshot:  _weatherSnapshotForHybrid,
        focusContext:     focusContext || null,
        lesionCropBase64: (focusContext && focusContext.lesionCropDataUrl) || null,
        landSizeSqFt:     profile?.landSizeSqFt || profile?.farmSize || null,
        growingSetup:     profile?.growingSetup || null,
        mlScanOn,
      };
      try {
        await _scanRuntime.choosePhoto({
          size: (file && file.size) || (imageBase64 ? imageBase64.length : 1024),
          type: (file && file.type) || 'image/jpeg',
          dataUrl: imageBase64 || imageUrl || null,
          _id: _localSessionId,
        });
      } catch { /* runtime sets RECOVERABLE_ERROR internally */ }
      const _runtimeAnalyzeResult = await _scanRuntime.analyzeImage();
      if (!_runtimeAnalyzeResult || !_runtimeAnalyzeResult.ok) {
        throw new Error('scan_runtime_reject:'
          + ((_runtimeAnalyzeResult && _runtimeAnalyzeResult.reason) || 'unknown'));
      }
      // The runtime applied the classifier (which wraps
      // analyzeScan + hybridAnalyze + analyzeImageSafe) and ran
      // validateScanResult on the envelope. We read the validated
      // envelope from the runtime — all legacy fields are
      // preserved + the spec §12 fields are added.
      const out = _scanRuntime.getResult() || {};
      // Real result back — cancel the fallback timer if it
      // hasn't fired yet. If it HAS, the refinedOut below
      // overwrites the fallback in one render so the user sees
      // the better result without a flicker.
      if (fallbackTimer)   clearTimeout(fallbackTimer);
      if (escalationTimer) clearTimeout(escalationTimer);
      try { setAnalyzingEscalation(null); } catch { /* swallow */ }

      // Hybrid refinement: layer active experience + weather +
      // region on top of the image-only verdict. The hybrid
      // result keeps the same shape callers already render
      // (possibleIssue / confidence / recommendedActions) so
      // ScanResultCard doesn't change. We merge the hybrid
      // fields onto the engine output and keep the original
      // engine fields (suggestedTasks, meta) intact. The
      // hybrid engine never throws — failure falls through to
      // the unrefined image-only result.
      // ScanRuntime classifier already applied hybrid + ML
      // augmentation. `out` IS the validated, refined envelope.
      // The legacy inline block below is preserved temporarily for
      // diffability — gated behind `false` so it never executes,
      // and `refinedOut` is set from `out` directly. Next migration
      // pass will delete the dead branch entirely.
      let refinedOut = out;
      // eslint-disable-next-line no-constant-condition
      if (false) try {
        let weatherSnapshot = null;
        try {
          // Lazy import to avoid coupling ScanPage to the
          // weather context's lifecycle. Read the cached
          // value if WeatherContext has populated it.
          if (typeof window !== 'undefined') {
            const raw = window.localStorage?.getItem('farroway_weather_cache');
            if (raw) weatherSnapshot = JSON.parse(raw);
          }
        } catch { /* swallow */ }

        const hybrid = hybridAnalyze({
          imageResult:      out,
          plantName:        profile?.plantName || null,
          cropName:         profile?.crop || profile?.cropId || null,
          activeExperience: activeExperience,
          country:          profile?.country || null,
          region:           profile?.region  || null,
          weather:          weatherSnapshot,
          // Land Intelligence input \u2014 drives the scale-aware
          // action enrichment inside hybridAnalyze.
          sizeSqFt:         profile?.landSizeSqFt || profile?.farmSize || null,
          // Backyard growing-setup spec \u00a76 \u2014 garden users get
          // setup-specific scan actions (pot drainage, bed
          // airflow, ground weeds). Ignored for farm experience.
          growingSetup:     profile?.growingSetup || null,
        });

        // Merge: hybrid wins on the user-visible fields, engine
        // fields like meta + scanId + suggestedTasks survive.
        refinedOut = {
          ...out,
          possibleIssue:      hybrid.possibleIssue,
          confidence:         hybrid.confidence,
          recommendedActions: hybrid.recommendedActions,
          // Preserve engine suggestedTasks (used by Add to
          // Today's Plan) and prepend the hybrid follow-up so
          // there's always at least one action even on the
          // unclear-image branch.
          suggestedTasks: (() => {
            const existing = Array.isArray(out?.suggestedTasks) ? out.suggestedTasks : [];
            const seen = new Set(existing.map((t) => String(t?.title || '').toLowerCase()));
            const followUp = hybrid.followUpTask;
            if (followUp && !seen.has(String(followUp.title || '').toLowerCase())) {
              return [followUp, ...existing].slice(0, 2);
            }
            return existing.slice(0, 2);
          })(),
          // New hybrid-only fields the result card can render.
          hybridReason:    hybrid.reason,
          hybridUrgency:   hybrid.urgency,
          hybridContext:   hybrid.contextType,
          disclaimer:      hybrid.disclaimer,
        };
        try {
          trackEvent('scan_hybrid_applied', {
            issue:      hybrid.possibleIssue,
            confidence: hybrid.confidence,
            context:    hybrid.contextType,
            urgency:    hybrid.urgency,
          });
        } catch { /* ignore */ }
      } catch { /* hybrid disabled — fall through to engine output */ }

      // Phase 7E — ML scan safe mode. Now applied INSIDE the
      // classifier (which the runtime invoked). The `if (mlScanOn)`
      // shim below is gated to `false` so analyzeImageSafe is not
      // called a second time directly from ScanPage. The runtime's
      // result envelope already carries category / mlStatus / mlLabel
      // when mlScanOn was true. Next migration pass deletes this branch.
      // eslint-disable-next-line no-constant-condition
      if (false && mlScanOn) {
        try {
          const mlResult = analyzeImageSafe({
            cropId:      profile?.crop || profile?.cropId || null,
            plantName:   profile?.plantName || null,
            experience,
            imageBase64, // accepted but not analyzed (no model)
          });
          refinedOut = {
            ...refinedOut,
            category:  mlResult.category,
            mlStatus:  mlResult.status,
            mlLabel:   mlResult.label,
            // `message` is the primary cautious observation text.
            // Prefer an existing API explanation when it exists so
            // the real ML response wins over the placeholder copy.
            message:   refinedOut.message || mlResult.message,
          };
        } catch { /* analyzeImageSafe should not throw, but guard */ }
      }

      // Ensure the user's captured photo always survives onto the
      // result card. The analyzer's `imageUrl` (if present) wins;
      // otherwise we attach the cached analyzingImageUrl. Same for
      // thumbnail. Without this thread-through, UsefulResultCard
      // saw `result.imageUrl === undefined` and rendered the macro
      // stock photo — the "broken/wrong preview" bug.
      //
      // Scan Pipeline Enforcement — drop if the user has already
      // moved on while we were awaiting the classifier.
      if (isStaleScanSession(_localSessionId)) return;
      try { emitScanEvent(SCAN_EVENTS.AI_RESPONSE_RECEIVED, {
        sessionId: _localSessionId,
        confidence: refinedOut?.confidence || null,
        source: out?.meta?.source || null,
      }); } catch { /* swallow */ }
      // CRITICAL: read from the LOCAL `safeImageUrl` + `thumbnail`
      // (function-scope) — not from the React state vars. The
      // onContinue callback's dep array is [experience,
      // activeExperience, profile], so it captures the INITIAL
      // null values of analyzingImageUrl + pendingThumbnail and
      // never sees the post-setAnalyzingImageUrl values within
      // the same call. That's the "preview disappears but
      // result still renders" bug the user reported — every
      // first-scan path produced `result.imageUrl = null` and
      // UsefulResultCard's recovery banner fired.
      setResult({
        ...refinedOut,
        imageUrl:  refinedOut.imageUrl  || safeImageUrl || null,
        thumbnail: refinedOut.thumbnail || thumbnail    || safeImageUrl || null,
      });
      setPhase('result');
      try { emitScanEvent(SCAN_EVENTS.RESULT_RENDERED, {
        sessionId: _localSessionId,
        confidence: refinedOut?.confidence || null,
      }); } catch { /* swallow */ }
      try { trackEvent('scan_analyzed', { experience, source: out?.meta?.source, confidence: out?.confidence }); }
      catch { /* ignore */ }
      // Data Moat Layer \u00a78 \u2014 spec-shaped scan_completed event.
      // Carries the issue type / confidence so the
      // insightAggregator can surface "common issues by region".
      // We also write a `farroway_last_scan_issue` ISO timestamp
      // when the scan flagged something so the dailyPlanEngine's
      // "recent scan issue" risk path picks it up.
      try {
        const issueType = refinedOut?.label
                       || refinedOut?.disease
                       || refinedOut?.diagnosis
                       || null;
        moatTrack('scan_completed', {
          issueType,
          confidence: refinedOut?.confidence || null,
          source:     refinedOut?.meta?.source || null,
        });
        if (issueType
            && typeof localStorage !== 'undefined'
            && refinedOut?.urgency
            && refinedOut.urgency !== 'low') {
          try { localStorage.setItem('farroway_last_scan_issue', new Date().toISOString()); }
          catch { /* swallow */ }
        }
      } catch { /* ignore */ }
    } catch (err) {
      try { emitScanEvent(SCAN_EVENTS.AI_REQUEST_FAILED, {
        sessionId: _localSessionId,
        reason: (err && err.message) ? String(err.message).slice(0, 200) : 'exception',
      }); } catch { /* swallow */ }
      // §10 offline-first: when we have the captured image AND the
      // failure looks plausibly network-related (or we're explicitly
      // offline), stash the scan so a future retry can run it
      // through the real ML once the network is back. We enqueue
      // EAGERLY here — even when mlScan's fallback path takes over
      // below — because the user paid the cost of taking the photo
      // and deserves the better verdict eventually.
      try {
        const msg = String((err && err.message) || '').toLowerCase();
        const looksNetworky = !isLikelyOnline()
          || msg.includes('network')
          || msg.includes('fetch')
          || msg.includes('timeout')
          || msg.includes('failed to fetch')
          || msg.includes('offline');
        if (looksNetworky && imageBase64) {
          enqueueScan({
            imageBase64,
            cropName:   profile?.crop || profile?.cropId || null,
            region:     profile?.region || null,
            experience: activeExperience,
          });
          try { moatTrack('scan_queued_offline', { reason: msg || 'offline' }); }
          catch { /* swallow */ }
        }
      } catch { /* never propagate from the queue path */ }

      // Phase 7E — ML scan safe mode: when mlScan is on, a failed
      // analysis does NOT crash to an error screen. Instead we show
      // a needs_review result with "Photo saved. Review needed." so
      // the user always leaves with an actionable message and the
      // photo can still be saved to history.
      if (mlScanOn) {
        try {
          // Scan Pipeline Enforcement — drop if the user has
          // already moved on while we were on the ML-failure path.
          if (isStaleScanSession(_localSessionId)) return;
          setResult({
            scanId:             'scan_mlf_' + Date.now().toString(36),
            // Stale-closure fix — same root cause as the main
            // publish path. Use the LOCAL safeImageUrl/thumbnail
            // (function-scope, always fresh) instead of React state.
            // This is the screenshot the user reported: ML failure
            // → Needs Review verdict → empty preview rectangle.
            imageUrl:           safeImageUrl || null,
            thumbnail:          thumbnail || safeImageUrl || null,
            possibleIssue:      'Needs Review',
            category:           ML_CATEGORIES.NEEDS_REVIEW,
            mlStatus:           ML_CATEGORIES.NEEDS_REVIEW,
            mlLabel:            'Needs Review',
            confidence:         'low',
            message:            CATEGORY_MESSAGES.needs_review,
            recommendedActions: ['Share with a local agronomist for a closer look.'],
            suggestedTasks:     [],
            shouldSeekHelp:     false,
            safetyWarning:      null,
            meta:               { source: 'ml_failure_fallback' },
          });
          setPhase('result');
          try { moatTrack('scan_failed', { reason: 'ml_failure_fallback' }); }
          catch { /* ignore */ }
        } catch {
          // If even the fallback result fails, fall through to error state.
          setError(tStrict('scan.error.analyze', 'We could not analyze that photo. Try again.'));
          setPhase('error');
        }
      } else {
        setError(tStrict(
          'scan.error.analyze',
          'We could not analyze that photo. Try again.'
        ));
        setPhase('error');
        // Data Moat Layer \u00a78 \u2014 scan_failed routes through the
        // moat service (which mirrors to analyticsStore so the
        // legacy admin "scan failures" dashboard stays in sync).
        // Direct analyticsStore.trackEvent removed to avoid a
        // double-fire.
        try { moatTrack('scan_failed', { reason: err && err.message }); }
        catch { /* ignore */ }
      }
    } finally {
      // §6 — always release the inflight guard so a subsequent
      // tap (after the result lands OR after the error surface
      // shows) can fire a fresh scan. Without this, a network
      // failure would leave the guard set and Retry would be a
      // no-op until page refresh.
      _scanInflightRef.current = false;
    }
  }, [experience, activeExperience, profile]);

  const onRetake = useCallback(() => {
    // End the active scan session so any in-flight async result
    // from the previous attempt fails its isStaleScanSession check
    // and gets dropped. Starting a fresh capture in onContinue
    // bumps the session id again. V5 — endSession() also wipes the
    // persisted session record + bumps the wide race guard.
    try {
      emitScanEvent(SCAN_EVENTS.SCAN_CANCELLED, {
        sessionId: _sessionRef.current || null,
        reason: 'retake',
      });
    } catch { /* swallow */ }
    try { endScanSessionV5(); } catch { /* swallow */ }
    try { endScanSession(); } catch { /* swallow */ }
    _sessionRef.current = null;
    setError('');
    setResult(null);
    setAddPlantNotice('');
    setSavedEntryId(null);
    setTasksAdded(false);
    setPendingThumbnail(null);
    setAnalyzingImageUrl(null);
    setAnalyzingFocusContext(null);
    setPhase('capture');
  }, []);

  const onSave = useCallback(() => {
    if (!result) return;
    try {
      // Runtime Authority Cleanup — Journal save is funneled
      // through scanPersistenceBridge instead of direct
      // saveScanEntry/saveScanUseful calls. The bridge enforces
      // the "failed images never persist" guard and gives us a
      // single place to add ScanRuntime telemetry later.
      const isGarden = activeExperience === 'garden';
      const journalResult = persistScanToJournal(result, {
        gardenId:  isGarden ? (activeGardenId || profile?.id || null) : null,
        farmId:    !isGarden ? (activeFarmId   || profile?.id || null) : null,
        cropId:    profile?.crop || profile?.cropId || null,
        plantName: profile?.plantName || null,
        thumbnail: pendingThumbnail,
        experience: activeExperience,
        language:  null,
      });
      const entry = journalResult.entry;
      setSavedEntryId(entry?.id || null);
      if (FEATURE_SCAN_USEFULNESS) {
        persistScanUseful(result, {
          experience: activeExperience,
          thumbnail:  pendingThumbnail,
        });
      }
      try { trackEvent('scan_saved', {
        id: entry?.id,
        experience: activeExperience,
        contextType: isGarden ? 'garden' : 'farm',
      }); }
      catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [result, profile, activeExperience, activeGardenId, activeFarmId, pendingThumbnail]);

  // FEATURE_SCAN_USEFULNESS: called by UsefulResultCard when the
  // follow-up task button is tapped. Stamps the entry in the
  // lightweight history so the history row shows a ✅ dot.
  const onUsefulTaskAdded = useCallback(() => {
    if (!result) return;
    setTasksAdded(true);
    if (FEATURE_SCAN_USEFULNESS && result.scanId) {
      // Funneled through the bridge — see scanPersistenceBridge.
      markScanTaskAdded(result.scanId);
    }
  }, [result]);

  const onAddTasks = useCallback(() => {
    if (!result) return;
    try {
      // Spec \u00a79 + high-trust scan output \u00a77: tasks attach to
      // gardenId OR farmId based on activeExperience so garden +
      // farm Today's Plans stay isolated. Same-day duplicates
      // are rejected inside addScanTasks.
      //
      // The canonical "Check this again tomorrow" follow-up
      // task comes from scanResultPolicy.followUpTaskFor so the
      // wording is identical to what the result card showed
      // under the Follow-up block. addScanTasks persists up to
      // 2 immediate action tasks PLUS the follow-up (3 total).
      const isGarden = activeExperience === 'garden';
      const followUpTask = followUpTaskFor(
        isGarden ? 'garden' : 'farm',
        profile?.plantName || profile?.crop || profile?.cropId || null,
      );
      const sanitisedSuggested = Array.isArray(result.suggestedTasks)
        ? result.suggestedTasks.map((t) => ({
            ...t,
            title:  sanitizeScanText(String(t?.title || '')),
            reason: sanitizeScanText(String(t?.reason || '')),
          })).filter((t) => t.title)
        : [];
      // Funneled through scanPersistenceBridge so the
      // "no orphan tasks without a scanId" guard applies.
      const taskResult = createScanFollowUpTasks(sanitisedSuggested, {
        scanId:    result.scanId,
        gardenId:  isGarden ? (activeGardenId || profile?.id || null) : null,
        farmId:    !isGarden ? (activeFarmId   || profile?.id || null) : null,
        experience: activeExperience,
        followUpTask,
      });
      const stored = taskResult.stored || [];
      if (stored.length > 0) setTasksAdded(true);
      try { trackEvent('scan_task_created', {
        scanId: result.scanId,
        count: stored.length,
        followUpAdded: stored.some((t) => t.isFollowUp),
        contextType: isGarden ? 'garden' : 'farm',
      }); }
      catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [result, profile, activeExperience, activeGardenId, activeFarmId]);

  const onAsk = useCallback(() => {
    try { trackEvent('scan_help_clicked', { scanId: result?.scanId }); }
    catch { /* ignore */ }
    try { navigate('/today'); } catch { /* ignore */ }
  }, [navigate, result]);

  if (!flagOn) return null;

  // Phase 4 restore (2026-05-04): crop guard removed — scan is
  // accessible without a farm or crop. The analysis engine handles
  // null cropId gracefully (getRuleBasedFallback returns conservative
  // guidance). Setup is optional per the routing fix spec.

  // 3-second timeout fallback — replaces the live page when the
  // mount path stalls beyond the safety ceiling. Retry button
  // reloads (giving the lazy chunks another chance); Upload
  // photo opens a system file picker as a last-resort path.
  //
  // Deep Deploy Audit fix — use the accurate `page_loading`
  // reason instead of the camera-blaming `timeout`. The mount
  // stall is NOT a camera failure; it's a chunk-load / React
  // boot stall. Wording reflects that honestly.
  if (loadTimedOut) {
    return <ScanFallback reason="page_loading" />;
  }

  // Initial-mount loading state — "Preparing camera…" so the
  // user never sees a blank screen during the first paint.
  if (!mounted) {
    // Real-device root-cause fix \u2014 emit data-testid="scan-capture"
    // on the mount spinner so __scanStartupHealth() flips
    // componentMounted=true the moment ScanPage's React tree
    // renders ANYTHING. Without this, the banner waited for
    // ScanCapture to render, but on iPhone Safari ScanCapture is
    // gated behind the `mounted` flag \u2014 which left the runtime
    // stuck reporting componentMounted:false.
    return (
      <main
        style={STYLES.page}
        data-screen="scan-page"
        data-phase="loading"
        data-testid="scan-capture"
      >
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#667085',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid rgba(36,49,58,0.10)',
            borderTopColor: '#C8944D',
            animation: 'farroway-spin 0.8s linear infinite',
          }} />
          <span>{tStrict('scan.page.loading', 'Preparing scan\u2026')}</span>
        </div>
      </main>
    );
  }

  const isBackyard = experience === 'backyard';
  const headerTitle = isBackyard
    ? tStrict('scan.page.title.backyard', 'Take Plant Photo')
    : tStrict('scan.page.title.farm', 'Scan Crop');
  const headerSubtitle = isBackyard
    ? tStrict('scan.page.subtitle.backyard', 'Photograph the plant or leaf and we\u2019ll suggest possible issues.')
    : tStrict('scan.page.subtitle.farm', 'Photograph the affected area and we\u2019ll suggest possible issues.');

  // RC1 fix \u2014 idle landing. Default phase is 'idle' so the user
  // sees ScanEntryCard ("Scan your crop" + Take photo / Use saved
  // photo) on first mount. Camera does NOT start until the user
  // taps Take photo. The hidden file input below is triggered by
  // the Use-saved-photo button.
  const _handleTakePhoto = () => {
    // scan-idle-entry-v3: both flags MUST be true for ScanFallback
    // to be allowed to render its camera-error card. We set them
    // here, where the user has explicitly tapped Take photo —
    // not earlier.
    setCameraAttempted(true);
    setUserInitiatedCamera(true);
    setPhase('capture');
  };
  const _handleUseSavedPhoto = () => {
    try {
      if (entryGalleryInputRef.current) entryGalleryInputRef.current.click();
    } catch { /* never block \u2014 picker is best-effort */ }
  };
  const _handleEntryFilePicked = async (ev) => {
    try {
      const file = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!file) return;
      // Reuse ScanCapture's full pipeline by switching phase to
      // 'capture' and forwarding the file via the existing
      // onContinue contract. The base64 encoding + thumbnail are
      // produced inline so we never need to mount the camera.
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e && e.target && e.target.result;
        if (typeof dataUrl !== 'string') return;
        const base64 = dataUrl.split(',')[1] || '';
        await onContinue({
          imageBase64: base64,
          imageUrl:    dataUrl,
          thumbnail:   dataUrl,
          file,
          focusContext: null,
        });
      };
      reader.readAsDataURL(file);
    } catch { /* swallow \u2014 entry path stays calm on any error */ }
    finally {
      try { if (ev && ev.target) ev.target.value = ''; } catch { /* ignore */ }
    }
  };
  if (phase === 'idle' && flagOn) {
    return (
      <>
        <ScanHub
          onTakePhoto={_handleTakePhoto}
          onUploadPhoto={_handleUseSavedPhoto}
        />
        <input
          ref={entryGalleryInputRef}
          type="file"
          accept="image/*"
          onChange={_handleEntryFilePicked}
          style={{ display: 'none' }}
          data-testid="scan-entry-gallery-input"
        />
      </>
    );
  }

  // Single-interface scan fix: when phase === 'capture' AND the
  // browser can open the live camera, /scan renders ONLY the
  // ScanCapture component (which is itself a Fragment hosting the
  // LiveCameraScanner overlay). No PremiumPage wrap, no hero, no
  // capability chips \u2014 the user sees exactly one surface: the
  // fullscreen camera. All other phases (analyzing, result, error)
  // and the camera-unsupported fallback fall through to the
  // standard chrome below.
  if (phase === 'capture' && _scanSupportsLiveCamera()) {
    return <ScanCapture experience={experience} onContinue={onContinue} />;
  }

  return (
    <PremiumPage
      mode={isBackyard ? 'garden' : 'farm'}
      testId="scan-page"
      maxWidth="36rem"
      bottomPad="2rem"
    >
      {/* ── Hero — technical / diagnostic identity ────────────
           Scan reads as the technical AI camera surface. The
           macro leaf photo (healthy-leaf) is the right
           identity — clinical, biological, scientific feel.
           Phase-specific cards below own the capture/analyze
           flow; this hero anchors the diagnostic atmosphere. */}
      <PremiumPageHero
        mode={isBackyard ? 'garden' : 'farm'}
        eyebrow={tStrict('premium.eyebrow.scan', 'Scan')}
        title={headerTitle}
        subtitle={headerSubtitle}
        bgImage={resolveRealismImage(REALISM_ASSETS.scan.healthy)}
        accent="green"
        testId="scan-page-hero"
      />

      {phase === 'capture' ? (
        <>
          <ScanCapture experience={experience} onContinue={onContinue} />
          <ScanCaptureUpgrade testId="scan-capture-upgrade" />
        </>
      ) : null}

      {phase === 'analyzing' ? (
        <ScanAnalyzing
          imageUrl={analyzingImageUrl}
          experience={experience}
          escalation={analyzingEscalation}
          focusContext={analyzingFocusContext}
          onCancel={onRetake}
        />
      ) : null}

      {/* Wave-26 C-4 — single result card. shouldRenderIntelligentResult()
          is the canonical gate. When true, IntelligentScanResult is the
          sole rendered result surface; when false the legacy
          UsefulResultCard / ScanResultCard path below renders instead.
          The two branches are mutually exclusive — never both. */}
      {phase === 'result' && result && shouldRenderIntelligentResult() ? (
        <IntelligentScanResult
          result={result}
          onRetake={onRetake}
          onChoose={_handleUseSavedPhoto}
        />
      ) : null}

      {phase === 'result' && result && !shouldRenderIntelligentResult() ? (
        FEATURE_SCAN_USEFULNESS ? (
          // FEATURE_SCAN_USEFULNESS — clean farmer-friendly card.
          // saveScanUseful is idempotent (same scanId → no-op).
          // §3: thumbnail passthrough mirrors the auto-save path
          // above so both code paths produce the same enriched entry.
          (() => {
            // Funneled through bridge — see scanPersistenceBridge.
            persistScanUseful(result, {
              experience: activeExperience,
              thumbnail:  pendingThumbnail,
            });
            return (
              <UsefulResultCard
                result={result}
                experience={activeExperience}
                onRetake={onRetake}
                onTaskAdded={onUsefulTaskAdded}
              />
            );
          })()
        ) : (
          <>
            <ScanResultCard
              result={result}
              experience={experience}
              onRetake={onRetake}
              onAsk={onAsk}
              onAddTasks={onAddTasks}
              onSave={onSave}
              alreadySaved={!!savedEntryId}
              alreadyAddedTasks={tasksAdded}
            />
            {Array.isArray(result.verificationQuestions) && result.verificationQuestions.length > 0 ? (
              <ScanVerificationChecklist
                scanId={result.scanId || null}
                questions={result.verificationQuestions}
              />
            ) : null}
            <ScanLocalExpertCTA
              confidence={result.confidence}
              issue={result.possibleIssue}
              spreadFast={result.spreadFast || false}
              cropName={result.cropName || profile?.crop || profile?.cropId || null}
            />
            <TreatmentGuidanceCard
              issue={result.possibleIssue}
              confidence={result.confidence}
              activeExperience={activeExperience}
              country={profile?.country || null}
              region={profile?.region  || null}
              cropName={result.cropName || profile?.crop || profile?.cropId || null}
              plantName={profile?.plantName || null}
              scaleType={result.scaleType  || null}
              repeatedIssue={false}
              weather={null}
              onAddToPlan={(actions) => {
                if (!Array.isArray(actions) || actions.length === 0) return;
                try {
                  const adapted = actions.map((title, i) => ({
                    id:         'treatment_' + i + '_' + Date.now().toString(36),
                    title:      sanitizeScanText(String(title || '')),
                    reason:     '',
                    urgency:    'medium',
                    actionType: 'treatment',
                  })).filter((t) => t.title);
                  if (result && Array.isArray(result.suggestedTasks)) {
                     
                    result.suggestedTasks = [...adapted, ...result.suggestedTasks];
                  } else if (result) {
                     
                    result.suggestedTasks = adapted;
                  }
                  onAddTasks();
                } catch { /* swallow */ }
              }}
              alreadyAddedTasks={tasksAdded}
            />
            <ScanFeedbackPrompt scanId={result.scanId || null} />
          </>
        )
      ) : null}

      {/* Gap-fix sprint §2 — Add-to-My-Plants confirmation card.
          Renders ONLY after a successful result. No auto-create.
          The wave-5 single-writer (UI layer) persists via
          farroway_managed_plants; engines never write storage. */}
      {/* Wave-31 H4 — inline notice for the Add-to-My-Plants
          result. Renders only when the workflow has produced a
          decision; clears on re-scan via the result-reset effect.
          Pure composition; uses existing PremiumPage chrome. */}
      {phase === 'result' && result && addPlantNotice ? (
        (() => {
          const isIneligible = addPlantNotice.startsWith('ineligible:');
          const reason = isIneligible ? addPlantNotice.slice('ineligible:'.length) : '';
          const isAdded = addPlantNotice === 'added';
          const isAlready = addPlantNotice === 'already-managed';
          const bg = isAdded ? 'rgba(34,197,94,0.10)'
                   : isAlready ? 'rgba(14,165,233,0.10)'
                   : 'rgba(245,158,11,0.10)';
          const border = isAdded ? 'rgba(34,197,94,0.32)'
                       : isAlready ? 'rgba(14,165,233,0.32)'
                       : 'rgba(245,158,11,0.32)';
          const tone = isAdded ? '#86EFAC'
                     : isAlready ? '#7DD3FC'
                     : '#FDE68A';
          const message = isAdded
            ? tStrict('scan.addPlant.success',
                      'Plant added to My Plants.')
            : isAlready
            ? tStrict('scan.addPlant.already',
                      'Already in My Plants — opened your plant.')
            : reason === 'plant_not_in_catalog'
              ? tStrict('scan.addPlant.notInCatalog',
                  'We don’t recognize this plant yet — the scan was saved to your history. Once we add this plant we’ll surface it on the plant page.')
              : tStrict('scan.addPlant.couldNotAdd',
                  'Could not add this plant right now — the scan was saved to your history.');
          return (
            <div data-testid="scan-add-plant-notice"
                 data-notice-kind={addPlantNotice}
                 style={{
                   background: bg, border: `1px solid ${border}`,
                   borderRadius: 12, padding: '10px 14px',
                   color: '#EAF2FF', fontSize: 13.5, lineHeight: 1.45,
                   display: 'flex', alignItems: 'center', gap: 10,
                 }}>
              <span style={{ display: 'inline-block', width: 8,
                             height: 8, borderRadius: '50%',
                             background: tone, flexShrink: 0 }} />
              <span>{message}</span>
            </div>
          );
        })()
      ) : null}

      {phase === 'result' && result ? (
        <AddPlantConfirmationCard
          scanResult={result}
          onAdd={(sr) => {
            try {
              // Gap-fix blocker 3 — managed-plant persistence
              // routes through managedPlantsStore so quota /
              // private-mode / corrupt-JSON degrade silently.
              // ScanPage just reads + appends; the store handles
              // the storage edge cases.
              const wf = _scanToManagedPlant({
                scanResult: sr,
                ownerId:    profile?.id || profile?.userId || '',
                farmId:     activeFarmId || profile?.farmId || '',
                gardenId:   activeGardenId || profile?.gardenId || '',
                location:   { regionLabel: profile?.region || '' },
                existingPlants: _loadManagedPlants(),
              });
              if (!wf || !wf.eligible) {
                // Wave-31 H4 — surface the failure inline instead
                // of silently returning. Reason values from the
                // scanToManagedPlant workflow include
                // 'plant_not_in_catalog' | 'missing_data' | etc.
                // Pass through so the notice copy can be specific.
                const reason = (wf && wf.reason) || 'unknown';
                setAddPlantNotice(`ineligible:${reason}`);
                try { trackEvent('plant_add_ineligible', { reason }); }
                catch { /* ignore */ }
                return;
              }
              if (wf.alreadyManaged && wf.route) {
                setAddPlantNotice('already-managed');
                try { navigate(wf.route); }
                catch { /* ignore */ }
                return;
              }
              const plant = wf.plant;
              if (!plant) return;
              _appendManagedPlant(plant);
              setAddPlantNotice('added');
              try { trackEvent('plant_created_from_scan',
                { plantId: plant.id, scanId: sr?.scanId || null }); }
              catch { /* ignore */ }
              if (wf.route) {
                try { navigate(wf.route); } catch { /* ignore */ }
              }
            } catch { /* never crash the scan page */ }
          }}
          onScanAgain={onRetake}
          onSaveForReview={() => {
            try { trackEvent('plant_save_for_review',
              { scanId: result?.scanId || null }); }
            catch { /* ignore */ }
            // Critical fix: actually persist the scan to the
            // farmer's journal so "Save for review" is not a
            // misleading no-op. onSave funnels through
            // scanPersistenceBridge (journal + useful history).
            try { onSave(); } catch { /* never crash */ }
          }}
        />
      ) : null}

      {phase === 'error' ? (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(239,68,68,0.14)',
          border: '1px solid rgba(239,68,68,0.35)',
          color: '#FCA5A5',
          fontSize: 14,
        }}>
          {error || tStrict('scan.error.generic', 'Something went wrong. Try again.')}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={onRetake}
              style={{
                appearance: 'none',
                border: '1px solid rgba(239,68,68,0.45)',
                background: 'transparent',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tStrict('common.tryAgain', 'Try again')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Soil Scan v1 entry tile (May 2026) — calm secondary
          row card linking to /scan/soil. Mounted at the bottom
          of the Scan flow so users discover the soil check
          option without crowding the primary plant/crop scan
          surface. */}
      <button
        type="button"
        onClick={() => { try { navigate('/scan/soil'); } catch { /* swallow */ } }}
        style={{
          appearance: 'none',
          fontFamily: 'inherit',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.95rem 1rem',
          background: '#FFF9F0',
          border: '1px solid rgba(31,41,51,0.08)',
          borderRadius: 16,
          color: '#1F2933',
          textAlign: 'left',
          marginTop: '0.75rem',
          boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 8px 18px -10px rgba(80,60,30,0.18)',
          WebkitTapHighlightColor: 'transparent',
        }}
        className="ff-tap"
        data-testid="scan-page-soil-tile"
        aria-label={tStrict('soilScan.entry.aria', 'Open soil scan')}
      >
        <span aria-hidden="true" style={{
          width: 44, height: 44, flexShrink: 0,
          borderRadius: 12,
          background: 'rgba(212,163,95,0.18)',
          border: '1px solid rgba(212,163,95,0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7A5A28',
        }}>
          {/* Premium line-icon (May 2026 realism migration) —
              replaces the legacy plant-pot emoji with the soil
              glyph from the RealisticIcon catalogue. */}
          <RealisticIconLazy name="soil" size={24} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1F2933' }}>
            {tStrict('soilScan.entry.title', 'Soil scan')}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#667085', lineHeight: 1.4 }}>
            {tStrict('soilScan.entry.subtitle', 'Quick visual check of your soil.')}
          </span>
        </span>
        <span aria-hidden="true" style={{
          fontSize: '1.4rem', fontWeight: 700,
          color: '#98A2B3', lineHeight: 1, flexShrink: 0, paddingLeft: '0.4rem',
        }}>{'›'}</span>
      </button>

      {/* FEATURE_SCAN_USEFULNESS: show the lightweight useful history
          (farroway_scan_history_v1); fall back to the original. */}
      {FEATURE_SCAN_USEFULNESS ? <UsefulScanHistory /> : <ScanHistory />}
    </PremiumPage>
  );
}
