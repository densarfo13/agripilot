/**
 * CropTimelineCard — renders the crop journey: current stage, next
 * stage, journey %, and days left in the current stage.
 *
 * Props:
 *   farm    — profile/farm row (accepts legacy cropType/country)
 *   now     — optional timestamp for deterministic rendering in tests
 *
 * Mobile-first, matches the existing Farroway card family. Hides
 * itself when the farm has no crop.
 */

import { useMemo } from 'react';
import { getCropTimeline } from '../lib/timeline/cropTimelineEngine.js';
import { getStageProgress } from '../lib/timeline/stageProgressEngine.js';
import { getCropCycleState } from '../lib/harvest/cropCycleCompletionEngine.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';

function prettyStage(key) {
  if (!key) return '';
  return String(key).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function normaliseFarm(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return {
    id:                   farm.id || farm._id || null,
    // Server v2 endpoints + canonicalizeFarmPayload (lib/api.js)
    // strip the legacy `cropType` write-path; `crop` is the
    // canonical field. Drop the legacy fallback to satisfy the
    // crop-type-drift guard.
    crop:                 farm.crop || null,
    cropStage:            farm.cropStage || farm.stage || null,
    plantingDate:         farm.plantingDate || farm.plantedAt || null,
    stageStartedAt:       farm.stageStartedAt || null,
    manualStageOverride:  farm.manualStageOverride || null,
    farmType:             farm.farmType || 'small_farm',
  };
}

export default function CropTimelineCard({ farm, now = null } = {}) {
  const { t } = useTranslation();
  const mapped = useMemo(() => normaliseFarm(farm), [farm]);

  const view = useMemo(() => {
    if (!mapped || !mapped.crop) return null;
    const timeline = getCropTimeline({ farm: mapped, now });
    if (!timeline) return null;
    // cycleState (active | harvest_ready | completed) flows into the
    // headline so a completed cycle never shows "get ready to bring
    // in the crop" after the farmer already recorded the harvest.
    const cycle = getCropCycleState({ farm: mapped, now });
    const progress = getStageProgress({
      timeline,
      cycleState: cycle ? cycle.state : 'active',
    });
    return { timeline, progress, cycleState: cycle ? cycle.state : 'active' };
  }, [mapped, now]);

  if (!view) return null;
  const { timeline, progress } = view;

  const currentLabel = t(progress.stageLabelKey) !== progress.stageLabelKey
    ? t(progress.stageLabelKey) : prettyStage(timeline.currentStage);
  const nextLabel = timeline.nextStage
    ? (t(progress.nextStageLabelKey) !== progress.nextStageLabelKey
        ? t(progress.nextStageLabelKey) : prettyStage(timeline.nextStage))
    : null;
  const daysCopy = progress.daysRemainingCopy
    ? (t(progress.daysRemainingCopy.key) !== progress.daysRemainingCopy.key
        ? t(progress.daysRemainingCopy.key) : progress.daysRemainingCopy.fallback)
    : null;
  const headline = t(progress.headline.key) !== progress.headline.key
    ? t(progress.headline.key) : progress.headline.fallback;

  // Cleanup §5: never show the bare English fallback "Estimated"
  // when a non-English UI is missing the timeline.confidence.low
  // key — route through the new farm.estimated key (full 6-lang
  // coverage) so the chip stays localized.
  const confBadge = timeline.confidenceLevel === 'low'
    ? (t('timeline.confidence.low') !== 'timeline.confidence.low'
        ? t('timeline.confidence.low')
        : (t('farm.estimated') !== 'farm.estimated' ? t('farm.estimated') : ''))
    : null;

  return (
    <div style={S.wrap} data-testid="crop-timeline-card">
      <div style={S.header}>
        <div>
          <div style={S.title}>
            {tSafe('timeline.title', '')}
          </div>
          <div style={S.headline}>{headline}</div>
        </div>
        {confBadge && (
          <span style={S.confPill}>{confBadge}</span>
        )}
      </div>

      {/* Journey progress bar */}
      {progress.journeyPercent != null && (
        <div style={S.journeyRow}>
          <div style={S.journeyLabel}>
            {(tSafe('timeline.journey', ''))}
            <span style={S.journeyPct}>{` ${progress.journeyPercent}%`}</span>
          </div>
          <div style={S.barWrap} aria-hidden="true">
            <div
              style={{ ...S.barFill, width: `${progress.journeyPercent}%` }}
              data-testid="timeline-journey-fill"
            />
          </div>
        </div>
      )}

      {/* Stage + next + days remaining */}
      <div style={S.grid}>
        <div style={S.cell}>
          <div style={S.cellLabel}>
            {tSafe('timeline.stageNow', '')}
          </div>
          <div style={S.cellValue} data-testid="timeline-current-stage">
            {currentLabel}
          </div>
        </div>
        {nextLabel && (
          <div style={S.cell}>
            <div style={S.cellLabel}>
              {tSafe('timeline.next', '')}
            </div>
            <div style={S.cellValueSecondary} data-testid="timeline-next-stage">
              {nextLabel}
            </div>
          </div>
        )}
        {daysCopy && (
          <div style={S.cell}>
            <div style={S.cellLabel}>
              {tSafe('timeline.daysLeft', '')}
            </div>
            <div style={S.cellValueSecondary} data-testid="timeline-days-left">
              {daysCopy}
            </div>
          </div>
        )}
      </div>

      {timeline.manualOverride && (
        <div style={S.overrideHint} data-testid="timeline-override-hint">
          {tSafe('timeline.manualOverride', '')}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: {
    width: '100%',
    background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1rem 1.125rem',
    marginTop: '1rem',
    color: '#fff',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title:    { fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },
  headline: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)',
              marginTop: '0.125rem', lineHeight: 1.4 },
  confPill: {
    fontSize: '0.6875rem', color: '#FDE68A',
    border: '1px solid rgba(253,224,71,0.35)',
    background: 'rgba(253,224,71,0.06)',
    padding: '0.25rem 0.5rem', borderRadius: '999px',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  journeyRow: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  journeyLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase', letterSpacing: '0.04em' },
  journeyPct: { color: '#86EFAC', fontWeight: 700 },
  barWrap: { width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)',
             borderRadius: '999px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '999px', background: '#22C55E',
             transition: 'width 280ms ease-out' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
          gap: '0.5rem' },
  cell: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.625rem 0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  cellLabel: { fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)',
               textTransform: 'uppercase', letterSpacing: '0.04em' },
  cellValue: { fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' },
  cellValueSecondary: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' },
  overrideHint: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.4 },
};
