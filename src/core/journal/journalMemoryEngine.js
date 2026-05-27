/**
 * journalMemoryEngine.js — single source for Journal moments.
 *
 *   import { buildJournalMoments, MOMENT_KIND }
 *     from 'src/core/journal/journalMemoryEngine.js';
 *
 *   const v = buildJournalMoments(activeFarm, { locale });
 *
 *   v = {
 *     moments: [{ kind, atMs, title, detail, scanId? }],
 *     showStarterContinuity,  — true when activeFarm exists but no scans
 *     starterContinuityCards: [{ key, fallback, params }],
 *     setupIncomplete:        — true ONLY when activeFarm is empty
 *     engineVersion: 'journal-memory-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   The Journal surface's read-only data source. Fixes the
 *   production bug: "Journal still says setup incomplete even
 *   though Home/Tasks/Progress/Sell all see the crop."
 *
 *   Decision rules (in priority order):
 *
 *     1. activeFarm.cropId missing AND no scans
 *          → setupIncomplete = true
 *            (legitimate empty state)
 *
 *     2. activeFarm.cropId present BUT no scans yet
 *          → setupIncomplete = false
 *            showStarterContinuity = true
 *            starterContinuityCards: 2–3 calm prompts
 *
 *     3. activeFarm + scans
 *          → setupIncomplete = false
 *            showStarterContinuity = false
 *            moments: detected milestones (delegates to
 *            livingMemoryEngine for the heavy lifting)
 *
 *   Compose-only — reads activeFarm only, never localStorage,
 *   never any other store.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is `{key, fallback, params}`.
 */

import { buildLivingMemory } from './livingMemoryEngine.js';

const ENGINE_VERSION = 'journal-memory-v1';

export const MOMENT_KIND = Object.freeze({
  FARM_CREATED:      'farm_created',
  CROP_SELECTED:     'crop_selected',
  LOCATION_ADDED:    'location_added',
  FIRST_SCAN:        'first_scan_completed',
  TASK_COMPLETED:    'task_completed',
  STAGE_STARTED:     'stage_started',
  RECOVERY_NOTED:    'recovery_noted',
  HARVEST_READY:     'harvest_ready',
  PRODUCE_LISTED:    'produce_listed',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Auto-milestone detectors ────────────────────────────────

function _farmCreatedMoment(farm) {
  if (!farm || !farm.id) return null;
  const atMs = _num(farm.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind: MOMENT_KIND.FARM_CREATED,
    atMs,
    title: Object.freeze({
      key:      'journal.moment.farmCreated.title',
      fallback: 'Farm setup started',
    }),
    detail: Object.freeze({
      key:      'journal.moment.farmCreated.detail',
      fallback: 'Your Farroway journey began here.',
    }),
  });
}

function _cropSelectedMoment(farm) {
  if (!farm || !farm.cropId) return null;
  const crop = _str(farm.localizedCropName) || _str(farm.cropId);
  const atMs = _num(farm.updatedAt) || _num(farm.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind: MOMENT_KIND.CROP_SELECTED,
    atMs,
    title: Object.freeze({
      key:      'journal.moment.cropSelected.title',
      fallback: '{crop} added',
      params:   { crop },
    }),
    detail: Object.freeze({
      key:      'journal.moment.cropSelected.detail',
      fallback: 'Now tracking the {crop} journey on your farm.',
      params:   { crop },
    }),
  });
}

function _locationAddedMoment(farm) {
  if (!farm || !farm.location) return null;
  const atMs = _num(farm.updatedAt) || _num(farm.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind: MOMENT_KIND.LOCATION_ADDED,
    atMs,
    title: Object.freeze({
      key:      'journal.moment.locationAdded.title',
      fallback: 'Location set',
    }),
    detail: Object.freeze({
      key:      'journal.moment.locationAdded.detail',
      fallback: 'Weather + regional intelligence now tuned to {location}.',
      params:   { location: _str(farm.location) },
    }),
  });
}

function _stageStartedMoment(farm) {
  const stage = _str(farm && farm.lifecycleStage).toLowerCase();
  if (!stage) return null;
  const atMs = _num(farm.updatedAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind: MOMENT_KIND.STAGE_STARTED,
    atMs,
    title: Object.freeze({
      key:      'journal.moment.stageStarted.title',
      fallback: 'Stage: {stage}',
      params:   { stage },
    }),
    detail: Object.freeze({
      key:      'journal.moment.stageStarted.detail',
      fallback: 'A new chapter of the {crop} journey.',
      params:   { crop: _str(farm.localizedCropName) || _str(farm.cropId) || 'crop' },
    }),
  });
}

function _producListedMoment(farm) {
  const sell = _isObj(farm && farm.sellState) ? farm.sellState : {};
  if (!sell.hasActiveListing && !sell.listedAt) return null;
  const atMs = _num(sell.listedAt) || _num(farm.updatedAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind: MOMENT_KIND.PRODUCE_LISTED,
    atMs,
    title: Object.freeze({
      key:      'journal.moment.produceListed.title',
      fallback: 'Produce listed',
    }),
    detail: Object.freeze({
      key:      'journal.moment.produceListed.detail',
      fallback: 'Your {crop} is now on the marketplace.',
      params:   { crop: _str(farm.localizedCropName) || _str(farm.cropId) || 'crop' },
    }),
  });
}

// ─── Starter continuity (Journal §6 + §14) ───────────────────

function _starterContinuityCards(farm) {
  const cards = [];
  const crop = _str(farm.localizedCropName) || _str(farm.cropId);
  const location = _str(farm.location);
  if (crop && location) {
    cards.push(Object.freeze({
      key:      'journal.starter.cropAndLocation',
      fallback: '{crop} journey started in {location}.',
      params:   { crop, location },
    }));
  } else if (crop) {
    cards.push(Object.freeze({
      key:      'journal.starter.cropOnly',
      fallback: '{crop} care journey started.',
      params:   { crop },
    }));
  }
  if (crop) {
    cards.push(Object.freeze({
      key:      'journal.starter.firstScanCue',
      fallback: 'First scan will appear here after checking your {crop}.',
      params:   { crop },
    }));
  }
  const stage = _str(farm.lifecycleStage).toLowerCase();
  if (stage === 'land_prep' || stage === 'planting' || stage === 'germination') {
    cards.push(Object.freeze({
      key:      'journal.starter.earlyStage',
      fallback: 'Your farm is in {stage}. Small daily care builds the foundation.',
      params:   { stage },
    }));
  }
  return cards.slice(0, 3);
}

// ─── Public ──────────────────────────────────────────────────

/**
 * Build the Journal moments envelope from activeFarm.
 */
export function buildJournalMoments(activeFarm, opts) {
  return _safe(() => {
    const farm = _isObj(activeFarm) ? activeFarm : null;
    const o = _isObj(opts) ? opts : {};
    const locale = _str(o.locale) || null;

    // Empty-farm case — legitimate setup-incomplete state.
    if (!farm || (!farm.id && !farm.cropId && !farm.name)) {
      return Object.freeze({
        engineVersion: ENGINE_VERSION,
        moments:       Object.freeze([]),
        showStarterContinuity:  false,
        starterContinuityCards: Object.freeze([]),
        setupIncomplete:        true,
        locale,
        generatedAt:            Date.now(),
      });
    }

    // Collect auto-detected moments from activeFarm shape.
    const auto = [];
    const _push = (m) => { if (m) auto.push(m); };
    _push(_farmCreatedMoment(farm));
    _push(_cropSelectedMoment(farm));
    _push(_locationAddedMoment(farm));
    _push(_stageStartedMoment(farm));
    _push(_producListedMoment(farm));

    // Compose with livingMemoryEngine for scan/outcome milestones.
    const living = _safe(() => buildLivingMemory({
      scanHistory:  farm.scanHistory,
      scanOutcomes: o.scanOutcomes,
    }), { milestones: [] });

    const moments = [...auto, ...((living && living.milestones) || [])];
    moments.sort((a, b) => b.atMs - a.atMs);
    const capped = moments.slice(0, 20);

    const scans = Array.isArray(farm.scanHistory) ? farm.scanHistory : [];
    const showStarterContinuity = scans.length === 0
      && !!farm.cropId
      && capped.length <= 3;

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      moments:       Object.freeze(capped),
      showStarterContinuity,
      starterContinuityCards: Object.freeze(
        showStarterContinuity ? _starterContinuityCards(farm) : [],
      ),
      setupIncomplete: false,
      locale,
      generatedAt:     Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    moments:       Object.freeze([]),
    showStarterContinuity:  false,
    starterContinuityCards: Object.freeze([]),
    setupIncomplete:        true,
    locale:                 null,
    generatedAt:            Date.now(),
  });
}

export const _internal = Object.freeze({
  _farmCreatedMoment, _cropSelectedMoment, _locationAddedMoment,
  _stageStartedMoment, _producListedMoment, _starterContinuityCards,
  ENGINE_VERSION,
});

const _module = { buildJournalMoments, MOMENT_KIND, _internal };
export default _module;
