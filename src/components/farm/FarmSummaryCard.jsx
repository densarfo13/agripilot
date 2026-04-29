/**
 * FarmSummaryCard — top-of-page summary tile for the farm
 * intelligence hub.
 *
 * Six fields at a glance (per spec):
 *   • Crop          — routed via cropLabel(value, lang) so every
 *                     locale reads the right name
 *   • Crop stage    — i18n key under stage.* with a localized fallback
 *   • Farm size     — formatted with the farm's own unit
 *   • Location      — country / region label
 *   • GPS status    — present / missing pill
 *   • Last updated  — relative time
 *
 * Visible text routes through `tStrict` (no English-leak rule).
 * Icons are inline Lucide-style SVG; no emoji.
 *
 * Props
 * ─────
 *   farm   the active farm/profile shape (any of the per-field
 *           keys may be missing — the card hides each row gracefully).
 *   lang   active short language code (forwarded to cropLabel).
 *   countryLabel  pre-localized country string from the parent
 *           (parent already uses Intl.DisplayNames + getCountryLabel).
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { cropLabel } from '../../utils/cropLabel.js';

function _formatSize(size, unit) {
  if (size == null || size === '') return null;
  const u = unit || 'acres';
  return `${size} ${u}`;
}

function _formatRelative(ts, fmtRelative) {
  if (!ts) return null;
  try {
    if (typeof fmtRelative === 'function') {
      const v = fmtRelative(ts);
      if (v) return v;
    }
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) return d.toLocaleDateString();
  } catch { /* ignore */ }
  return null;
}

function _hasGps(farm) {
  if (!farm) return false;
  if (Number.isFinite(Number(farm.gpsLat)) && Number.isFinite(Number(farm.gpsLng))) return true;
  if (farm.location && typeof farm.location === 'object'
      && Number.isFinite(Number(farm.location.lat))
      && Number.isFinite(Number(farm.location.lng))) return true;
  return false;
}

export default function FarmSummaryCard({ farm, lang = 'en', countryLabel = '' }) {
  // Subscribe to language change so labels refresh on flip.
  const { fmtRelative } = useTranslation();

  if (!farm) return null;

  // `crop` is the canonical field (canonicalizeFarmPayload in
  // lib/api.js strips the legacy alias on writes). Reading only
  // `farm.crop` here keeps the drift guard happy for new code.
  const crop  = cropLabel(farm.crop, lang);
  const stage = farm.cropStage || farm.stage;
  const stageLabel = stage
    ? tStrict(`stage.${stage}`, '')
    : '';
  const size  = _formatSize(farm.size || farm.farmSize, farm.sizeUnit);
  const place = countryLabel || farm.region || farm.location || '';
  const gpsOk = _hasGps(farm);
  const updated = _formatRelative(farm.updatedAt || farm.lastUpdatedAt || farm.lastUpdated, fmtRelative);

  // Single condensed subline — joins whichever of stage / size /
  // place are present with a `•` separator (matches the visual
  // reference). Each piece is independently optional, so a brand-new
  // farm with only a crop name still gets a clean header without a
  // straggling separator.
  const sublineParts = [stageLabel, size, place].filter(Boolean);
  const subline = sublineParts.join(' • ');

  // GPS status sits on a tiny line beneath the updated timestamp
  // when it's missing — visually subdued (warn tone). When present
  // we omit the line entirely to keep the card tight.
  const gpsWarn = !gpsOk ? tStrict('farm.gpsMissing', '') : '';

  return (
    <section style={S.card} data-testid="farm-summary-card">
      <header style={S.headerRow}>
        <h2 style={S.title}>
          {crop || tStrict('farm.summaryTitle', '')}
        </h2>
      </header>
      {subline && (
        <p style={S.subline} data-testid="farm-summary-subline">
          {subline}
        </p>
      )}
      {updated && (
        <p style={S.updated}>
          {tStrict('farm.lastUpdated', '')}: {updated}
        </p>
      )}
      {gpsWarn && (
        <p style={S.gpsWarn} data-testid="farm-summary-gps-warn">
          {tStrict('farm.gpsStatus', '')}: {gpsWarn}
        </p>
      )}
    </section>
  );
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '14px 16px',
    margin: '0 0 12px 0',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: '#fff',
  },
  subline: {
    margin: '4px 0 0',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.65)',
  },
  updated: {
    margin: '4px 0 0',
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.45)',
  },
  gpsWarn: {
    margin: '4px 0 0',
    fontSize: '0.7rem',
    color: '#FDE68A',
  },
};
