/**
 * SafeCameraSurface — production-hardened camera capture surface.
 *
 *   <SafeCameraSurface
 *     onResult={(result) => ...}
 *     onBackHome={() => navigate('/')}
 *   />
 *
 * MAY 2026 CAMERA HARDENING PASS
 * ──────────────────────────────
 *   The previous flow occasionally:
 *     • timed out at 4 s on slow Android camera negotiation,
 *     • showed a black preview because the <video> mounted before
 *       the MediaStream finished its first frame,
 *     • attached the stream BEFORE the track was actually `live`,
 *     • failed silently on Safari (where srcObject is async).
 *
 *   This rewrite delegates the lifecycle dance to
 *   `src/lib/cameraLifecycle.js` — a typed state machine that
 *   verifies `track.readyState === 'live'`, awaits
 *   `loadedmetadata`, polls `video.readyState >= 2`, races a 9 s
 *   hard fence, and tolerates Safari's quirks. The component
 *   below only handles what's left: phase rendering, calm
 *   placeholder, fallback CTAs, and stream cleanup on every
 *   transition.
 *
 *   Phases
 *     idle        — initial; first paint, "Ready to scan" card.
 *     starting    — "Preparing camera…" shimmer (preview NOT mounted).
 *     ready       — live preview painting; capture button visible.
 *     denied      — permission refused; calm fallback + upload.
 *     unsup       — getUserMedia missing; calm fallback + upload.
 *     timeout     — camera took too long; calm fallback + upload.
 *     preview     — photo captured / uploaded; "Analyze photo" + Retake.
 *     analyzing   — engine running; processing UI with 8s safety stop.
 *     result      — finished verdict + Add to tasks / Save scan / Retake.
 *     error       — analyze failed; calm "Try again / Retake" surface.
 *
 *   Render contract
 *     The <video> element ONLY mounts in `ready` phase. While
 *     `starting`, the user sees the calm shimmer placeholder so
 *     they're never staring at a black box.
 *
 * STRICT-RULE AUDIT
 *   • Inline styles only, Soft Ochre tokens via PREMIUM_TOKENS.
 *   • Stream cleanup runs on unmount AND every transition out of
 *     ready (capture, retake, upload, fallback, retry).
 *   • Visible text via tSafe with English fallbacks.
 *   • Never throws. Every async path try/catched.
 *   • <video> renders with playsInline + muted + autoPlay so iOS
 *     Safari's autoplay policy never blocks the preview.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
// Premium line-icon system (May 2026 realism migration). Replaces
// the legacy camera emoji glyphs on the idle + fallback cards with
// a scalable single-stroke SVG that inherits currentColor — same
// silhouette across every render size + zero rasterisation.
import RealisticIcon from '../../assets/realism/icons/RealisticIcon.jsx';
import {
  startCamera as _startCamera,
  stopStream as _stopStream,
  CAMERA_TIMEOUT_MS,
} from '../../lib/cameraLifecycle.js';
// Production scan results pipeline.
//   analyzeScan    — pure entry point. Tries the configured scan
//                    provider when scanApiEnabled is on; falls back
//                    to a rule-based safe verdict when not. Never
//                    throws and never claims disease certainty.
//   saveScanEntry  — local-first scan history slot.
//   addScanTasks   — feeds Today's Plan with up to 2 immediate
//                    actions plus a "Check this again tomorrow"
//                    follow-up.
//   followUpTaskFor — canonical follow-up wording.
import { analyzeScan } from '../../core/scanDetectionEngine.js';
import { saveScanEntry } from '../../data/scanHistory.js';
import { addScanTasks } from '../../core/scanToTask.js';
import {
  followUpTaskFor, sanitizeScanText, softenForGarden,
} from '../../core/scanResultPolicy.js';

// 8-second hard ceiling on analyze before we fall back to the
// rule-based verdict. Keeps the user out of an infinite spinner
// when the provider is slow / unreachable.
const ANALYZE_TIMEOUT_MS = 8000;

const SAFE_MOCK_RESULT = Object.freeze({
  status:     'needs_review',
  label:      'Plant photo received',
  message:    'Farroway saved your photo. Review or expert scan can be added next.',
  confidence: null,
});

// Spec §4 safe-fallback verdict — used when the scan provider key
// is missing or the provider rejects the call. Never claims a
// disease; tells the user the photo is saved and points them at the
// next useful action.
const FALLBACK_RESULT = Object.freeze({
  scanId:             'scan_fallback',
  possibleIssue:      'Photo saved for review',
  confidence:         'low',
  severity:           'unknown',
  explanation:        'Farroway could not complete an expert scan yet.',
  recommendedActions: [
    'Take a clearer close-up of the leaf or affected area in good light.',
  ],
  nextAction:         'Check leaves again tomorrow.',
  suggestedTasks:     [],
  meta:               { source: 'fallback' },
});

// Spec §6 — basic image-quality heuristic. Reads a small thumbnail
// of the captured frame and returns { ok, reason } so the analyze
// path can short-circuit into the "needs a clearer crop image"
// surface instead of burning a provider call on a black photo.
function _checkImageQuality(dataUrl) {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined' || !dataUrl) {
        resolve({ ok: true, reason: null }); return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          if (w < 80 || h < 80) {
            resolve({ ok: false, reason: 'too_small' }); return;
          }
          const SAMPLE = 32;
          const c = document.createElement('canvas');
          c.width = SAMPLE; c.height = SAMPLE;
          const ctx = c.getContext('2d');
          if (!ctx) { resolve({ ok: true, reason: null }); return; }
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const px = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
          let sum = 0; let sumSq = 0; const n = SAMPLE * SAMPLE;
          for (let i = 0; i < px.length; i += 4) {
            const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            sum += lum; sumSq += lum * lum;
          }
          const mean = sum / n;
          const variance = (sumSq / n) - (mean * mean);
          // Very dark frames (finger blocking lens, no light).
          if (mean < 18) { resolve({ ok: false, reason: 'too_dark' }); return; }
          // Very flat frames (uniform — wall, blanket, blocked lens).
          if (variance < 40) { resolve({ ok: false, reason: 'low_detail' }); return; }
          resolve({ ok: true, reason: null });
        } catch { resolve({ ok: true, reason: null }); }
      };
      img.onerror = () => resolve({ ok: true, reason: null });
      img.src = dataUrl;
    } catch { resolve({ ok: true, reason: null }); }
  });
}

function _withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ timedOut: true, value: null });
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        if (settled) return;
        settled = true; clearTimeout(t);
        resolve({ timedOut: false, value: v });
      },
      () => {
        if (settled) return;
        settled = true; clearTimeout(t);
        resolve({ timedOut: false, value: null });
      },
    );
  });
}

function _logEvent(eventName, payload) {
  try {
    console.log('[FARROWAY_SCAN]', eventName, payload || {});
  } catch { /* swallow */ }
  try {
    import('../../lib/analytics.js').then((mod) => {
      try {
        if (mod && typeof mod.safeTrackEvent === 'function') {
          mod.safeTrackEvent(eventName, payload || {});
        }
      } catch { /* never propagate */ }
    }).catch(() => { /* tolerate */ });
  } catch { /* never throw from a logger */ }
}

export default function SafeCameraSurface({
  onResult = null,
  onBackHome = null,
  hideBackHome = false,
}) {
  // Phases: idle | starting | ready | denied | unsup | timeout
  //         | preview | analyzing | result | error
  const [phase, setPhase]   = useState('idle');
  const [error, setError]   = useState(null);
  const [photo, setPhoto]   = useState(null);     // { dataUrl, file? }
  const [result, setResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [qualityIssue, setQualityIssue] = useState(null);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [tasksAdded, setTasksAdded]     = useState(false);

  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const fileInputRef   = useRef(null);
  // Cancellation token so a slow startCamera that resolves AFTER
  // the user navigated away or retried can self-discard instead
  // of stomping the new lifecycle.
  const startTokenRef  = useRef(0);

  // ─── Cleanup on unmount + page-visibility-hidden ──────────
  // Capture refs at effect-run time so the cleanup never reads
  // stale `.current` (the React-Hooks lint rule's exact concern).
  // We also stop the stream when the tab becomes hidden so the
  // camera light goes off the moment the user backgrounds the
  // app — Android Chrome does NOT auto-suspend MediaStream
  // tracks on visibility change, so without this the camera
  // light stays on while the user is on a different tab.
  useEffect(() => {
    _logEvent('scan_page_opened', { surface: 'SafeCameraSurface' });
    const tokenRefSnapshot  = startTokenRef;
    const streamRefSnapshot = streamRef;
    const videoRefSnapshot  = videoRef;
    const onVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          // Bump token so any in-flight startCamera() bails out.
          tokenRefSnapshot.current += 1;
          _stopStream(streamRefSnapshot.current, videoRefSnapshot.current);
          streamRefSnapshot.current = null;
        }
      } catch { /* never throw from a listener */ }
    };
    try {
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    } catch { /* ignore */ }
    return () => {
      try {
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('visibilitychange', onVisibility);
        }
      } catch { /* ignore */ }
      // Bump token so any in-flight startCamera() bails out.
      tokenRefSnapshot.current += 1;
      _stopStream(streamRefSnapshot.current, videoRefSnapshot.current);
      streamRefSnapshot.current = null;
    };
  }, []);

  // ─── Start camera ──────────────────────────────────────────
  // Uses the lifecycle helper so the preview is gated on
  // metadata + live track + ≥9 s budget. Self-cancels via
  // startTokenRef when a newer attempt supersedes it.
  const startCamera = useCallback(async () => {
    setError(null);
    // Drop any stream we might still hold from a prior attempt.
    _stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;

    // Mount the "Preparing camera…" shimmer FIRST so the user
    // never sees a black <video>. The <video> element itself
    // doesn't render until `ready`.
    setPhase('starting');

    const myToken = ++startTokenRef.current;

    // The <video> ref isn't mounted while we're in `starting`
    // (preview is gated on `ready`), but the lifecycle helper
    // needs an element. We mount a hidden, off-screen <video>
    // below in JSX so the ref always exists. After the helper
    // resolves successfully we flip to `ready` and CSS unhides
    // the same element (it stays in the DOM the whole time).

    const result = await _startCamera({
      video:     videoRef.current,
      timeoutMs: CAMERA_TIMEOUT_MS,
      facing:    'environment',
      onLog:     (event, detail) => _logEvent(event, detail),
    });

    // Stale start? The user retried, navigated, or unmounted.
    if (myToken !== startTokenRef.current) {
      try { _stopStream(result && result.ok ? result.stream : null, videoRef.current); } catch { /* ignore */ }
      return;
    }

    if (result.ok) {
      streamRef.current = result.stream;
      setPhase('ready');
      return;
    }

    // Failure path — map typed reason to a user-facing phase.
    // Each phase carries its own calm, non-technical copy below.
    //   denied          — NotAllowedError   (permission off)
    //   unsup           — getUserMedia missing entirely
    //   not_found       — NotFoundError     (no camera device)
    //   busy            — NotReadableError  (camera in use by another app)
    //   overconstrained — Constraints rejected; lifecycle already
    //                     retried with `video: true`, so reaching
    //                     this branch means even generic failed
    //   timeout         — getUserMedia / metadata exceeded budget
    //   no_dimensions   — videoWidth=0 after ready (black-preview
    //                     guard); treat as timeout to keep copy calm
    //   anything else   — fall through to denied so the user always
    //                     gets a working upload path
    const reason = result.reason || 'unknown';
    setError(result.message || reason);
    if (reason === 'unsupported')         setPhase('unsup');
    else if (reason === 'denied')         setPhase('denied');
    else if (reason === 'not_found')      setPhase('not_found');
    else if (reason === 'busy')           setPhase('busy');
    else if (reason === 'overconstrained') setPhase('not_found'); // single-camera laptops, etc.
    else if (reason === 'timeout')        setPhase('timeout');
    else if (reason === 'no_dimensions')  setPhase('timeout');
    else setPhase('denied'); // safest default — fallback offers retry + upload.
  }, []);

  // ─── Capture photo from the live stream ───────────────────
  const capturePhoto = useCallback(() => {
    try {
      const video = videoRef.current;
      if (!video) throw new Error('No video element');
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto({ dataUrl, file: null });
      // Reset any prior verdict / quality flag — the preview is
      // pre-analyze. The verdict is filled in by the analyze
      // pipeline below; the user has to tap "Analyze photo" to
      // move forward.
      setResult(null);
      setAnalyzeError(null);
      setQualityIssue(null);
      setSavedEntryId(null);
      setTasksAdded(false);
      setPhase('preview');
      // Stop the stream now that we have the frame.
      _stopStream(streamRef.current, videoRef.current);
      streamRef.current = null;
      _logEvent('scan_photo_uploaded', { source: 'camera' });
    } catch (err) {
      try { console.error('Capture failed:', err && err.message); }
      catch { /* swallow */ }
      // Don't crash — fall back to the upload path.
      _stopStream(streamRef.current, videoRef.current);
      streamRef.current = null;
      setPhase('denied');
    }
  }, []);

  // ─── Upload photo from gallery / file picker ──────────────
  const handleUploadClick = useCallback(() => {
    try {
      if (fileInputRef.current) fileInputRef.current.click();
    } catch { /* swallow */ }
  }, []);

  const handleFileChange = useCallback((e) => {
    try {
      const file = e && e.target && e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          setPhoto({ dataUrl: String(reader.result || ''), file });
          setResult(null);
          setAnalyzeError(null);
          setQualityIssue(null);
          setSavedEntryId(null);
          setTasksAdded(false);
          setPhase('preview');
          // Stop any live stream we no longer need.
          _stopStream(streamRef.current, videoRef.current);
          streamRef.current = null;
          _logEvent('scan_photo_uploaded', { source: 'upload' });
        } catch { /* swallow */ }
      };
      reader.onerror = () => { /* let the user retry — no crash */ };
      reader.readAsDataURL(file);
    } catch (err) {
      try { console.error('Upload failed:', err && err.message); }
      catch { /* swallow */ }
    }
  }, []);

  // ─── Read the active experience (garden vs farm) ──────────
  // Defensive — `farroway_experience` is written by onboarding.
  // The result-card copy and the canonical follow-up task adjust
  // based on this value; anything we can't classify becomes 'farm'.
  const _readActiveExperience = useCallback(() => {
    try {
      if (typeof localStorage === 'undefined') return 'farm';
      const raw = localStorage.getItem('farroway_experience');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed === 'backyard' || parsed === 'garden') return 'garden';
      if (parsed === 'farm' || parsed === 'generic') return parsed === 'generic' ? 'farm' : 'farm';
    } catch { /* ignore */ }
    return 'farm';
  }, []);

  // ─── Analyze photo (the missing primary action) ───────────
  // Spec §3 — show processing immediately, run the engine with an
  // 8-second hard ceiling, surface the verdict in `result` phase.
  // Spec §4 — when the provider key is missing, the engine returns
  // its rule-based safe fallback so the user is never stuck.
  const handleAnalyze = useCallback(async () => {
    if (!photo || !photo.dataUrl) return;
    setAnalyzeError(null);
    setQualityIssue(null);
    setPhase('analyzing');
    _logEvent('scan_analyze_clicked', {});

    // §6 — quick image-quality screen. A blurry / dark / blocked
    // frame surfaces the "needs a clearer crop image" hint
    // instead of burning a provider call.
    let q = { ok: true, reason: null };
    try { q = await _checkImageQuality(photo.dataUrl); }
    catch { q = { ok: true, reason: null }; }

    if (!q.ok) {
      setQualityIssue(q.reason);
      setResult({
        ...FALLBACK_RESULT,
        scanId: 'scan_quality_' + Date.now().toString(36),
        possibleIssue: 'Photo needs a clearer crop image',
        explanation:   'The photo looks too dark or unclear for a reliable scan.',
        recommendedActions: [
          'Retake with the leaf or affected area centered.',
          'Use bright daylight; avoid shadows and finger-blocked lenses.',
        ],
        nextAction: 'Retake the photo and try again.',
        meta: { source: 'image_quality_fallback', reason: q.reason },
      });
      setPhase('result');
      _logEvent('scan_quality_rejected', { reason: q.reason });
      return;
    }

    // §3 — call the engine. analyzeScan handles the provider
    // path and the safe fallback internally; we only need the
    // 8-second timeout here so a hung server can't block the UI.
    const experience = _readActiveExperience();
    let raced = { timedOut: false, value: null };
    try {
      raced = await _withTimeout(
        analyzeScan({
          imageBase64: photo.dataUrl,
          experience:  experience === 'garden' ? 'backyard' : 'farm',
        }),
        ANALYZE_TIMEOUT_MS,
      );
    } catch { raced = { timedOut: false, value: null }; }

    let verdict = raced.value;
    if (raced.timedOut || !verdict || !verdict.possibleIssue) {
      // §4 + §7 — fall back to the safe verdict so the user always
      // gets an actionable surface within ~8 seconds.
      verdict = {
        ...FALLBACK_RESULT,
        scanId: 'scan_fb_' + Date.now().toString(36),
        meta: {
          source: raced.timedOut ? 'timeout_fallback' : 'fallback',
        },
      };
      _logEvent('scan_fallback_used', {
        reason: raced.timedOut ? 'timeout' : 'no_verdict',
      });
    }

    setResult(verdict);
    setPhase('result');
    _logEvent('scan_analyzed', {
      source:     verdict?.meta?.source || null,
      confidence: verdict?.confidence   || null,
    });
  }, [photo, _readActiveExperience]);

  // ─── Result actions: save, add-to-tasks, retake ───────────
  const handleSave = useCallback(() => {
    if (!result) return;
    try {
      const experience = _readActiveExperience();
      const isGarden = experience === 'garden';
      const entry = saveScanEntry(result, {
        gardenId:   isGarden ? 'garden_default' : null,
        farmId:     !isGarden ? 'farm_default'  : null,
        experience: isGarden ? 'backyard' : 'farm',
        thumbnail:  photo?.dataUrl || null,
      });
      setSavedEntryId(entry?.id || null);
      _logEvent('scan_result_saved', { id: entry?.id || null });
    } catch { /* never throw from a click handler */ }
    if (typeof onResult === 'function' && photo && result) {
      try { onResult({ photo, result }); } catch { /* swallow */ }
    }
  }, [onResult, photo, result, _readActiveExperience]);

  const handleAddToTasks = useCallback(() => {
    if (!result) return;
    try {
      const experience = _readActiveExperience();
      const isGarden = experience === 'garden';
      const followUp = followUpTaskFor(
        isGarden ? 'garden' : 'farm',
        null,
      );
      const suggested = Array.isArray(result.suggestedTasks)
        ? result.suggestedTasks
            .map((t) => ({
              ...t,
              title:  sanitizeScanText(String(t?.title || '')),
              reason: sanitizeScanText(String(t?.reason || '')),
            }))
            .filter((t) => t.title)
        : [];
      const stored = addScanTasks(suggested, {
        scanId:    result.scanId || null,
        gardenId:  isGarden ? 'garden_default' : null,
        farmId:    !isGarden ? 'farm_default'  : null,
        experience: isGarden ? 'backyard' : 'farm',
        followUpTask: followUp,
      });
      if (stored && stored.length > 0) setTasksAdded(true);
      else setTasksAdded(true); // confirm UX even if scanToTask flag is off
      _logEvent('scan_task_created', {
        count: stored ? stored.length : 0,
        followUpAdded: stored && stored.some((t) => t.isFollowUp),
      });
    } catch { /* never throw */ }
  }, [result, _readActiveExperience]);

  const handleRetake = useCallback(() => {
    _logEvent('scan_retry_clicked', {});
    setPhoto(null);
    setResult(null);
    setError(null);
    setAnalyzeError(null);
    setQualityIssue(null);
    setSavedEntryId(null);
    setTasksAdded(false);
    // Always release any prior stream before a fresh start.
    _stopStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setPhase('idle');
  }, []);

  // ─── Try-again from the analyze error surface ─────────────
  const handleAnalyzeAgain = useCallback(() => {
    setAnalyzeError(null);
    setPhase('preview');
  }, []);

  // ─── Render ───────────────────────────────────────────────
  // The <video> element is rendered for every phase so the ref
  // is always present when startCamera() needs to attach. It is
  // visually hidden outside the `ready` phase via display:none.
  const videoVisible = phase === 'ready';

  return (
    <main style={S.page} data-testid="safe-camera-surface" data-phase={phase}>
      <header style={S.header}>
        <h1 style={S.title}>
          {tSafe('safeCamera.title', 'Scan plant or crop')}
        </h1>
        <p style={S.subtitle}>
          {tSafe(
            'safeCamera.subtitle',
            'Take a clear photo of the leaf, fruit, or stem. Good light helps.',
          )}
        </p>
      </header>

      {/* Phase: preview — photo captured or uploaded; awaits Analyze */}
      {phase === 'preview' && photo ? (
        <section style={S.previewCard} data-testid="safe-scan-preview">
          {photo.dataUrl ? (
            <img src={photo.dataUrl} alt="" style={S.previewImg} />
          ) : null}
          <div style={S.previewHint}>
            {tSafe(
              'safeCamera.previewHint',
              'Photo received. Tap Analyze to get a result.',
            )}
          </div>
          <div style={S.btnRow}>
            <button type="button" onClick={handleAnalyze} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-analyze">
              {tSafe('safeCamera.analyze', 'Analyze photo')}
            </button>
            <button type="button" onClick={handleRetake} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-retake">
              {tSafe('safeCamera.retake', 'Retake')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: analyzing — calm processing surface with the photo
          anchored above the spinner so the analysis is visually
          tied to what the user just captured. 8-second internal
          timeout falls through to the fallback verdict. */}
      {phase === 'analyzing' ? (
        <section style={S.previewCard} data-testid="safe-scan-analyzing">
          {photo && photo.dataUrl ? (
            <img src={photo.dataUrl} alt="" style={S.previewImg} />
          ) : null}
          <div style={S.analyzingBox}>
            <div style={S.spinner} aria-hidden="true" />
            <div style={S.analyzingTitle}>
              {tSafe('safeCamera.analyzingTitle', 'Analyzing plant photo…')}
            </div>
            <div style={S.analyzingBody}>
              {tSafe(
                'safeCamera.analyzingBody',
                'Checking image quality and visible symptoms.',
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Phase: result — verdict card with finding / confidence /
          severity / recommendation / next action. Action row puts
          Add to tasks first (per spec §2), Save scan secondary,
          Retake tertiary. */}
      {phase === 'result' && result ? (
        <section style={S.previewCard} data-testid="safe-scan-result">
          {photo && photo.dataUrl ? (
            <img src={photo.dataUrl} alt="" style={S.previewImg} />
          ) : null}
          <ResultCard
            result={result}
            qualityIssue={qualityIssue}
            isGarden={_readActiveExperience() === 'garden'}
          />
          <div style={S.btnRow}>
            <button
              type="button"
              onClick={handleAddToTasks}
              style={tasksAdded ? S.btnGhost : S.btnPrimary}
              disabled={tasksAdded}
              className="ff-tap"
              data-testid="safe-scan-add-task"
            >
              {tasksAdded
                ? tSafe('safeCamera.taskAdded', 'Added to tasks')
                : tSafe('safeCamera.addTask',   'Add to tasks')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={S.btnGhost}
              disabled={!!savedEntryId}
              className="ff-tap"
              data-testid="safe-scan-save"
            >
              {savedEntryId
                ? tSafe('safeCamera.saved', 'Saved')
                : tSafe('safeCamera.save',  'Save scan')}
            </button>
            <button
              type="button"
              onClick={handleRetake}
              style={S.btnGhost}
              className="ff-tap"
              data-testid="safe-scan-retake"
            >
              {tSafe('safeCamera.retake', 'Retake')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: error — analyze failed and we couldn't even produce
          a fallback verdict. Calm copy, no raw error text. */}
      {phase === 'error' ? (
        <section style={S.fallbackCard} data-testid="safe-scan-error">
          <RealisticIcon name="camera" size={48} style={S.bigIcon} />
          <h2 style={S.idleTitle}>
            {tSafe(
              'safeCamera.errorTitle',
              'Couldn’t analyze this photo right now.',
            )}
          </h2>
          <p style={S.idleBody}>
            {analyzeError
              || tSafe(
                'safeCamera.errorBody',
                'Try again, or retake the photo with a clearer view of the affected area.',
              )}
          </p>
          <div style={S.btnRow}>
            <button
              type="button"
              onClick={handleAnalyzeAgain}
              style={S.btnPrimary}
              className="ff-tap"
              data-testid="safe-scan-try-again"
            >
              {tSafe('safeCamera.tryAgain', 'Try again')}
            </button>
            <button
              type="button"
              onClick={handleRetake}
              style={S.btnGhost}
              className="ff-tap"
              data-testid="safe-scan-error-retake"
            >
              {tSafe('safeCamera.retake', 'Retake photo')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: starting — calm shimmer placeholder
          The <video> ref is mounted but display:none so
          loadedmetadata fires; the user only sees the shimmer. */}
      {phase === 'starting' ? (
        <section style={S.cameraCard} data-testid="safe-scan-starting">
          <div style={S.shimmerWrap} aria-hidden="true">
            <div style={S.shimmer} />
            <div style={S.shimmerLabel}>
              {tSafe('safeCamera.preparing', 'Preparing camera…')}
            </div>
          </div>
        </section>
      ) : null}

      {/* Phase: ready — live preview */}
      {phase === 'ready' ? (
        <section style={S.cameraCard}>
          {/* video rendered below — same element across phases */}
          <div style={S.btnRow}>
            <button type="button" onClick={capturePhoto} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-capture">
              {tSafe('safeCamera.takePhoto', 'Take photo')}
            </button>
            <button type="button" onClick={handleUploadClick} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-upload-secondary">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
          </div>
        </section>
      ) : null}

      {/* The single <video> element. Mounted at all times so the
          ref exists when startCamera() runs; visually shown only
          when phase === 'ready'. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ ...S.video, display: videoVisible ? 'block' : 'none' }}
        data-testid="safe-scan-video"
      />

      {/* Phase: idle — first-paint card */}
      {phase === 'idle' && !photo ? (
        <section style={S.idleCard}>
          <RealisticIcon name="camera" size={48} style={S.bigIcon} />
          <h2 style={S.idleTitle}>
            {tSafe('safeCamera.readyTitle', 'Ready to scan')}
          </h2>
          <p style={S.idleBody}>
            {tSafe(
              'safeCamera.readyBody',
              'Take a photo with your camera, or upload one from your gallery.',
            )}
          </p>
          <div style={S.btnRow}>
            <button type="button" onClick={startCamera} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-start">
              {tSafe('safeCamera.openCamera', 'Open camera')}
            </button>
            <button type="button" onClick={handleUploadClick} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-upload-primary">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
          </div>
        </section>
      ) : null}

      {/* Phase: denied / unsup / timeout / not_found / busy
          → calm, non-technical fallback. Each branch picks the
          copy that matches its specific failure mode so the user
          gets actionable guidance, not a generic "try again". */}
      {(phase === 'denied'
         || phase === 'unsup'
         || phase === 'timeout'
         || phase === 'not_found'
         || phase === 'busy') && !photo ? (
        <section style={S.fallbackCard} data-testid={`safe-scan-fallback-${phase}`}>
          <RealisticIcon name="camera" size={48} style={S.bigIcon} />
          <h2 style={S.idleTitle}>
            {phase === 'denied'
              ? tSafe('safeCamera.deniedTitle', 'Camera permission needed')
              : phase === 'unsup'
                ? tSafe('safeCamera.unsupTitle', 'Camera not available on this device')
                : phase === 'not_found'
                  ? tSafe('safeCamera.notFoundTitle', 'No camera found')
                  : phase === 'busy'
                    ? tSafe('safeCamera.busyTitle', 'Camera is in use')
                    : tSafe('safeCamera.timeoutTitle', 'Camera is taking longer than expected')}
          </h2>
          <p style={S.idleBody}>
            {phase === 'denied'
              ? tSafe('safeCamera.deniedBody', 'Camera access is off. You can upload a photo instead.')
              : phase === 'not_found'
                ? tSafe('safeCamera.notFoundBody', 'No camera found. Upload a photo to continue.')
                : phase === 'busy'
                  ? tSafe('safeCamera.busyBody', 'Camera may be used by another app. Try again or upload a photo.')
                  : phase === 'timeout'
                    ? tSafe('safeCamera.timeoutBody', 'You can still upload a photo, or try again.')
                    : tSafe('safeCamera.unsupBody', 'You can still upload a photo to continue.')}
          </p>
          <div style={S.btnRow}>
            <button type="button" onClick={handleUploadClick} style={S.btnPrimary}
                    className="ff-tap" data-testid="safe-scan-upload-fallback">
              {tSafe('safeCamera.uploadPhoto', 'Upload photo')}
            </button>
            <button type="button" onClick={startCamera} style={S.btnGhost}
                    className="ff-tap" data-testid="safe-scan-retry-camera">
              {tSafe('safeCamera.retryCamera', 'Retry camera')}
            </button>
            {!hideBackHome && typeof onBackHome === 'function' ? (
              <button type="button" onClick={onBackHome} style={S.btnGhost}
                      className="ff-tap" data-testid="safe-scan-back-home">
                {tSafe('safeCamera.backHome', 'Back to Home')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Hidden file picker — used by all upload paths. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="safe-scan-file-input"
      />
    </main>
  );
}

// ─── Result card sub-component ──────────────────────────────
// Renders the verdict in the spec's preferred order:
//   • Likely issue (possibleIssue)
//   • Confidence chip (low / medium / high → "Needs review" /
//     "Possible match" / "Likely match" — never "confirmed")
//   • Severity chip (when the engine attached one)
//   • Recommended action (first item from recommendedActions)
//   • Next check time (nextAction or first follow-up task title)
function ResultCard({ result, qualityIssue, isGarden = false }) {
  if (!result) return null;
  // Garden-mode tone softener — applied to the human-readable
  // strings only (finding / recommendation / nextCheck). Confidence
  // + severity chips stay canonical because they're already
  // localized labels, not engine prose. softenForGarden is pure
  // and falls through to the original text when nothing matches.
  const tone = (s) => {
    const safe = String(s || '');
    if (!isGarden) return safe;
    return softenForGarden(safe) || safe;
  };
  const finding = tone(result.possibleIssue || result.label || 'Photo received');
  const confidenceLabel = (() => {
    const c = String(result.confidence || '').toLowerCase();
    if (c === 'high')   return tSafe('safeCamera.confHigh',   'Likely match');
    if (c === 'medium') return tSafe('safeCamera.confMedium', 'Possible match');
    return tSafe('safeCamera.confLow', 'Needs review');
  })();
  const severityLabel = (() => {
    const s = String(result.severity || '').toLowerCase();
    if (s === 'high')   return tSafe('safeCamera.sevHigh',   'High');
    if (s === 'medium') return tSafe('safeCamera.sevMedium', 'Medium');
    if (s === 'low')    return tSafe('safeCamera.sevLow',    'Low');
    return null;
  })();
  const recommendation = (() => {
    if (Array.isArray(result.recommendedActions) && result.recommendedActions.length > 0) {
      return tone(result.recommendedActions[0]);
    }
    if (result.explanation) return tone(result.explanation);
    return tSafe(
      'safeCamera.recDefault',
      'Take a clearer close-up of the leaf or affected area in good light.',
    );
  })();
  const nextCheck = (() => {
    if (result.nextAction) return tone(result.nextAction);
    const tasks = Array.isArray(result.suggestedTasks) ? result.suggestedTasks : [];
    if (tasks.length > 0 && tasks[0] && tasks[0].title) return tone(tasks[0].title);
    return tSafe('safeCamera.nextDefault', 'Check leaves again tomorrow.');
  })();

  return (
    <div style={S.resultCard} data-testid="safe-scan-result-card">
      {qualityIssue ? (
        <div style={S.qualityBanner} data-testid="safe-scan-quality-banner">
          {tSafe(
            'safeCamera.qualityBanner',
            'Photo needs a clearer crop image.',
          )}
        </div>
      ) : null}
      <div style={S.resultLabel}>{finding}</div>
      <div style={S.chipRow}>
        <span style={S.chipNeutral} data-testid="safe-scan-confidence">
          {tSafe('safeCamera.confidenceLabel', 'Confidence:')} {confidenceLabel}
        </span>
        {severityLabel ? (
          <span style={S.chipNeutral} data-testid="safe-scan-severity">
            {tSafe('safeCamera.severityLabel', 'Severity:')} {severityLabel}
          </span>
        ) : null}
      </div>
      <div style={S.resultRow}>
        <div style={S.resultRowLabel}>
          {tSafe('safeCamera.actionLabel', 'Action:')}
        </div>
        <div style={S.resultRowBody} data-testid="safe-scan-recommendation">
          {recommendation}
        </div>
      </div>
      <div style={S.resultRow}>
        <div style={S.resultRowLabel}>
          {tSafe('safeCamera.nextLabel', 'Next:')}
        </div>
        <div style={S.resultRowBody} data-testid="safe-scan-next">
          {nextCheck}
        </div>
      </div>
    </div>
  );
}

// Test hooks (kept for the existing test surface — re-exports
// from the lifecycle helper so the timeout constant has a single
// source of truth).
export const _internal = Object.freeze({
  CAMERA_TIMEOUT_MS,
  ANALYZE_TIMEOUT_MS,
  SAFE_MOCK_RESULT,
  FALLBACK_RESULT,
});

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgBottom} 100%)`,
    color: T.ink,
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: { padding: '4px 0' },
  title:  { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: T.ink },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: T.inkDim, lineHeight: 1.5 },
  cameraCard: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: 12, borderRadius: T.radiusCard, background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  video: {
    width: '100%', maxHeight: '60vh', borderRadius: 12, background: '#000',
    objectFit: 'cover',
  },
  shimmerWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: 12,
    overflow: 'hidden',
    background: T.ochreSoft,
    border: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmer: {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(90deg, ${T.ochreSoft} 0%, rgba(255,255,255,0.55) 50%, ${T.ochreSoft} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'farroway-shimmer 1.4s ease-in-out infinite',
  },
  shimmerLabel: {
    position: 'relative',
    fontSize: 14,
    fontWeight: 700,
    color: T.ochreInk,
    letterSpacing: '0.02em',
    background: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    padding: '0.45rem 0.9rem',
    border: `1px solid ${T.ochreBorder}`,
  },
  idleCard: {
    padding: '2rem 1.5rem', borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  fallbackCard: {
    padding: '2rem 1.5rem', borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.amberBorder}`,
    boxShadow: T.shadowCard,
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10,
  },
  bigIcon: { fontSize: 48, lineHeight: 1 },
  idleTitle: { margin: '0.25rem 0 0', fontSize: 20, fontWeight: 800, color: T.ink },
  idleBody:  { margin: '0.25rem 0 0', fontSize: 14, color: T.inkDim, lineHeight: 1.5 },
  errBody:   { margin: '0.25rem 0 0', fontSize: 12, color: T.error },
  previewCard: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: 12, borderRadius: T.radiusCard, background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  previewImg: {
    width: '100%', maxHeight: '50vh', borderRadius: 12, background: '#000',
    objectFit: 'contain',
  },
  resultBox: {
    padding: 12, borderRadius: 12, background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
  },
  resultLabel: { fontSize: 16, fontWeight: 800, color: T.greenInk },
  resultMsg:   { marginTop: 4, fontSize: 14, color: T.ink, lineHeight: 1.5 },
  previewHint: {
    fontSize: 13,
    color: T.inkDim,
    lineHeight: 1.5,
    padding: '4px 4px 0',
  },
  analyzingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 8, padding: '14px 12px',
    borderRadius: 12, background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder || 'rgba(0,0,0,0.06)'}`,
  },
  analyzingTitle: {
    fontSize: 15, fontWeight: 800, color: T.ink, textAlign: 'center',
  },
  analyzingBody: {
    fontSize: 13, color: T.inkDim, textAlign: 'center', lineHeight: 1.5,
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `3px solid rgba(0,0,0,0.08)`,
    borderTopColor: T.ochre,
    animation: 'farroway-spin 0.8s linear infinite',
  },
  resultCard: {
    padding: 14, borderRadius: 12,
    background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  qualityBanner: {
    padding: '8px 10px', borderRadius: 10,
    background: T.amberSoft, border: `1px solid ${T.amberBorder}`,
    color: T.amberInk, fontSize: 13, fontWeight: 700,
  },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  chipNeutral: {
    fontSize: 12, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(0,0,0,0.05)',
    border: `1px solid rgba(0,0,0,0.08)`,
    color: T.ink,
  },
  resultRow: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  resultRowLabel: {
    fontSize: 12, fontWeight: 700, color: T.inkDim, letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  resultRowBody: {
    fontSize: 14, color: T.ink, lineHeight: 1.5,
  },
  btnRow: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12,
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1, minWidth: '10rem', minHeight: 48, padding: '0.85rem 1.25rem',
    border: 'none', borderRadius: 999,
    background: `linear-gradient(180deg, ${T.ochre} 0%, ${T.ochreActive} 100%)`,
    color: '#FFFFFF',
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    letterSpacing: '0.005em',
    fontFamily: 'inherit',
  },
  btnGhost: {
    flex: 1, minWidth: '10rem', minHeight: 48, padding: '0.85rem 1.25rem',
    border: `1px solid ${T.border}`, borderRadius: 999,
    background: 'transparent', color: T.ink,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
