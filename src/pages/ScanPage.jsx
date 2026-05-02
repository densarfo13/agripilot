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
// Hybrid engine layers context (active experience + weather +
// region) on top of the image-only verdict so the result is
// safer + more actionable. See src/core/hybridScanEngine.js.
import { hybridAnalyze } from '../core/hybridScanEngine.js';
import { saveScanEntry } from '../data/scanHistory.js';
import { addScanTasks } from '../core/scanToTask.js';
import { trackEvent } from '../analytics/analyticsStore.js';
// Final scan engine spec §2: scans must attach to the active
// context — gardenId when activeExperience='garden', farmId
// when 'farm'. useExperience reads the canonical multi-
// experience selector so the routing matches what BottomTabNav
// + ExperienceSwitcher are showing on screen.
import useExperience from '../hooks/useExperience.js';
import ScanCapture from '../components/scan/ScanCapture.jsx';
import ScanResultCard from '../components/scan/ScanResultCard.jsx';
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

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title:    { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
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

export default function ScanPage() {
  // Subscribe to language change so labels refresh.
  useTranslation();
  const navigate = useNavigate();

  const flagOn = isFeatureEnabled('scanDetection');

  const [phase, setPhase] = useState('capture');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [tasksAdded, setTasksAdded] = useState(false);
  // Thumbnail produced by ScanCapture for the history list.
  // Persisted via saveScanEntry; expires with the rest of the
  // history slot.
  const [pendingThumbnail, setPendingThumbnail] = useState(null);

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
  // ExperienceSwitcher are currently showing. Falls back to
  // the legacy single-id model when the hook scope is missing.
  let activeExperience = experience;
  let activeGardenId = null;
  let activeFarmId   = null;
  try {
    const xp = useExperience();
    if (xp && xp.experience) {
      activeExperience = xp.experience === xp.EXPERIENCE.GARDEN ? 'garden'
                       : xp.experience === xp.EXPERIENCE.FARM   ? 'farm'
                       : experience;
      activeGardenId = xp.activeGardenId || null;
      activeFarmId   = xp.activeFarmId   || null;
    }
  } catch { /* falls back to legacy single-id below */ }

  // Off-flag: bounce to the existing scan flow so deep links don't
  // strand the user.
  useEffect(() => {
    if (!flagOn) {
      try { navigate('/scan-crop', { replace: true }); } catch { /* ignore */ }
    } else {
      try { trackEvent('scan_opened', { experience }); } catch { /* ignore */ }
    }
  }, [flagOn, experience, navigate]);

  const onContinue = useCallback(async ({ imageBase64, imageUrl, thumbnail, file }) => {
    setError('');
    setPhase('analyzing');
    setPendingThumbnail(thumbnail || null);
    try {
      try { trackEvent('scan_photo_taken', { experience, hasFile: !!file }); }
      catch { /* ignore */ }

      // Retention spec §2 + §12: surface a fallback verdict
      // after 2s so the user never stares at a spinner. The
      // fallback is the rule-based hybrid result (no API call —
      // hybridAnalyze is pure). When the real `analyzeScan`
      // resolves later, refinedOut overwrites the fallback in
      // a single setResult call below.
      let fallbackTimer = null;
      let fallbackShown = false;
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
              meta:               { source: 'fallback_2s_timer' },
            });
            setPhase('result');
            try { trackEvent('scan_fallback_used', { reason: '2s_timeout' }); }
            catch { /* swallow */ }
          } catch { /* swallow — wait for the real result */ }
        }, 2000);
      } catch { /* swallow */ }

      const out = await analyzeScan({
        imageBase64,
        imageUrl,
        cropId:     profile?.crop || profile?.cropId || null,
        plantName:  profile?.plantName || null,
        country:    profile?.country || null,
        experience,
      });
      // Real result back — cancel the fallback timer if it
      // hasn't fired yet. If it HAS, the refinedOut below
      // overwrites the fallback in one render so the user sees
      // the better result without a flicker.
      if (fallbackTimer) clearTimeout(fallbackTimer);

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
          // Land Intelligence input — drives the scale-aware
          // action enrichment inside hybridAnalyze.
          sizeSqFt:         profile?.landSizeSqFt || profile?.farmSize || null,
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

      setResult(refinedOut);
      setPhase('result');
      try { trackEvent('scan_analyzed', { experience, source: out?.meta?.source, confidence: out?.confidence }); }
      catch { /* ignore */ }
    } catch (err) {
      setError(tStrict(
        'scan.error.analyze',
        'We could not analyze that photo. Try again.'
      ));
      setPhase('error');
      try { trackEvent('scan_failed', { reason: err && err.message }); }
      catch { /* ignore */ }
    }
  }, [experience, activeExperience, profile]);

  const onRetake = useCallback(() => {
    setError('');
    setResult(null);
    setSavedEntryId(null);
    setTasksAdded(false);
    setPendingThumbnail(null);
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
      try { trackEvent('scan_saved', {
        id: entry?.id,
        experience: activeExperience,
        contextType: isGarden ? 'garden' : 'farm',
      }); }
      catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [result, profile, activeExperience, activeGardenId, activeFarmId, pendingThumbnail]);

  const onAddTasks = useCallback(() => {
    if (!result) return;
    try {
      // Spec §9: tasks attach to gardenId OR farmId based on
      // activeExperience so garden + farm Today's Plans stay
      // isolated. Same-day duplicates are rejected inside
      // addScanTasks.
      const isGarden = activeExperience === 'garden';
      const stored = addScanTasks(result.suggestedTasks, {
        scanId:    result.scanId,
        gardenId:  isGarden ? (activeGardenId || profile?.id || null) : null,
        farmId:    !isGarden ? (activeFarmId   || profile?.id || null) : null,
        experience: activeExperience,
      });
      if (stored.length > 0) setTasksAdded(true);
      try { trackEvent('scan_task_created', {
        scanId: result.scanId,
        count: stored.length,
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

  const isBackyard = experience === 'backyard';
  const headerTitle = isBackyard
    ? tStrict('scan.page.title.backyard', 'Take Plant Photo')
    : tStrict('scan.page.title.farm', 'Scan Crop');
  const headerSubtitle = isBackyard
    ? tStrict('scan.page.subtitle.backyard', 'Photograph the plant or leaf and we\u2019ll suggest possible issues.')
    : tStrict('scan.page.subtitle.farm', 'Photograph the affected area and we\u2019ll suggest possible issues.');

  return (
    <main style={STYLES.page} data-screen="scan-page" data-experience={experience} data-phase={phase}>
      <div>
        <h1 style={STYLES.title}>{headerTitle}</h1>
        <p style={STYLES.subtitle}>{headerSubtitle}</p>
      </div>

      {phase === 'capture' || phase === 'analyzing' ? (
        <ScanCapture experience={experience} onContinue={onContinue} />
      ) : null}

      {phase === 'result' && result ? (
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
          {/* High-confidence ML spec §2: 2-3 yes/no checks
              before committing to a specific named condition.
              The questions come from the server when available
              (analyze response includes `verificationQuestions`)
              or fall through to the on-device hybrid engine. */}
          {Array.isArray(result.verificationQuestions) && result.verificationQuestions.length > 0 ? (
            <ScanVerificationChecklist
              scanId={result.scanId || null}
              questions={result.verificationQuestions}
            />
          ) : null}
          {/* High-confidence ML spec §5: surface a "confirm with
              local expert" CTA when the verdict is risky enough
              (fast spread, sub-high confidence, or high-value
              crop). The component self-suppresses otherwise. */}
          <ScanLocalExpertCTA
            confidence={result.confidence}
            issue={result.possibleIssue}
            spreadFast={result.spreadFast || false}
            cropName={result.cropName || profile?.crop || profile?.cropId || null}
          />
          {/* Treatment guidance — non-chemical actions first,
              class-only chemical guidance, prevention tips,
              warning when triggered, disclaimer always. The
              "Add to Today's Plan" CTA inside this card forwards
              to the existing onAddTasks handler so chemical
              guidance is never persisted as a task. */}
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
              // Reuse the existing scan→task path. The actions
              // here are the non-chemical immediateActions only
              // (the card slices the array before calling us);
              // they shape themselves into suggestedTasks for
              // addScanTasks via a tiny adapter so the cap-2 +
              // dedupe rules still apply.
              if (!Array.isArray(actions) || actions.length === 0) return;
              try {
                const adapted = actions.slice(0, 2).map((title, i) => ({
                  id:         `treatment_${i}_${Date.now().toString(36)}`,
                  title,
                  reason:     '',
                  urgency:    'medium',
                  actionType: 'treatment',
                }));
                // Pretend the engine emitted these as suggestedTasks;
                // onAddTasks reads result.suggestedTasks. We mutate
                // the in-memory result + delegate.
                if (result && Array.isArray(result.suggestedTasks)) {
                  // Prepend so the treatment actions sit ahead of any
                  // existing follow-up.
                  const merged = [...adapted, ...result.suggestedTasks].slice(0, 2);
                  // eslint-disable-next-line no-param-reassign
                  result.suggestedTasks = merged;
                }
                onAddTasks();
              } catch { /* swallow */ }
            }}
            alreadyAddedTasks={tasksAdded}
          />
          <ScanFeedbackPrompt scanId={result.scanId || null} />
        </>
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

      <ScanHistory />
    </main>
  );
}
