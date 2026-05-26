/**
 * JournalPage — Garden-mode growth journal.
 *
 * Garden Mode Refactor §4 — replaces Progress as the 4th garden
 * bottom-nav tab. The Journal surface is intentionally calm and
 * emotional: a chronological timeline of care moments, scans,
 * stage changes, flower/fruit notes, and harvest milestones.
 *
 * Data sources
 *   • usePlantTimeline()         — newest-first list of milestones
 *   • usePlantIdentity()         — current plant for the header card
 *
 * UX rules (spec §10 + §7)
 *   • One context (the active plant) at the top.
 *   • One insight per row in the timeline; no analytics.
 *   • One reassurance line at the bottom of an empty list.
 *   • No commercial language — "Plant", "Pot", "Bed". No funding,
 *     no sell, no buyer.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Hooks declared unconditionally.
 *   • Inline styles only — soft ochre / beige unified palette.
 *   • Localized via tSafe with English fallbacks.
 *   • SSR-safe; usePlantTimeline gracefully degrades to [].
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { useStrictTranslation } from '../i18n/useStrictTranslation.js';
import { PremiumPage, PremiumPageHero } from '../components/premium/index.js';
// Documentary farming moment for the Journal hero. Garden mode
// renders the greenhouse-work shot; farm-mode contexts default
// to the farm-inspection photo.
import { resolveJournalImage } from '../lib/realVisuals.jsx';
import usePlantTimeline from '../hooks/usePlantTimeline.js';
import usePlantIdentity from '../hooks/usePlantIdentity.js';
// Elite Garden spec §2 + §7 — calm observational line above the
// timeline. Pure module; never throws; returns null when the
// plant is brand-new and the caller falls through to the empty
// state.
import {
  selectPrimaryObservation, gardenSeason, gardenTimeOfDay,
} from '../lib/garden/gardenObservations.js';
import { useLiveWeather } from '../hooks/useLiveWeather.js';
// Polish §8 — photo evolution timeline. Pulls thumbnails from the
// scan history slot; merged with the active plant photo as the
// most recent frame. Pure read; never throws.
import { getScanHistory } from '../data/scanHistory.js';
// Gardener-tone substitution. Pure / never throws. Applied to the
// observation line so any farm-style wording that slips in via
// future engine changes still reads in the calm garden register.
import { softenForGarden } from '../core/scanResultPolicy.js';

function _formatDate(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return ''; }
}

function _formatTime(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function JournalPage() {
  useStrictTranslation();
  const navigate = useNavigate();
  const { entries, count, hasFirstScan, hasFirstFlower, hasFirstFruit } =
    usePlantTimeline(100);
  const { plant, hasPlant } = usePlantIdentity();
  // Live weather is read defensively — useLiveWeather accepts a
  // null location and returns its FALLBACK_WEATHER shape, so the
  // observation falls through to the stage / streak branches when
  // no coords are set.
  const { weather } = useLiveWeather(null);

  const milestoneCount =
    (hasFirstScan ? 1 : 0) + (hasFirstFlower ? 1 : 0) + (hasFirstFruit ? 1 : 0);

  // Elite Garden spec §2 — single calm observation line. Pure
  // selector over plant + timeline + weather; null when there's
  // nothing meaningful to say.
  const observation = useMemo(() => {
    try {
      return selectPrimaryObservation({
        plant,
        timeline: entries,
        weather,
      });
    } catch { return null; }
  }, [plant, entries, weather]);

  // Polish §8 — photo evolution strip. Gathers the plant photo +
  // up to 5 scan thumbnails, sorts newest-first, deduplicates.
  // Empty array when no photos exist yet so the strip self-
  // suppresses below.
  const photoStrip = useMemo(() => {
    const out = [];
    try {
      if (plant && plant.photo) {
        out.push({
          src: plant.photo,
          dateLabel: tSafe('journal.photo.now', 'Now'),
          key: 'plant-current',
        });
      }
    } catch { /* swallow */ }
    try {
      const scans = getScanHistory() || [];
      // Newest first; cap at 5.
      const recent = scans
        .filter((s) => s && s.thumbnail)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 5);
      for (const s of recent) {
        out.push({
          src: s.thumbnail,
          dateLabel: _formatDate(s.createdAt),
          key: 'scan-' + (s.id || s.createdAt || Math.random().toString(36).slice(2, 8)),
        });
      }
    } catch { /* swallow */ }
    return out;
  }, [plant, entries]);

  // Polish §2 + §3 — subtle seasonal/time-of-day accent on the
  // hero. We don't change the page background (that would feel
  // dramatic); we just shift the hero's accent token between
  // green (spring/summer growth feel) and amber (autumn / winter /
  // evening warm-earth tone) so the surface feels alive without
  // animation. PremiumPageHero supports 'green' | 'amber' |
  // 'neutral'; we never pass anything outside that set. Pure
  // synchronous read; recomputes once on mount.
  const heroAccent = useMemo(() => {
    try {
      const season = gardenSeason();
      const tod    = gardenTimeOfDay();
      if (tod === 'evening') return 'amber';
      if (season === 'autumn' || season === 'winter') return 'amber';
      return 'green';
    } catch { return 'green'; }
  }, []);

  return (
    <PremiumPage mode="garden" testId="journal-page" maxWidth="36rem" bottomPad="2rem">
      <PremiumPageHero
        mode="garden"
        eyebrow={tSafe('journal.eyebrow', 'Journal')}
        title={tSafe('journal.title', 'Your growth story')}
        subtitle={tSafe(
          'journal.subtitle',
          'Care moments, photos, and milestones — in the order they happened.',
        )}
        bgImage={resolveJournalImage('greenhouse') || undefined}
        accent={heroAccent}
        testId="journal-hero"
      />

      {/* Plant identity card — calm context line. Tap to edit. */}
      <section
        style={S.identityCard}
        data-testid="journal-identity"
        onClick={() => { try { navigate('/my-grow'); } catch { /* swallow */ } }}
      >
        <div style={S.identityRow}>
          <div style={S.identityAvatar} aria-hidden="true">
            {plant && plant.photo ? (
              <img src={plant.photo} alt="" style={S.avatarImg} />
            ) : (
              <span style={S.avatarFallback}>
                {String((plant && plant.nickname) || '').charAt(0).toUpperCase() || '—'}
              </span>
            )}
          </div>
          <div style={S.identityText}>
            <span style={S.identityName}>
              {(plant && plant.nickname) ||
                tSafe('plant.fallback.nickname', 'My Plant')}
            </span>
            <span style={S.identityMeta}>
              {hasPlant && plant && plant.plantType
                ? tSafe('crop.' + plant.plantType, plant.plantType)
                : tSafe('journal.identity.tap', 'Tap to set up your plant')}
            </span>
          </div>
        </div>
      </section>

      {/* Today's observation — Elite Garden spec §2 + §7. Single
          calm line surfaced above the milestones; self-suppresses
          when no signal qualifies, so an empty journal stays
          peaceful. The line is i18n-passthrough: the helper
          generates English copy; tSafe resolves it through the
          fallback overlay if a localized variant exists. */}
      {observation ? (
        <section style={S.observationCard} data-testid="journal-observation">
          <span style={S.observationLabel}>
            {tSafe('journal.observation.label', 'Today')}
          </span>
          <span style={S.observationText}>
            {(() => {
              const resolved = tSafe(
                'journal.observation.' + observation,
                observation,
              );
              return softenForGarden(resolved) || resolved;
            })()}
          </span>
        </section>
      ) : null}

      {/* Photo evolution strip — Polish §8. Calm horizontal scroll
          of plant + scan thumbnails over time. Self-suppresses when
          there are no photos yet so a brand-new journal stays
          minimal. */}
      {photoStrip.length > 0 && (
        <section style={S.photoStripCard} data-testid="journal-photos">
          <p style={S.cardLabel}>
            {tSafe('journal.photos.label', 'Photo timeline')}
          </p>
          <div style={S.photoStripScroll} data-testid="journal-photos-scroll">
            {photoStrip.map((p) => (
              <figure key={p.key} style={S.photoFrame}>
                <img src={p.src} alt="" style={S.photoImg} draggable="false" />
                <figcaption style={S.photoCaption}>{p.dateLabel}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Milestone summary — three calm stat chips. Hidden when zero
          milestones so an empty journal stays peaceful. */}
      {milestoneCount > 0 && (
        <section style={S.statRow} data-testid="journal-milestones">
          <div style={S.statChip}>
            <span style={S.statValue}>{count}</span>
            <span style={S.statLabel}>
              {tSafe('journal.stat.moments', 'Moments')}
            </span>
          </div>
          {hasFirstScan && (
            <div style={S.statChip}>
              <span style={S.statValue}>
                {tSafe('journal.stat.scanned.value', 'Yes')}
              </span>
              <span style={S.statLabel}>
                {tSafe('journal.stat.scanned', 'First scan')}
              </span>
            </div>
          )}
          {hasFirstFlower && (
            <div style={S.statChip}>
              <span style={S.statValue}>
                {tSafe('journal.stat.flowered.value', 'Yes')}
              </span>
              <span style={S.statLabel}>
                {tSafe('journal.stat.flowered', 'First flower')}
              </span>
            </div>
          )}
          {hasFirstFruit && (
            <div style={S.statChip}>
              <span style={S.statValue}>
                {tSafe('journal.stat.fruited.value', 'Yes')}
              </span>
              <span style={S.statLabel}>
                {tSafe('journal.stat.fruited', 'First fruit')}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Timeline — full list, newest first. */}
      <section style={S.card} data-testid="journal-timeline-card">
        <p style={S.cardLabel}>
          {tSafe('journal.timeline.label', 'Care moments')}
        </p>
        {entries && entries.length > 0 ? (
          <ul style={S.list} data-testid="journal-timeline-list">
            {entries.map((entry) => (
              <li key={entry.id} style={S.row}>
                <span style={S.rowEmoji} aria-hidden="true">{entry.emoji}</span>
                <div style={S.rowText}>
                  <span style={S.rowMessage}>
                    {(() => {
                      // V5 production fix — older entries persisted
                      // their LOCALIZED message string as
                      // `messageKey` (e.g. "Kazi ya utunzaji
                      // imekamilika") instead of the dotted key.
                      // When the user later switches language, that
                      // literal string leaks Swahili / French / etc.
                      // through to the active locale.
                      //
                      // Detect "looks like a key" (must contain at
                      // least one dot AND no spaces) and translate
                      // accordingly. Anything else routes through
                      // the canonical 'plant.timeline.generic' key
                      // so the entry renders in the active locale.
                      const raw = entry && typeof entry.messageKey === 'string'
                        ? entry.messageKey : '';
                      const looksLikeKey = raw.includes('.') && !/\s/.test(raw);
                      if (looksLikeKey) {
                        return tSafe(
                          raw,
                          entry.params && entry.params.nickname
                            ? String(entry.params.nickname)
                            : raw,
                          entry.params,
                        );
                      }
                      // Legacy literal payload — surface the canonical
                      // "Care moment" copy in the active locale.
                      return tSafe('plant.timeline.generic', 'Care moment');
                    })()}
                  </span>
                  <span style={S.rowDate}>
                    {_formatDate(entry.createdAt)}
                    {_formatTime(entry.createdAt)
                      ? ' · ' + _formatTime(entry.createdAt)
                      : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={S.empty} data-testid="journal-empty">
            <p style={S.emptyTitle}>
              {tSafe('journal.empty.title', 'Your journal is waiting')}
            </p>
            <p style={S.emptyBody}>
              {tSafe(
                'journal.empty.body',
                'Care moments will appear here as you tend to your plant — first scan, first flower, first harvest.',
              )}
            </p>
            <button
              type="button"
              onClick={() => { try { navigate('/scan'); } catch { /* swallow */ } }}
              style={S.emptyCta}
              className="ff-tap"
              data-testid="journal-empty-scan"
            >
              {tSafe('journal.empty.cta', 'Scan your plant')}
            </button>
          </div>
        )}
      </section>
    </PremiumPage>
  );
}

// ─── Inline styles (unified Soft Ochre / Beige system) ────────────

const S = {
  identityCard: {
    padding: '0.85rem 1rem',
    borderRadius: 16,
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.08)',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#FFF9F0',
    border: '1px solid rgba(36,49,58,0.10)',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7A5A28',
    fontWeight: 800,
    fontSize: 18,
  },
  avatarImg:      { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { letterSpacing: '0.03em' },
  identityText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  identityName: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#1F2933',
  },
  identityMeta: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#667085',
  },

  photoStripCard: {
    padding: '0.85rem 1rem',
    borderRadius: 16,
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  photoStripScroll: {
    display: 'flex',
    flexDirection: 'row',
    gap: '0.55rem',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: 4,
    WebkitOverflowScrolling: 'touch',
  },
  photoFrame: {
    margin: 0,
    flex: '0 0 auto',
    width: 84,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  photoImg: {
    width: 84,
    height: 84,
    borderRadius: 12,
    objectFit: 'cover',
    background: '#FFF9F0',
    border: '1px solid rgba(36,49,58,0.10)',
    display: 'block',
  },
  photoCaption: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#667085',
    lineHeight: 1.3,
    textAlign: 'center',
  },

  observationCard: {
    padding: '0.75rem 0.95rem',
    borderRadius: 14,
    background: 'linear-gradient(180deg, rgba(200,148,77,0.10) 0%, rgba(200,148,77,0.04) 100%)',
    border: '1px solid rgba(200,148,77,0.30)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  observationLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#7A5A28',
  },
  observationText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#1F2933',
    lineHeight: 1.45,
  },

  statRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  statChip: {
    flex: '1 1 auto',
    minWidth: '6rem',
    padding: '0.6rem 0.75rem',
    borderRadius: 12,
    background: '#FFF9F0',
    border: '1px solid rgba(200,148,77,0.30)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statValue: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#7A5A28',
    letterSpacing: '-0.01em',
  },
  statLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085',
  },

  card: {
    padding: '1rem',
    borderRadius: 16,
    background: '#FFFFFF',
    border: '1px solid rgba(36,49,58,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  cardLabel: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    background: '#FFF9F0',
    border: '1px solid rgba(36,49,58,0.06)',
  },
  rowEmoji: {
    fontSize: '1.1rem',
    lineHeight: 1.4,
    flexShrink: 0,
  },
  rowText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  rowMessage: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#1F2933',
    lineHeight: 1.4,
  },
  rowDate: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#667085',
  },

  empty: {
    padding: '0.5rem 0.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#1F2933',
  },
  emptyBody: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#667085',
    lineHeight: 1.5,
  },
  emptyCta: {
    appearance: 'none',
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    padding: '0.7rem 1.1rem',
    borderRadius: 999,
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 24px rgba(200,148,77,0.32)',
  },
};
