/**
 * VerificationStatusCard — 0–3 verification level + last photo +
 * last GPS timestamp.
 *
 * Level computation (deterministic, client-side from existing data):
 *
 *   level 0 — nothing on file
 *   level 1 — has either photo proof OR a GPS timestamp
 *   level 2 — has both photo proof AND a GPS timestamp
 *   level 3 — has both above AND a verified-action count > 0
 *
 * The component reads from `farm.verification` if the backend
 * surfaces it, otherwise falls back to per-field signals on the
 * farm object (`farm.lastPhotoAt`, `farm.lastGpsAt`,
 * `farm.verifiedActions`). Safe for rows where any/all fields are
 * missing — never crashes (spec §9).
 *
 * Visible text via tStrict; icons inline Lucide-style.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { ShieldCheck, Camera, MapPin } from '../icons/lucide.jsx';

function _formatRel(ts, fmtRelative) {
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

function _computeLevel({ photoAt, gpsAt, verifiedCount }) {
  let lvl = 0;
  if (photoAt || gpsAt) lvl = 1;
  if (photoAt && gpsAt) lvl = 2;
  if (photoAt && gpsAt && (Number(verifiedCount) || 0) > 0) lvl = 3;
  return lvl;
}

export default function VerificationStatusCard({ farm }) {
  const { fmtRelative } = useTranslation();
  if (!farm) return null;

  const v = farm.verification && typeof farm.verification === 'object' ? farm.verification : null;
  const photoAt        = v?.lastPhotoAt        ?? farm.lastPhotoAt        ?? farm.photoProofAt ?? null;
  const gpsAt          = v?.lastGpsAt          ?? farm.lastGpsAt          ?? null;
  const verifiedCount  = v?.verifiedActions    ?? farm.verifiedActions    ?? 0;
  const explicitLevel  = v?.level ?? farm.verificationLevel;

  const level = Number.isFinite(Number(explicitLevel))
    ? Math.max(0, Math.min(3, Number(explicitLevel)))
    : _computeLevel({ photoAt, gpsAt, verifiedCount });

  const dotsTone = level >= 3 ? 'high'
                 : level >= 2 ? 'mid'
                 : level >= 1 ? 'low'
                 :              'empty';

  const photoText = _formatRel(photoAt, fmtRelative);
  const gpsText   = _formatRel(gpsAt, fmtRelative);

  return (
    <section style={S.card} data-testid="verification-status-card">
      <header style={S.header}>
        <h2 style={S.title}>{tStrict('farm.verify.title', '')}</h2>
        <span style={S.levelChip} data-tone={dotsTone}>
          <ShieldCheck size={14} />
          <span style={{ marginLeft: 6 }}>
            {tStrict('farm.verify.level', '')} {level}/3
          </span>
        </span>
      </header>
      <div style={S.dotsWrap} aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              ...S.dot,
              background: n <= level ? '#22C55E' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>
      <ul style={S.list}>
        <li style={S.row}>
          <span style={S.iconWrap} aria-hidden="true"><Camera size={16} /></span>
          <span style={S.label}>{tStrict('farm.verify.lastPhoto', '')}</span>
          <span style={S.value}>{photoText || '—'}</span>
        </li>
        <li style={S.row}>
          <span style={S.iconWrap} aria-hidden="true"><MapPin size={16} /></span>
          <span style={S.label}>{tStrict('farm.verify.lastGps', '')}</span>
          <span style={S.value}>{gpsText || '—'}</span>
        </li>
      </ul>
    </section>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '16px 18px',
    margin: '0 0 12px 0',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  levelChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.4)',
    fontSize: '0.75rem', fontWeight: 700,
  },
  dotsWrap: { display: 'flex', gap: 6, marginBottom: 10 },
  dot: { width: 22, height: 6, borderRadius: 999 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '4px 0',
    fontSize: '0.9rem',
    color: '#fff',
  },
  iconWrap: { color: 'rgba(255,255,255,0.55)', display: 'inline-flex' },
  label:    { color: 'rgba(255,255,255,0.6)' },
  value:    { color: '#fff', fontWeight: 600, textAlign: 'right' },
};
