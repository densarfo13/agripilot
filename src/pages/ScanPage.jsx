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
      const out = await analyzeScan({
        imageBase64,
        imageUrl,
        cropId:     profile?.crop || profile?.cropId || null,
        plantName:  profile?.plantName || null,
        country:    profile?.country || null,
        experience,
      });
      setResult(out);
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
  }, [experience, profile]);

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
