import React, { useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import {
  computeTrustLevel, trustColor, trustLabel,
} from '../lib/verification/trustSignals.js';

/**
 * TrustBadge — compact trust / completeness pill that farmers,
 * buyers, and NGO admins see next to a farmer's name.
 *
 * Tap / hover reveals a per-check list so the farmer knows
 * exactly what to do to lift their level (e.g. "Upload a field
 * photo +15"). No opaque AI — every signal is labelled.
 *
 * Props
 *   farmer   — { fullName, phoneVerifiedAt, country, region, …  }
 *   farm     — { crop, region, latitude, longitude, photoUrl, … }
 *   recentActivity — optional { lastEventAt, events }
 *   level    — override when the server has already scored
 *   compact  — show the pill without expandable detail
 *   variant  — 'full' | 'chip' | 'dot'  (default 'full')
 */
export default function TrustBadge({
  farmer = null, farm = null, recentActivity = null,
  level: levelOverride = null,
  compact = false, variant = 'full',
  precomputed = null,
}) {
  const { t } = useTranslation();

  // When the parent already has the trust object (e.g. from the
  // server) pass it via `precomputed` to avoid re-running the
  // engine. Otherwise compute from the shape we have.
  const trust = useMemo(() => {
    if (precomputed) return precomputed;
    return computeTrustLevel({ farmer, farm, recentActivity });
  }, [precomputed, farmer, farm, recentActivity]);

  const level = levelOverride || trust.level;
  const color = trustColor(level);

  const [open, setOpen] = useState(false);

  if (variant === 'dot') {
    return (
      <span aria-label={trustLabel(level, t)}
            style={{
              display: 'inline-block', width: 8, height: 8,
              borderRadius: '50%', background: color,
            }}
            data-testid="trust-dot"
            title={trustLabel(level, t)} />
    );
  }

  if (variant === 'chip' || compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '2px 8px', borderRadius: 999,
        background: `${color}28`, color,
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.3,
      }} data-testid="trust-chip" title={`${trust.score}/100`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} aria-hidden />
        {trustLabel(level, t)}
      </span>
    );
  }

  // Full badge with expandable check panel.
  const scoreText = `${trust.score}/100 · ${trust.passedCount}/${trust.totalCount}`;
  return (
    <div style={styles.wrap} data-testid="trust-badge">
      <button type="button" style={{
              ...styles.pill,
              background: `${color}1A`, borderColor: `${color}66`, color,
            }}
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
            data-testid="trust-badge-toggle">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} aria-hidden />
        <span>{trustLabel(level, t)}</span>
        <span style={styles.score}>{scoreText}</span>
        <span style={{ ...styles.caret, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <ul style={styles.list} data-testid="trust-badge-checks">
          {trust.checks.map((c) => (
            <li key={c.id} style={styles.item} data-testid={`trust-check-${c.id}`}>
              <span style={{
                ...styles.dot,
                background: c.passed ? '#86EFAC' : 'rgba(148,163,184,0.55)',
              }} aria-hidden />
              <div style={styles.itemMain}>
                <div style={{ ...styles.itemTitle,
                              color: c.passed ? '#E6F4EA' : 'rgba(230,244,234,0.75)' }}>
                  {(t(`trust.check.${c.id}`) !== `trust.check.${c.id}`)
                    ? t(`trust.check.${c.id}`) : c.label}
                  <span style={styles.weight}> +{c.weight}</span>
                </div>
                <div style={styles.itemExplain}>{c.explanation}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: 'inline-block', position: 'relative' },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '4px 10px', borderRadius: 999,
    border: '1px solid', cursor: 'pointer', fontSize: 12,
    fontWeight: 600, letterSpacing: 0.2,
  },
  score: { fontSize: 10, opacity: 0.85, fontWeight: 500, marginLeft: 4 },
  caret: { fontSize: 10, transition: 'transform 120ms ease' },
  list: {
    listStyle: 'none', padding: 8, marginTop: 6,
    display: 'flex', flexDirection: 'column', gap: 6,
    borderRadius: 12,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: 260, maxWidth: 360,
    position: 'absolute', zIndex: 5, left: 0, top: '100%',
  },
  item: {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    padding: '6px 8px', borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 12, fontWeight: 600 },
  weight:    { fontSize: 10, color: 'rgba(230,244,234,0.55)', marginLeft: 4 },
  itemExplain:{
    fontSize: 11, color: 'rgba(230,244,234,0.65)', marginTop: 2, lineHeight: 1.35,
  },
};
