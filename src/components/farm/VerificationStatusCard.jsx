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
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Camera, MapPin, CheckCircle } from '../icons/lucide.jsx';

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
  const navigate = useNavigate();
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

  // Spec §7 — explicit empty-state copy + a "Improve Verification"
  // checklist of three tasks the farmer can act on. Each item has
  // a `done` flag derived from the same signals the level uses.
  const checklist = [
    {
      key:      'photoProof',
      labelKey: 'farm.verify.checklist.photo',
      fallback: 'Add photo proof',
      done:     !!photoAt,
    },
    {
      key:      'gpsProof',
      labelKey: 'farm.verify.checklist.gps',
      fallback: 'Allow GPS verification',
      done:     !!gpsAt,
    },
    {
      key:      'verifiedAction',
      labelKey: 'farm.verify.checklist.action',
      fallback: 'Complete verified task',
      done:     (Number(verifiedCount) || 0) > 0,
    },
  ];

  const photoEmpty = tStrict('farm.verify.lastPhoto.empty', 'No photo proof yet');
  const gpsEmpty   = tStrict('farm.verify.lastGps.empty',   'No GPS proof yet');

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
      {/* Trust copy: explains WHY the level matters. */}
      <p style={S.lead}>
        {tStrict('farm.verify.lead',
          'Increase trust with buyers, NGOs, and funding partners.')}
      </p>

      <ul style={S.list}>
        <li style={S.row}>
          <span style={S.iconWrap} aria-hidden="true"><Camera size={16} /></span>
          <span style={S.label}>{tStrict('farm.verify.lastPhoto', '')}</span>
          <span style={photoText ? S.value : S.valueMuted}>
            {photoText || photoEmpty}
          </span>
        </li>
        <li style={S.row}>
          <span style={S.iconWrap} aria-hidden="true"><MapPin size={16} /></span>
          <span style={S.label}>{tStrict('farm.verify.lastGps', '')}</span>
          <span style={gpsText ? S.value : S.valueMuted}>
            {gpsText || gpsEmpty}
          </span>
        </li>
      </ul>

      {/* Improve-verification checklist — three tasks with green
          ticks for the ones already done. */}
      <ul style={S.checklist} data-testid="verification-checklist">
        {checklist.map((item) => (
          <li
            key={item.key}
            style={{ ...S.checkRow, opacity: item.done ? 0.7 : 1 }}
            data-done={item.done || undefined}
          >
            <span
              style={{
                ...S.checkIcon,
                color: item.done ? '#86EFAC' : 'rgba(255,255,255,0.35)',
              }}
              aria-hidden="true"
            >
              <CheckCircle size={14} />
            </span>
            <span
              style={{
                ...S.checkLabel,
                textDecoration: item.done ? 'line-through' : 'none',
              }}
            >
              {tStrict(item.labelKey, item.fallback)}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA — disabled when level is already 3 (full).
          Risk-2 fix: the most direct way to bump verification is
          to complete a task with photo + GPS proof, which happens
          on the Today page (PrimaryTaskCard's complete-with-photo
          flow). Routing there is more action-oriented than
          dropping the farmer into the edit-farm form. Edit-farm
          is still reachable from the Quick Actions card. */}
      {level < 3 && (
        <button
          type="button"
          style={S.cta}
          data-testid="verification-improve-cta"
          onClick={() => { try { navigate('/today'); } catch { /* ignore */ } }}
        >
          {tStrict('farm.verify.cta.improve', 'Improve verification')}
        </button>
      )}
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
  // Empty-state value cell: subdued, italic, no decoration —
  // distinguishes "No photo proof yet" from a real timestamp.
  valueMuted: {
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    textAlign: 'right',
    fontSize: '0.85rem',
  },
  lead: {
    margin: '0 0 10px',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.4,
  },
  checklist: {
    listStyle: 'none',
    margin: '12px 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.85)',
  },
  checkIcon: { display: 'inline-flex' },
  checkLabel: { lineHeight: 1.3 },
  cta: {
    marginTop: 14,
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    borderRadius: 10,
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
  },
};
