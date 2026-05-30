/**
 * PlantProfile.jsx — single plant detail page.
 *
 *   <Route path="/my-plants/:plantId" element={<PlantProfile />} />
 *
 * What this is
 * ────────────
 *   Reads one managed plant from localStorage + the event log,
 *   then renders the full universalPlantRuntime composite for
 *   it: identity, health, tasks, lifecycle, recommendations,
 *   timeline (date-grouped), memory counts.
 *
 *   Persistence stays at the UI layer (wave-5: engines never
 *   write). This page only READS storage.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Read-only against localStorage.
 *   • No camera flow on this route.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { universalPlantRuntime, plantIntelligence,
         composePlantGallery,
         composePlantEntry, findDisease, findPest }
  from '../runtime/plants/index';
import { knowledgeForPlant } from '../knowledge/index';
import { loadManagedPlants } from '../runtime/data/managedPlants.js';
import PlantImage from '../components/plants/PlantImage.jsx';
// CPO retention pass — wave-26 C-3 migrated the canonical event
// log from 'farroway_event_log' to 'farroway.farmEvents'. The
// pilot-feedback workflow (H-6) caught that PlantProfile still
// read the old key, leaving the per-plant timeline permanently
// empty. Route through the canonical reader instead.
import { getCanonicalActivityEvents } from '../runtime/launchBlockers/ActivityDataHealthRuntime';
// Wave-28 — read-only harvest history surface. Only renders when
// isSupportedPlant() returns true for the current plant.
import { getLatestForPlant, isSupportedPlant }
  from '../runtime/harvest';

function _readEvents() {
  try {
    const list = getCanonicalActivityEvents();
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  back: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    padding: '6px 0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 8,
  },
  hero: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '18px 16px',
    marginBottom: 14,
  },
  name: { fontSize: 22, fontWeight: 800, color: '#1F2933',
          margin: '0 0 2px' },
  sci:  { fontSize: 13, fontStyle: 'italic', color: '#64748B',
          margin: '0 0 8px' },
  meta: { fontSize: 13, color: '#475569' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 14,
  },
  stat: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '10px 12px',
  },
  statLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8',
               textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue: { fontSize: 22, fontWeight: 800, color: '#1F2933',
               marginTop: 4 },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginTop: 16, marginBottom: 8,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 8,
  },
  taskRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid rgba(31,41,51,0.06)',
  },
  taskBullet: {
    color: '#16A34A', fontSize: 14, lineHeight: '20px', flexShrink: 0,
  },
  timelineDate: {
    fontSize: 11, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '10px 0 4px',
  },
  timelineEntry: {
    fontSize: 13, color: '#1F2933',
    padding: '6px 8px',
    background: 'rgba(31,41,51,0.04)',
    borderRadius: 8,
    marginBottom: 4,
  },
  emptyText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic',
               margin: 0 },
  notFound: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '20px 18px',
    textAlign: 'center',
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginTop: 10,
  },
};

export default function PlantProfile() {
  const { plantId } = useParams();
  const navigate = useNavigate();

  const runtime = useMemo(() => {
    const plants = loadManagedPlants();
    const events = _readEvents();
    return universalPlantRuntime({
      plants,
      events,
      focusPlantId: plantId,
    });
  }, [plantId]);

  const focused = runtime && runtime.focused;
  if (!focused) {
    return (
      <main style={S.page} data-testid="plant-profile-page" data-state="not-found">
        <button type="button" style={S.back}
          onClick={() => navigate('/my-plants')}
          data-testid="plant-profile-back">
          {tSafe('plantProfile.back', '← My Plants')}
        </button>
        <div style={S.notFound}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
            {tSafe('plantProfile.notFound.title', 'Plant not found')}
          </h2>
          <p style={S.emptyText}>
            {tSafe('plantProfile.notFound.body',
              'This plant is not in your collection yet.')}
          </p>
          <button type="button" style={S.cta}
            onClick={() => navigate('/scan')}>
            {tSafe('plantProfile.notFound.cta', 'Scan a plant')}
          </button>
        </div>
      </main>
    );
  }

  const tasks    = runtime && runtime.tasks;
  const timeline = runtime && runtime.timeline;
  const memCounts = runtime && runtime.memory && runtime.memory.counts;
  const taskList = tasks && Array.isArray(tasks.taskEnvelope &&
    tasks.taskEnvelope.tasks) ? tasks.taskEnvelope.tasks : [];

  // Gap-fix §8 — compose plant intelligence for flowers so the
  // profile renders bloom + pollinator + companion cards. The
  // catalog plant id is derived from the lower-cased common name.
  const catalogId = String(focused.commonName || '')
    .toLowerCase().replace(/\s+/g, '_');
  const intel = catalogId
    ? plantIntelligence({ plantId: catalogId,
                          lifecycleStage: focused.lifecycleStage,
                          haveInGarden: [] })
    : null;
  const isFlower = focused.category === 'flower';

  // Verified Plant Media System — gallery + diseases + stage
  // photography for the focused plant. Pure read-only over the
  // boot-seeded PlantMediaRegistry.
  const gallery = catalogId
    ? composePlantGallery({
        plantId:        catalogId,
        lifecycleStage: focused.lifecycleStage,
        maxGallery:     8,
        maxDiagnostic:  6,
      })
    : null;

  // Farroway Knowledge Layer — canonical source of truth.
  // Returns the joined envelope: plant + diseases + pests +
  // companions + pollinator + todaysTasks in one call.
  const know = catalogId ? knowledgeForPlant(catalogId) : null;
  const knowledge = know && know.ok ? know.plant : null;
  const careGuide = knowledge && knowledge.careGuide;
  const growthStages = knowledge && knowledge.growthStages;
  const linkedDiseases = (know && know.ok && know.diseases) || [];
  const linkedPests    = (know && know.ok && know.pests)    || [];
  const companions     = know && know.ok ? know.companions  : null;
  const pollinator     = know && know.ok ? know.pollinator  : null;

  return (
    <main style={S.page} data-testid="plant-profile-page" data-plant-id={focused.id}>
      <button type="button" style={S.back}
        onClick={() => navigate('/my-plants')}
        data-testid="plant-profile-back">
        {tSafe('plantProfile.back', '← My Plants')}
      </button>

      <section style={S.hero} data-testid="plant-profile-hero">
        <PlantImage
          plantId={catalogId}
          plantLibraryImage={focused.imageUrl}
          scanImage={focused.thumbnailUrl}
          scanGallery={focused.galleryImages}
          alt={focused.commonName}
          size="hero"
          testid="plant-profile-image"
          style={{ marginBottom: 10 }}
        />
        <h1 style={S.name}>{focused.commonName}</h1>
        {focused.scientificName ? (
          <p style={S.sci}>{focused.scientificName}</p>
        ) : null}
        <p style={S.meta}>
          {tSafe('plantProfile.stage', 'Stage')}: {focused.lifecycleStage || focused.growthStage || '—'}
          {focused.subtype ? ' · ' + focused.subtype : ''}
        </p>
      </section>

      <div style={S.statsRow}>
        <div style={S.stat} data-testid="plant-profile-stat-health">
          <div style={S.statLabel}>{tSafe('plantProfile.health', 'Health')}</div>
          <div style={S.statValue}>{focused.healthScore}</div>
        </div>
        <div style={S.stat} data-testid="plant-profile-stat-risk">
          <div style={S.statLabel}>{tSafe('plantProfile.risk', 'Risk')}</div>
          <div style={S.statValue}>{focused.riskScore}</div>
        </div>
        <div style={S.stat} data-testid="plant-profile-stat-tasks">
          <div style={S.statLabel}>{tSafe('plantProfile.tasks', 'Tasks')}</div>
          <div style={S.statValue}>{taskList.length}</div>
        </div>
      </div>

      <div style={S.sectionTitle}>
        {tSafe('plantProfile.tasksToday', 'Tasks today')}
      </div>
      <div style={S.card} data-testid="plant-profile-tasks">
        {taskList.length === 0 ? (
          <p style={S.emptyText}>
            {tSafe('plantProfile.tasks.empty', 'No tasks today.')}
          </p>
        ) : taskList.map((t, i) => (
          <div key={i} style={S.taskRow}>
            <div style={S.taskBullet}>✓</div>
            <div>{tSafe(t.labelKey, t.labelDefault)}</div>
          </div>
        ))}
      </div>

      {/* Gap-fix §8 — flower-specific cards (bloom forecast,
          pollinator value, companion suggestions). Self-hides
          for non-flower categories. Safe wording: "Expected
          bloom window" — never "guaranteed". */}
      {isFlower && intel && intel.ok ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.bloom', 'Bloom forecast')}
          </div>
          <div style={S.card} data-testid="plant-profile-bloom">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2933' }}>
              {tSafe('plantProfile.bloom.window',
                intel.bloom && intel.bloom.safeWording
                  ? intel.bloom.safeWording
                  : 'Expected bloom window')}
              {intel.bloom && intel.bloom.estimatedDaysToBloom != null
                ? ' · ~' + intel.bloom.estimatedDaysToBloom + ' days'
                : ''}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              {tSafe('plantProfile.bloom.status', 'Status')}:
              {' ' + (intel.bloom && intel.bloom.status
                       ? intel.bloom.status : 'unknown')}
              {' · '}
              {tSafe('plantProfile.bloom.confidence', 'Confidence')}:
              {' ' + (intel.bloom && intel.bloom.confidence
                       ? intel.bloom.confidence : 'unknown')}
            </div>
          </div>

          {/* Wave-28 — Harvest section. Only renders when the
              plant is in the supported set; the runtime returns
              category:'unknown' otherwise and we suppress the
              block. Reads the canonical history (single-writer
              localStorage owned by HarvestReadinessRuntime). */}
          {(() => {
            const pid = (plant && (plant.id || plant.plantId || plant.commonName)) || '';
            if (!isSupportedPlant(pid)) return null;
            const latest = getLatestForPlant(pid);
            if (!latest) return null;
            const status = latest.ripenessStatus || 'unknown';
            const window = latest.estimatedHarvestWindow || '—';
            const score  = latest.harvestReadinessScore || 0;
            const headline =
              status === 'ready'        ? tSafe('harvest.headline.ready',     'Likely ready to harvest') :
              status === 'almost_ready' ? tSafe('harvest.headline.almost',    'Appears almost ready') :
              status === 'not_ready'    ? tSafe('harvest.headline.notReady',  'Not ready yet') :
              status === 'overripe'     ? tSafe('harvest.headline.needsLook', 'Needs another look') :
                                          tSafe('harvest.headline.unclear',   'Readiness unclear');
            return (
              <>
                <div style={S.sectionTitle}>
                  {tSafe('plantProfile.harvest', 'Harvest')}
                </div>
                <div style={S.card} data-testid="plant-profile-harvest">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2933' }}>
                    {headline}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    {tSafe('plantProfile.harvest.score', 'Readiness score')}:
                    {' '}<strong>{score}</strong>
                    {' · '}{tSafe('plantProfile.harvest.window', 'Expected window')}:
                    {' '}<strong>{window}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    {tSafe('plantProfile.harvest.last', 'Latest scan')}:
                    {' '}{latest.timestamp ? latest.timestamp.slice(0, 10) : '—'}
                  </div>
                </div>
              </>
            );
          })()}

          <div style={S.sectionTitle}>
            {tSafe('plantProfile.pollinator', 'Pollinator')}
          </div>
          <div style={S.card} data-testid="plant-profile-pollinator">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2933' }}>
              {tSafe('plantProfile.pollinator.score', 'Pollinator score')}:
              {' '}{intel.pollinator && typeof intel.pollinator.score === 'number'
                ? intel.pollinator.score : '—'}
            </div>
            {intel.pollinator && Array.isArray(intel.pollinator.attracts)
                && intel.pollinator.attracts.length > 0 ? (
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                {tSafe('plantProfile.pollinator.attracts', 'Attracts')}:
                {' ' + intel.pollinator.attracts.join(', ')}
              </div>
            ) : null}
          </div>

          {intel.companions && intel.companions.ok
              && Array.isArray(intel.companions.goodCompanions)
              && intel.companions.goodCompanions.length > 0 ? (
            <>
              <div style={S.sectionTitle}>
                {tSafe('plantProfile.companions', 'Companions')}
              </div>
              <div style={S.card} data-testid="plant-profile-companions">
                {intel.companions.goodCompanions.slice(0, 5).map((g) => (
                  <div key={g.id} style={{
                    fontSize: 13, color: '#1F2933',
                    padding: '4px 0',
                  }}>
                    ✓ <strong>{g.commonName || g.id}</strong>
                    {g.reason ? ' — ' + g.reason : ''}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {knowledge ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.facts', 'Plant facts')}
          </div>
          <div style={S.card} data-testid="plant-profile-facts">
            <div style={{ fontSize: 13, color: '#1F2933' }}>
              {knowledge.subtype ? (
                <div style={{ padding: '4px 0' }}>
                  <strong>{tSafe('plantProfile.family', 'Family')}:</strong>
                  {' ' + knowledge.subtype}
                </div>
              ) : null}
              <div style={{ padding: '4px 0' }}>
                <strong>{tSafe('plantProfile.water', 'Water')}:</strong>
                {' ' + (knowledge.waterNeed || '—')}
                {' · '}
                <strong>{tSafe('plantProfile.sun', 'Sun')}:</strong>
                {' ' + (knowledge.sunlightNeed || '—')}
              </div>
              <div style={{ padding: '4px 0' }}>
                <strong>{tSafe('plantProfile.soil', 'Soil')}:</strong>
                {' ' + (knowledge.soilNeed || '—')}
              </div>
              {knowledge.bloomMonths && knowledge.bloomMonths.length > 0 ? (
                <div style={{ padding: '4px 0' }}>
                  <strong>{tSafe('plantProfile.bloomMonths', 'Blooms')}:</strong>
                  {' ' + knowledge.bloomMonths.join(', ')}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {pollinator && pollinator.ok && pollinator.score != null ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.pollinatorIntel', 'Pollinator intelligence')}
          </div>
          <div style={S.card} data-testid="plant-profile-pollinator-intel">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2933' }}>
              {tSafe('plantProfile.pollinator.score', 'Pollinator score')}:
              {' ' + pollinator.score + ' / 10'}
              {' · '}
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                {pollinator.band}
              </span>
            </div>
            {pollinator.attracts && pollinator.attracts.length > 0 ? (
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                {tSafe('plantProfile.pollinator.attracts', 'Attracts')}:
                {' ' + pollinator.attracts.join(', ')}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {companions && companions.ok
          && ((companions.good && companions.good.length > 0)
              || (companions.avoid && companions.avoid.length > 0)) ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.companionPlanting', 'Companion planting')}
          </div>
          <div style={S.card} data-testid="plant-profile-companion-planting">
            {companions.good && companions.good.length > 0 ? (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A',
                               textTransform: 'uppercase', letterSpacing: '0.06em',
                               marginBottom: 4 }}>
                  {tSafe('plantProfile.companions.good', 'Good companions')}
                </div>
                {companions.good.map((c) => (
                  <div key={c.id} style={{ fontSize: 13, color: '#1F2933', padding: '2px 0' }}>
                    ✓ {c.commonName}
                  </div>
                ))}
              </div>
            ) : null}
            {companions.avoid && companions.avoid.length > 0 ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C',
                               textTransform: 'uppercase', letterSpacing: '0.06em',
                               marginBottom: 4 }}>
                  {tSafe('plantProfile.companions.avoid', 'Avoid planting near')}
                </div>
                {companions.avoid.map((c) => (
                  <div key={c.id} style={{ fontSize: 13, color: '#1F2933', padding: '2px 0' }}>
                    ✗ {c.commonName}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {careGuide && Object.keys(careGuide).length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.careGuide', 'Care guide')}
          </div>
          <div style={S.card} data-testid="plant-profile-care-guide">
            {['water','sun','soil','fertilizer','pruning','temperature','notes']
              .filter((k) => careGuide[k])
              .map((k) => (
                <div key={k} style={{ padding: '6px 0',
                                       borderBottom: '1px solid rgba(31,41,51,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8',
                                 textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {tSafe('plantProfile.care.' + k, k)}
                  </div>
                  <div style={{ fontSize: 13, color: '#1F2933', marginTop: 2 }}>
                    {careGuide[k]}
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : null}

      {growthStages && growthStages.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.growthStagesList', 'Growth stages')}
          </div>
          <div style={S.card} data-testid="plant-profile-growth-stages">
            {growthStages.map((g, i) => (
              <div key={i} style={{ padding: '6px 0',
                                     borderBottom: '1px solid rgba(31,41,51,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2933' }}>
                  {g.stage}
                  {typeof g.durationDays === 'number'
                    ? ' · ~' + g.durationDays + ' days' : ''}
                </div>
                {g.description ? (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {g.description}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {linkedDiseases.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.commonDiseases', 'Common diseases')}
          </div>
          <div style={S.card} data-testid="plant-profile-common-diseases">
            {linkedDiseases.map((d) => (
              <div key={d.id} style={{ padding: '8px 0',
                                        borderBottom: '1px solid rgba(31,41,51,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2933' }}>
                  {d.name}
                </div>
                {d.symptoms && d.symptoms[0] ? (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {d.symptoms[0]}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {linkedPests.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.commonPests', 'Common pests')}
          </div>
          <div style={S.card} data-testid="plant-profile-common-pests">
            {linkedPests.map((p) => (
              <div key={p.id} style={{ padding: '8px 0',
                                        borderBottom: '1px solid rgba(31,41,51,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2933' }}>
                  {p.name}
                </div>
                {p.symptoms && p.symptoms[0] ? (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {p.symptoms[0]}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {gallery && gallery.gallery && gallery.gallery.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.gallery', 'Gallery')}
          </div>
          <div style={S.card} data-testid="plant-profile-gallery">
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                          gap: 6 }}>
              {gallery.gallery.map((m) => (
                <PlantImage
                  key={m.id}
                  plantId={m.plantId}
                  plantLibraryImage={m.imageUrl}
                  alt={focused.commonName}
                  size="thumb"
                  testid={'plant-profile-gallery-' + m.id}
                  style={{ width: '100%', height: 96, borderRadius: 8 }}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {gallery && gallery.diseases && gallery.diseases.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.diseases', 'Disease references')}
          </div>
          <div style={S.card} data-testid="plant-profile-diseases">
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                          gap: 6 }}>
              {gallery.diseases.map((m) => (
                <div key={m.id} style={{ textAlign: 'center' }}>
                  <PlantImage
                    plantId={m.plantId}
                    plantLibraryImage={m.imageUrl}
                    alt={m.plantId}
                    size="thumb"
                    testid={'plant-profile-disease-' + m.plantId}
                    style={{ width: '100%', height: 80, borderRadius: 8 }}
                  />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    {m.plantId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {gallery && gallery.stages && gallery.stages.length > 0 ? (
        <>
          <div style={S.sectionTitle}>
            {tSafe('plantProfile.growthStages', 'Growth stage')}
          </div>
          <div style={S.card} data-testid="plant-profile-stages">
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                          gap: 6 }}>
              {gallery.stages.map((m) => (
                <PlantImage
                  key={m.id}
                  plantId={m.plantId}
                  plantLibraryImage={m.imageUrl}
                  alt={m.lifecycleStage || focused.commonName}
                  size="card"
                  testid={'plant-profile-stage-' + m.id}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div style={S.sectionTitle}>
        {tSafe('plantProfile.timeline', 'Timeline')}
      </div>
      <div style={S.card} data-testid="plant-profile-timeline">
        {(!timeline || timeline.totalCount === 0) ? (
          <p style={S.emptyText}>
            {tSafe('plantProfile.timeline.empty',
              'No history yet — scans and tasks will appear here.')}
          </p>
        ) : timeline.groups.slice(0, 6).map((g) => (
          <div key={g.date}>
            <div style={S.timelineDate}>{g.date}</div>
            {g.entries.slice(0, 4).map((e) => (
              <div key={e.id} style={S.timelineEntry}
                data-testid={`plant-profile-timeline-${e.kind}`}>
                <strong>{e.kind}</strong>
                {e.summary ? ' — ' + e.summary : ''}
              </div>
            ))}
          </div>
        ))}
      </div>

      {memCounts ? (
        <div style={{ ...S.card, ...{ fontSize: 12, color: '#64748B' } }}
          data-testid="plant-profile-memory-counts">
          {tSafe('plantProfile.memory', 'Memory')}:
          {' '}{memCounts.scans} {tSafe('plantProfile.mem.scans', 'scans')}
          {' · '}{memCounts.tasks} {tSafe('plantProfile.mem.tasks', 'tasks')}
          {' · '}{memCounts.treatments} {tSafe('plantProfile.mem.treatments', 'treatments')}
          {' · '}{memCounts.stages} {tSafe('plantProfile.mem.stages', 'stage changes')}
        </div>
      ) : null}
    </main>
  );
}
