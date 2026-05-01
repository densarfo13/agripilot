/**
 * QuickApplyKit — "Prepare before applying" panel.
 *
 * Spec coverage (Funding upgrade §3)
 *   • Heading: "Prepare before applying"
 *   • Includes: crop, location, farm type
 *
 * Each row shows the user's current value when known + a quiet
 * "missing" marker when not — no alarm-tone styling, the goal is
 * to nudge profile completeness, not punish absence.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational. Reads nothing — caller passes `profile`.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const S = {
  panel: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  heading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
  },
  rowLabel: {
    color: 'rgba(255,255,255,0.6)',
    minWidth: 86,
  },
  rowValue: {
    color: '#fff',
    fontWeight: 600,
  },
  rowMissing: {
    color: '#FDE68A',
    fontWeight: 500,
    fontStyle: 'italic',
  },
};

const FARM_TYPE_LABEL_KEY = {
  small_farm:   'funding.kit.farmType.small',
  commercial:   'funding.kit.farmType.commercial',
  backyard:     'funding.kit.farmType.backyard',
  home_garden:  'funding.kit.farmType.backyard',
  cooperative:  'funding.kit.farmType.cooperative',
};

export default function QuickApplyKit({ profile = {}, style }) {
  useTranslation();

  const cropRaw = String(profile?.crop || profile?.plantId || '').trim();
  const cropLabel = cropRaw
    ? cropRaw.charAt(0).toUpperCase() + cropRaw.slice(1)
    : '';

  const locationRaw = [profile?.region, profile?.country]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim())
    .join(', ');

  const farmTypeRaw = String(profile?.farmType || '').trim().toLowerCase();
  const farmTypeLabel = farmTypeRaw
    ? tStrict(
        FARM_TYPE_LABEL_KEY[farmTypeRaw] || `funding.kit.farmType.${farmTypeRaw}`,
        farmTypeRaw.replace(/_/g, ' '),
      )
    : '';

  const missingLabel = tStrict('funding.kit.missing', 'Add to profile');

  return (
    <div style={{ ...S.panel, ...(style || null) }} data-testid="funding-quick-apply-kit">
      <h4 style={S.heading}>
        {tStrict('funding.kit.title', 'Prepare before applying')}
      </h4>

      <div style={S.row} data-testid="funding-kit-crop">
        <span style={S.rowLabel}>{tStrict('funding.kit.crop', 'Crop')}</span>
        {cropLabel ? (
          <span style={S.rowValue}>{cropLabel}</span>
        ) : (
          <span style={S.rowMissing}>{missingLabel}</span>
        )}
      </div>

      <div style={S.row} data-testid="funding-kit-location">
        <span style={S.rowLabel}>{tStrict('funding.kit.location', 'Location')}</span>
        {locationRaw ? (
          <span style={S.rowValue}>{locationRaw}</span>
        ) : (
          <span style={S.rowMissing}>{missingLabel}</span>
        )}
      </div>

      <div style={S.row} data-testid="funding-kit-farm-type">
        <span style={S.rowLabel}>{tStrict('funding.kit.farmType', 'Farm type')}</span>
        {farmTypeLabel ? (
          <span style={S.rowValue}>{farmTypeLabel}</span>
        ) : (
          <span style={S.rowMissing}>{missingLabel}</span>
        )}
      </div>
    </div>
  );
}
