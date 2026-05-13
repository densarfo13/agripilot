/**
 * ScanPage — the new /scan flow entry point.
 *
 * State machine
 *   capture   → user picks/takes a photo + taps Analyze
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { resolveRegionUX } from '../core/regionUXEngine.js';
import { analyzeScan } from '../core/scanDetectionEngine.js';
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
import { saveScanEntry } from '../data/scanHistory.js';
import { addScanTasks } from '../core/scanToTask.js';
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

  const flagOn   = isFeatureEnabled('scanDetection');
  const mlScanOn = isFeatureEnabled('mlScan');

  const [phase, setPhase] = useState('capture');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [tasksAdded, setTasksAdded] = useState(false);
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

  // Photo URL captured at the moment the user tapped Analyze —
  // shown in the premium ScanAnalyzing surface so the analysis
  // sequence is visually anchored to the actual photo, not a
  // black rectangle. Cleared when phase moves back to capture.
  const [analyzingImageUrl, setAnalyzingImageUrl] = useState(null);
  // Scan Pipeline Audit §4 — staged-timeout escalation flag.
  // null         → default "Analyzing crop" copy
  // 'still_checking' → escalated "Still checking your crop" copy
  //                    (set after 5s of pending analysis)
  const [analyzingEscalation, setAnalyzingEscalation] = useState(null);

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
  useEffect(() => {
    if (!flagOn) return undefined;
    let cancelled = false;
    // Microtask flip — happens immediately, but the React
    // render between mount and this state update IS the
    // "Preparing camera…" frame.
    const t0 = setTimeout(() => { if (!cancelled) setMounted(true); }, 0);
    const tHardStop = setTimeout(() => {
      if (cancelled) return;
      // Only fire if the page truly never finished mounting.
      // Camera startup latency is handled by LiveCameraScanner.
      if (!mounted) {
        setLoadTimedOut(true);
        try { trackEvent('scan_load_failed', { reason: 'mount_stall_15s' }); }
        catch { /* swallow */ }
      }
    }, 15000);
    return () => { cancelled = true; clearTimeout(t0); clearTimeout(tHardStop); };
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
        try { saveScanUseful(out, { experience: entry.experience || 'generic' }); }
        catch { /* non-fatal */ }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn]);

  const onContinue = useCallback(async ({ imageBase64, imageUrl, thumbnail, file }) => {
    setError('');
    setPhase('analyzing');
    setPendingThumbnail(thumbnail || null);
    // Scan Pipeline Audit §2 + §3 — prefer self-contained dataURL
    // (thumbnail or base64) over the Object URL. Object URLs are
    // tied to the source Blob's lifetime and the source File may
    // be GC'd after ScanCapture unmounts, leaving the result
    // screen with a broken-image placeholder. The thumbnail (small,
    // canvas-derived dataURL) is the cheapest option; if thumbnail
    // creation failed (no canvas, decode error), the full
    // FileReader base64 dataURL is the next-best self-contained
    // option. The raw imageUrl (Object URL) is the last resort.
    setAnalyzingImageUrl(thumbnail || imageBase64 || imageUrl || null);
    // §7 — production pipeline trace. Dev-only via _devLog
    // would tree-shake; we keep this production-visible for ops
    // diagnostics. Fires once per scan.
    try {
      // eslint-disable-next-line no-console
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
            setResult({
              scanId:             'scan_fb_' + Date.now().toString(36),
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

      const out = await analyzeScan({
        imageBase64,
        imageUrl,
        cropId:           profile?.crop || profile?.cropId || null,
        cropName:         profile?.crop || profile?.cropId || null,
        plantName:        profile?.plantName || null,
        country:          profile?.country || null,
        region:           profile?.region  || null,
        experience,
        activeExperience: activeExperience,
        weather:          weatherForBackend,
      });
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
      let refinedOut = out;
      try {
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

      // Phase 7E — ML scan safe mode: attach structured category +
      // message so ScanResultCard can render the five safe-category
      // chip + cautious observation text. analyzeImageSafe never
      // throws — it always returns needs_review on any error.
      if (mlScanOn) {
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

      setResult(refinedOut);
      setPhase('result');
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
          setResult({
            scanId:             'scan_mlf_' + Date.now().toString(36),
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
    }
  }, [experience, activeExperience, profile]);

  const onRetake = useCallback(() => {
    setError('');
    setResult(null);
    setSavedEntryId(null);
    setTasksAdded(false);
    setPendingThumbnail(null);
    setAnalyzingImageUrl(null);
    setPhase('capture');
  }, []);

  const onSave = useCallback(() => {
    if (!result) return;
    try {
      // Final scan engine spec §10: gardenId is populated when
      // activeExperience='garden', farmId when 'farm'. Exactly
      // one of the two slots is non-null per scan so garden +
      // farm history surfaces stay isolated.
      const isGarden = activeExperience === 'garden';
      const entry = saveScanEntry(result, {
        gardenId:  isGarden ? (activeGardenId || profile?.id || null) : null,
        farmId:    !isGarden ? (activeFarmId   || profile?.id || null) : null,
        cropId:    profile?.crop || profile?.cropId || null,
        plantName: profile?.plantName || null,
        thumbnail: pendingThumbnail,
        experience: activeExperience,
        language:  null,
      });
      setSavedEntryId(entry?.id || null);
      // FEATURE_SCAN_USEFULNESS: also write the lightweight entry to
      // farroway_scan_history_v1 so UsefulScanHistory can display it
      // without depending on the per-farm history slot.
      //
      // Farm-intelligence loop §3: forward the thumbnail captured by
      // ScanCapture so the journal timeline can render an inline
      // preview. saveScanUseful pulls severity / recommendations /
      // weather caution off the result envelope itself.
      if (FEATURE_SCAN_USEFULNESS) {
        try {
          saveScanUseful(result, {
            experience: activeExperience,
            thumbnail:  pendingThumbnail,
          });
        } catch { /* non-fatal — old history still written above */ }
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
      try { markTaskAdded(result.scanId); } catch { /* non-fatal */ }
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
      const stored = addScanTasks(sanitisedSuggested, {
        scanId:    result.scanId,
        gardenId:  isGarden ? (activeGardenId || profile?.id || null) : null,
        farmId:    !isGarden ? (activeFarmId   || profile?.id || null) : null,
        experience: activeExperience,
        followUpTask,
      });
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
  if (loadTimedOut) {
    return <ScanFallback reason="timeout" />;
  }

  // Initial-mount loading state — "Preparing camera…" so the
  // user never sees a blank screen during the first paint.
  if (!mounted) {
    return (
      <main style={STYLES.page} data-screen="scan-page" data-phase="loading">
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
          <span>{tStrict('scan.page.loading', 'Preparing camera\u2026')}</span>
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
          onCancel={onRetake}
        />
      ) : null}

      {phase === 'result' && result ? (
        FEATURE_SCAN_USEFULNESS ? (
          // FEATURE_SCAN_USEFULNESS — clean farmer-friendly card.
          // saveScanUseful is idempotent (same scanId → no-op).
          // §3: thumbnail passthrough mirrors the auto-save path
          // above so both code paths produce the same enriched entry.
          (() => {
            try {
              saveScanUseful(result, {
                experience: activeExperience,
                thumbnail:  pendingThumbnail,
              });
            } catch { /* ignore */ }
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
                    // eslint-disable-next-line no-param-reassign
                    result.suggestedTasks = [...adapted, ...result.suggestedTasks];
                  } else if (result) {
                    // eslint-disable-next-line no-param-reassign
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
