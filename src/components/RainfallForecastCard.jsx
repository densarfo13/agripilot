/**
 * RainfallForecastCard — compact 7-day rainfall forecast for the dashboard.
 *
 * Shows:
 *   - 7-day rain bar chart (visual, no numbers clutter)
 *   - Summary line ("Dry week ahead" / "Rain expected")
 *   - Top alert if any (farmer-friendly action)
 *   - Collapse/expand for daily detail
 *
 * Designed to be small and non-intrusive on the home screen.
 * Only renders when forecast data is available.
 */
import { useState } from 'react';
import { useForecast } from '../context/ForecastContext.jsx';
import { useTranslation } from '../i18n/index.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortDayLabel(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return DAY_LABELS[d.getDay()] || '?';
  } catch {
    return '?';
  }
}

function severityColor(severity) {
  if (severity === 'warning') return '#F59E0B';
  if (severity === 'caution') return '#FB923C';
  if (severity === 'success') return '#22C55E';
  return '#60A5FA'; // info
}

function rainBarColor(rainMm, rainProb) {
  if (rainMm >= 20) return '#3B82F6';      // heavy — blue
  if (rainMm >= 5) return '#60A5FA';        // moderate — light blue
  if (rainProb >= 60) return '#93C5FD';     // likely but light — pale blue
  if (rainMm >= 1) return '#BFDBFE';        // trace — very pale
  return 'rgba(255,255,255,0.08)';          // dry — near invisible
}

export default function RainfallForecastCard() {
  const { rainfall, forecast, forecastLoading } = useForecast();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Don't render if no data yet
  if (!rainfall || !forecast || !rainfall.dailyRain.length) {
    if (forecastLoading) {
      return (
        <div style={S.card}>
          <div style={S.loadingRow}>
            <span style={S.loadingDot}>{'\u{1F4A7}'}</span>
            <span style={S.loadingText}>{t('rainfall.loading')}</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const { dailyRain, totalRainMm, summary, alerts } = rainfall;
  const maxRain = Math.max(...dailyRain.map(d => d.rainMm), 5); // min 5mm scale

  // Top alert for compact display
  const topAlert = alerts[0] || null;

  return (
    <div style={S.card}>
      {/* Header row */}
      <div style={S.headerRow}>
        <h3 style={S.title}>{t('rainfall.title')}</h3>
        <span style={S.totalBadge}>
          {Math.round(totalRainMm)}mm {t('rainfall.thisWeek')}
        </span>
      </div>

      {/* Summary line */}
      <p style={S.summary}>{t(summary.key)}</p>

      {/* 7-day rain bars */}
      <div style={S.barsRow}>
        {dailyRain.map((d, i) => {
          const height = Math.max(4, (d.rainMm / maxRain) * 40);
          const barBg = rainBarColor(d.rainMm, d.rainProbability);
          return (
            <div key={d.date} style={S.barCol}>
              <div style={S.barWrap}>
                <div style={{ ...S.bar, height: `${height}px`, background: barBg }} />
              </div>
              <span style={{ ...S.dayLabel, fontWeight: i === 0 ? 700 : 400 }}>
                {i === 0 ? t('rainfall.today') : shortDayLabel(d.date)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Top alert */}
      {topAlert && (
        <div style={{ ...S.alertRow, borderLeftColor: severityColor(topAlert.severity) }}>
          <span>{topAlert.icon}</span>
          <span style={S.alertText}>{t(topAlert.key, topAlert.params)}</span>
        </div>
      )}

      {/* Expand/collapse for daily detail */}
      {expanded && (
        <div style={S.detailList}>
          {dailyRain.map((d) => (
            <div key={d.date} style={S.detailRow}>
              <span style={S.detailDay}>{shortDayLabel(d.date)} {d.date.slice(5)}</span>
              <span style={S.detailRain}>
                {d.rainMm >= 1 ? `${Math.round(d.rainMm)}mm` : '-'}
              </span>
              <span style={S.detailProb}>
                {d.rainProbability > 0 ? `${d.rainProbability}%` : ''}
              </span>
              <span style={S.detailTemp}>
                {d.tempMin != null ? `${Math.round(d.tempMin)}-${Math.round(d.tempMax)}\u00B0` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        style={S.expandBtn}
      >
        {expanded ? t('rainfall.showLess') : t('rainfall.showMore')}
      </button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1rem 1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
    margin: 0,
    color: '#EAF2FF',
  },
  totalBadge: {
    fontSize: '0.75rem',
    color: '#60A5FA',
    background: 'rgba(96,165,250,0.1)',
    borderRadius: '8px',
    padding: '0.2rem 0.5rem',
    fontWeight: 600,
  },
  summary: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    margin: '0.375rem 0 0.75rem',
  },
  barsRow: {
    display: 'flex',
    gap: '0.25rem',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  barWrap: {
    height: '44px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    width: '70%',
    borderRadius: '3px 3px 0 0',
    minHeight: '4px',
    transition: 'height 0.3s ease',
  },
  dayLabel: {
    fontSize: '0.625rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  alertRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.75rem',
    padding: '0.5rem 0.625rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    borderLeft: '3px solid #F59E0B',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.85)',
  },
  alertText: {
    lineHeight: 1.4,
  },
  detailList: {
    marginTop: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.65)',
    padding: '0.25rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  detailDay: {
    flex: 1,
    fontWeight: 500,
  },
  detailRain: {
    width: '3rem',
    textAlign: 'right',
    color: '#60A5FA',
    fontWeight: 600,
  },
  detailProb: {
    width: '2.5rem',
    textAlign: 'right',
    color: 'rgba(255,255,255,0.45)',
  },
  detailTemp: {
    width: '3rem',
    textAlign: 'right',
    color: 'rgba(255,255,255,0.45)',
  },
  expandBtn: {
    marginTop: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '0.25rem 0',
    width: '100%',
    textAlign: 'center',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0',
  },
  loadingDot: {
    fontSize: '1rem',
  },
  loadingText: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.5)',
  },
};
