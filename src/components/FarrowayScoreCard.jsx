import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { computeFarrowayScore } from '../lib/intelligence/farrowayScoreEngine.js';

/**
 * FarrowayScoreCard — the farm-performance score (0–100) with
 * category breakdown, trend arrow, and 1–2 suggestions.
 *
 * Runs the score engine client-side every render (pure, <1 ms).
 * Stores the previous day's score in localStorage so the trend
 * arrow is honest day-over-day. Since the engine is deterministic,
 * we can recompute on any input change without round-trip cost.
 *
 * Props
 *   farm              — required. Farm object from ProfileContext.
 *   weather           — optional weatherService snapshot.
 *   completedTaskIds  — optional Set|array of templateIds the
 *                       farmer has completed today. Powers
 *                       execution + timing categories.
 *   compact           — tighter spacing for dashboard embed.
 */
const STORAGE_KEY = 'farroway:scoreHistory:v1';
const MAX_HISTORY = 14; // two weeks

export default function FarrowayScoreCard({
  farm,
  weather = null,
  completedTaskIds = null,
  compact = false,
}) {
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(compact), [compact]);

  const [expanded, setExpanded] = useState(false);

  // Previous score for the trend arrow. Per farm id so a multi-farm
  // user sees the right trend for each farm.
  const previousScore = useMemo(
    () => readPreviousScore(farm && farm.id),
    [farm && farm.id]);

  const score = useMemo(
    () => computeFarrowayScore({
      farm, weather, completedTaskIds, previousScore, date: new Date(),
    }),
    [farm, weather, completedTaskIds, previousScore]);

  // Persist today's score so tomorrow's render has a trend baseline.
  useEffect(() => {
    if (!farm || !farm.id || !Number.isFinite(score.overall)) return;
    writeScoreSnapshot(farm.id, score);
  }, [farm && farm.id, score.overall, score.generatedFor.date]);

  const tr = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  if (!farm) return null;

  const bandLabel =
    score.band === 'excellent'  ? tr('score.band.excellent',  'Excellent')
  : score.band === 'strong'     ? tr('score.band.strong',     'Strong')
  : score.band === 'improving'  ? tr('score.band.improving',  'Improving')
                                 : tr('score.band.needs_help', 'Needs help');
  const bandColor =
    score.band === 'excellent'  ? '#86EFAC'
  : score.band === 'strong'     ? '#7DD3FC'
  : score.band === 'improving'  ? '#FCD34D'
                                 : '#FCA5A5';
  const ringBg  =
    score.band === 'excellent'  ? 'rgba(34,197,94,0.22)'
  : score.band === 'strong'     ? 'rgba(56,189,248,0.22)'
  : score.band === 'improving'  ? 'rgba(252,211,77,0.22)'
                                 : 'rgba(239,68,68,0.22)';

  return (
    <section style={styles.root} data-testid="farroway-score"
             aria-label={tr('score.title', 'Farroway Score')}>
      <header style={styles.header}>
        <div style={styles.titleBlock}>
          <h3 style={styles.title}>{tr('score.title', 'Farroway Score')}</h3>
          <div style={styles.sub}>{tr('score.sub', 'How well you\u2019re managing this farm today')}</div>
        </div>
        <TrendBadge trend={score.trend} delta={score.delta} tr={tr} />
      </header>

      <div style={styles.scoreRow}>
        <div style={{ ...styles.ring, background: ringBg, borderColor: bandColor }}
             data-testid="farroway-score-value">
          <div style={{ ...styles.ringNumber, color: bandColor }}>
            {score.overall}
          </div>
          <div style={styles.ringOf}>/ 100</div>
        </div>
        <div style={styles.bandBlock}>
          <div style={{ ...styles.bandText, color: bandColor }}
               data-testid="farroway-score-band">{bandLabel}</div>
          <div style={styles.confidence}>
            {tr(`score.conf.${score.confidence}`,
                score.confidence === 'high' ? 'High confidence'
              : score.confidence === 'medium' ? 'Medium confidence'
                                              : 'Low confidence')}
          </div>
        </div>
      </div>

      <ul style={styles.breakdown} data-testid="farroway-score-breakdown">
        {Object.entries(score.categories).map(([key, cat]) => (
          <CategoryBar key={key} catKey={key} cat={cat} tr={tr} styles={styles} />
        ))}
      </ul>

      {score.suggestions && score.suggestions.length > 0 && (
        <div style={styles.suggestions} data-testid="farroway-score-suggestions">
          <div style={styles.suggestionHeader}>
            {tr('score.suggestions', 'How to lift your score')}
          </div>
          <ul style={styles.suggestionList}>
            {score.suggestions.map((s, i) => (
              <li key={i} style={styles.suggestionItem}>
                <span style={styles.suggestionAction}>
                  {(s.labelKey && tr(s.labelKey, s.action)) || s.action}
                </span>
                {s.reason && (
                  <span style={styles.suggestionReason}> — {s.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {score.assumptions && score.assumptions.length > 0 && (
        <details style={styles.assumptions} open={expanded}
                 onToggle={(e) => setExpanded(e.target.open)}>
          <summary style={styles.assumptionsLabel}>
            {tr('score.why', 'Why this score?')}
          </summary>
          <ul style={styles.assumptionList}>
            {score.assumptions.map((a, i) => (
              <li key={i} style={styles.assumptionItem}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function TrendBadge({ trend, delta, tr }) {
  if (!trend) return null;
  const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '▬';
  const color = trend === 'up'   ? '#86EFAC'
              : trend === 'down' ? '#FCA5A5'
                                  : '#CBD5E1';
  const label = trend === 'up'   ? tr('score.trend.up',   'Improving')
              : trend === 'down' ? tr('score.trend.down', 'Slipping')
                                  : tr('score.trend.flat', 'Steady');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: `${color}28`, color,
    }} data-testid="farroway-score-trend">
      <span>{arrow}</span>
      <span>{label}</span>
      {Number.isFinite(delta) && delta !== 0 && (
        <span style={{ opacity: 0.8 }}>({delta > 0 ? '+' : ''}{delta})</span>
      )}
    </span>
  );
}

function CategoryBar({ catKey, cat, tr, styles }) {
  const label =
    catKey === 'execution'  ? tr('score.cat.execution',  'Execution')
  : catKey === 'timing'     ? tr('score.cat.timing',     'Timing')
  : catKey === 'riskMgmt'   ? tr('score.cat.riskMgmt',   'Risk Management')
  : catKey === 'cropFit'    ? tr('score.cat.cropFit',    'Crop Fit')
  : catKey === 'yieldAlign' ? tr('score.cat.yieldAlign', 'Yield Alignment')
                             : catKey;
  const pct  = Math.max(0, Math.min(100, cat.score));
  const tone = pct >= 80 ? '#86EFAC'
             : pct >= 65 ? '#7DD3FC'
             : pct >= 50 ? '#FCD34D'
                          : '#FCA5A5';
  return (
    <li style={styles.catRow} data-testid={`score-cat-${catKey}`}>
      <div style={styles.catHeader}>
        <span style={styles.catLabel}>{label}</span>
        <span style={{ ...styles.catScore, color: tone }}>
          {Math.round(cat.score)}
          <span style={styles.catWeight}> ×{cat.weight}%</span>
        </span>
      </div>
      <div style={styles.barTrack}>
        <div style={{
          ...styles.barFill,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${tone}aa, ${tone})`,
        }} />
      </div>
    </li>
  );
}

// ─── Persistence (localStorage) ──────────────────────────────────
function readPreviousScore(farmId) {
  if (!farmId) return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const history = Array.isArray(all && all[farmId]) ? all[farmId] : [];
    // Previous = most recent snapshot that isn't today.
    const today = new Date().toISOString().slice(0, 10);
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].date !== today) return history[i];
    }
    return null;
  } catch { return null; }
}
function writeScoreSnapshot(farmId, score) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const history = Array.isArray(all[farmId]) ? all[farmId] : [];
    const date = score.generatedFor.date;
    // Replace today's entry if it exists; otherwise append.
    const filtered = history.filter((h) => h.date !== date);
    filtered.push({ date, overall: score.overall, band: score.band });
    while (filtered.length > MAX_HISTORY) filtered.shift();
    all[farmId] = filtered;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* no-op */ }
}

function buildStyles(compact) {
  const pad = compact ? 14 : 18;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 12, padding: pad,
      borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)', color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 8,
    },
    titleBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
    title: { margin: 0, fontSize: 16, fontWeight: 700 },
    sub:   { fontSize: 12, color: 'rgba(230,244,234,0.7)' },
    scoreRow: { display: 'flex', gap: 14, alignItems: 'center' },
    ring: {
      width: 82, height: 82, borderRadius: '50%',
      border: '3px solid',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    },
    ringNumber: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
    ringOf:     { fontSize: 10, color: 'rgba(230,244,234,0.55)', marginTop: 2 },
    bandBlock:  { display: 'flex', flexDirection: 'column', gap: 2 },
    bandText:   { fontSize: 16, fontWeight: 700 },
    confidence: { fontSize: 11, color: 'rgba(230,244,234,0.55)' },
    breakdown: { listStyle: 'none', margin: 0, padding: 0,
                 display: 'flex', flexDirection: 'column', gap: 8 },
    catRow:    { display: 'flex', flexDirection: 'column', gap: 4 },
    catHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    catLabel:  { fontSize: 13, color: '#E6F4EA' },
    catScore:  { fontSize: 13, fontWeight: 700, display: 'flex',
                 alignItems: 'baseline', gap: 4 },
    catWeight: { fontSize: 10, color: 'rgba(230,244,234,0.5)', fontWeight: 500 },
    barTrack: {
      width: '100%', height: 6, borderRadius: 3,
      background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3,
               transition: 'width 300ms ease' },
    suggestions: {
      marginTop: 4, padding: 10, borderRadius: 10,
      background: 'rgba(252,211,77,0.06)',
      border: '1px solid rgba(252,211,77,0.22)',
    },
    suggestionHeader:  { fontSize: 12, fontWeight: 700, color: '#FCD34D',
                         letterSpacing: 0.2 },
    suggestionList:    { listStyle: 'none', margin: 0, padding: 0,
                         display: 'flex', flexDirection: 'column', gap: 6 },
    suggestionItem:    { fontSize: 13, color: '#E6F4EA', lineHeight: 1.35 },
    suggestionAction:  { fontWeight: 600 },
    suggestionReason:  { color: 'rgba(230,244,234,0.65)' },
    assumptions:       { padding: '4px 0', fontSize: 12,
                         color: 'rgba(230,244,234,0.55)' },
    assumptionsLabel:  { cursor: 'pointer' },
    assumptionList:    { margin: '6px 0 0', paddingLeft: 16 },
    assumptionItem:    { marginBottom: 2 },
  };
}
