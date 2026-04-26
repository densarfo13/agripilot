/**
 * PostHarvestSummaryPage — the screen a farmer lands on after
 * submitting a harvest. Replaces the old "silent reload" with a
 * celebratory + actionable summary that keeps them moving.
 *
 * Route: /harvest/:cycleId/summary
 *
 * Data sources (in priority order):
 *   1. route state from FarmerTodayPage (hot — always fresh after
 *      POST /harvest)
 *   2. GET /api/v2/crop-cycles/:id/summary (cold refresh on reload)
 *
 * Renders:
 *   - a headline + outcome class pill
 *   - "What went well" / "What could improve" bullet lists (both
 *     pulled from i18n keys so every language just works)
 *   - compact metrics grid (completion %, skipped, issues, yield,
 *     duration, timing delta)
 *   - a NextCycleOptions card with up to three CTAs
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getCycleSummary, getNextCycleOptions } from '../../hooks/useCropCycles.js';
import HarvestSummaryCard from '../../components/farmer/HarvestSummaryCard.jsx';
import NextCycleOptions from '../../components/farmer/NextCycleOptions.jsx';
import { shouldShowSellCta } from '../../utils/featureGates.js';
import { tSafe } from '../../i18n/tSafe.js';

const OUTCOME_COLOR = {
  successful: '#22C55E',
  delayed:    '#F59E0B',
  high_risk:  '#F59E0B',
  failed:     '#EF4444',
};

export default function PostHarvestSummaryPage() {
  const { t } = useAppSettings();
  const navigate = useNavigate();
  const { cycleId } = useParams();
  const { state: navState } = useLocation();

  const [state, setState] = useState({
    loading: !navState?.summary,
    summary: navState?.summary || null,
    nextCycle: navState?.nextCycle || null,
    error: null,
  });

  useEffect(() => {
    // If the farmer navigated straight to this URL (reload, deep
    // link), hydrate summary + options from the API.
    if (navState?.summary && navState?.nextCycle) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, n] = await Promise.all([
          cycleId ? getCycleSummary(cycleId) : Promise.resolve({ summary: null }),
          getNextCycleOptions(cycleId),
        ]);
        if (!cancelled) {
          setState({
            loading: false,
            summary: s?.summary || null,
            nextCycle: n || null,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) setState({ loading: false, summary: null, nextCycle: null, error: err?.code || 'error' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  const outcomeColor = useMemo(() => {
    const klass = state.summary?.outcomeClass || 'successful';
    return OUTCOME_COLOR[klass] || OUTCOME_COLOR.successful;
  }, [state.summary?.outcomeClass]);

  function handleOptionPick(option) {
    if (!option) return;
    if (option.type === 'delay_same_crop') {
      navigate('/today');
      return;
    }
    // Every other option routes through the crop-plan page with
    // full recommendation context so nothing is lost.
    navigate('/crop-plan', {
      state: {
        onboardingContext: { pickedCrop: { crop: option.cropKey }, source: 'post_harvest' },
        crop: { key: option.cropKey, name: option.cropKey, fitLevel: option.fitLevel, confidence: option.confidence },
      },
    });
  }

  if (state.loading) {
    return (
      <Shell>
        <p style={S.muted}>{t('common.loading')}</p>
      </Shell>
    );
  }
  if (state.error || !state.summary) {
    return (
      <Shell>
        <p style={S.muted}>{tSafe('postHarvest.loadError', '')}</p>
        <button style={S.btnGhost} onClick={() => navigate('/today')}>
          {t('common.back')}
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <header style={S.header}>
        <div style={S.celebration}>{'\uD83C\uDF3E'}</div>
        <h1 style={S.title}>{tSafe('postHarvest.title', '')}</h1>
        <span
          style={{ ...S.classPill, color: outcomeColor, borderColor: outcomeColor }}
          data-testid="post-harvest-class"
        >
          {t(state.summary.headlineKey)}
        </span>
      </header>

      <HarvestSummaryCard summary={state.summary} />

      {/* Sell this harvest — offered only in Farm Mode. Backyard
          users typically aren't selling, so the CTA is suppressed to
          match the dual-mode spec. Feature gate flips instantly if
          the farmer upgrades their profile to farm mode later. */}
      {cycleId && state.summary?.metrics?.yieldKg > 0 && shouldShowSellCta({ farmType: state.summary?.farmType }) && (
        <button
          type="button"
          style={S.btnSell}
          onClick={() => navigate('/farmer/listings/new', {
            state: { cycleId, prefill: {
              cropKey: state.summary?.cropKey,
              quantity: state.summary?.metrics?.yieldKg,
            } },
          })}
          data-testid="post-harvest-sell"
        >
          {tSafe('postHarvest.sellPrompt', '')}
        </button>
      )}

      {/* Primary CTA — dominant, always "Start next crop". Picks the
          first available option (repeat_improved → switch_crop →
          auto_pick) so the farmer can tap once and keep moving. */}
      {state.nextCycle?.options?.length > 0 && (
        <button
          type="button"
          style={S.btnPrimary}
          onClick={() => handleOptionPick(state.nextCycle.options[0])}
          data-testid="post-harvest-start-next"
        >
          {tSafe('postHarvest.startNext', '')}
        </button>
      )}

      <NextCycleOptions
        data={state.nextCycle}
        onPick={handleOptionPick}
      />

      <button
        type="button"
        style={S.btnGhost}
        onClick={() => navigate('/today')}
        data-testid="post-harvest-back-today"
      >
        {tSafe('postHarvest.backToToday', '')}
      </button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={S.page}>
      <div style={S.container}>{children}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0 0.75rem' },
  celebration: { fontSize: '2.5rem' },
  title: { fontSize: '1.375rem', fontWeight: 700, margin: 0, color: '#EAF2FF' },
  classPill: {
    marginTop: '0.25rem',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    border: '1px solid', fontSize: '0.75rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  btnGhost: {
    alignSelf: 'center', padding: '0.625rem 1rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
  btnPrimary: {
    width: '100%', padding: '1rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  btnSell: {
    width: '100%', padding: '0.875rem', borderRadius: '14px',
    border: '1px solid rgba(14,165,233,0.28)', background: 'rgba(14,165,233,0.10)',
    color: '#0EA5E9', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
  },
};
