/**
 * ScanResultPage — deep-link detail view for a stored scan.
 *
 * Route: /scan/result/:scanId
 *
 * Reads from `data/scanHistory.js`. Shows ScanResultCard with the
 * stored result plus a "Back to scans" affordance. If the scanId
 * doesn't match a stored entry, renders a friendly "scan not
 * found" state and a CTA back to /scan.
 *
 * Strict-rule audit
 *   • Off-flag bounce to /scan-crop (same as ScanPage).
 *   • All visible text via tStrict.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { useScanHistory } from '../hooks/useScanHistory.js';
import { addScanTasks } from '../core/scanToTask.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import ScanResultCard from '../components/scan/ScanResultCard.jsx';
import { computeProduceIntelligence } from '../features/scan/ProduceIntelligenceEngine/index.js';
import ProduceQualityBadge from '../components/produce/ProduceQualityBadge.jsx';
import { composeReferenceImagesForScan } from '../runtime/plants/index';
import { knowledgeForPlant } from '../knowledge/index';
import PlantImage from '../components/plants/PlantImage.jsx';

// Soft Ochre / Beige unified system. Replaces the legacy
// dark-navy + neon-green inline tokens with the locked palette so
// the result page matches every other surface.
const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  back: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: '#C8944D',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0,
    alignSelf: 'flex-start',
    fontFamily: 'inherit',
  },
  notFound: {
    padding: '20px 16px',
    textAlign: 'center',
    color: '#667085',
    background: '#FFF9F0',
    border: '1px dashed rgba(36,49,58,0.10)',
    borderRadius: 14,
  },
  cta: {
    marginTop: 12,
    appearance: 'none',
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    fontWeight: 700,
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
  },
};

export default function ScanResultPage() {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const flagOn = isFeatureEnabled('scanDetection');

  const scanId = params?.scanId || '';
  // Runtime-governed scan history reader. The hook owns the
  // cross-tab refresh + falls back to the store on a miss so the
  // deep-link detail view stays consistent.
  const { getEntry } = useScanHistory();
  const entry = useMemo(() => {
    try { return getEntry(scanId); } catch { return null; }
  }, [scanId, getEntry]);

  const [tasksAdded, setTasksAdded] = useState(false);

  // Produce-intelligence badge — render only for scans that look
  // produce-flavored (orchestrator's FRUIT_RIPENESS / PRODUCE_QUALITY
  // intents, or any entry that carries ripenessStage / qualityFlag).
  // For crop-health scans the engine would still produce an envelope,
  // but the badge would be semantically wrong on those surfaces.
  const produceIntel = useMemo(() => {
    const raw = entry && entry.raw;
    if (!raw || typeof raw !== 'object') return null;
    const looksProduce =
      raw.ripenessStage ||
      raw.qualityFlag ||
      raw.scanType === 'fruit_ripeness' ||
      raw.scanType === 'produce_quality';
    if (!looksProduce) return null;
    try {
      return computeProduceIntelligence({
        scan: raw,
        crop: entry?.cropId || entry?.plantName || raw.subjectDetected || raw.cropName,
      });
    } catch { return null; }
  }, [entry]);

  // Verified Plant Media System — pull reference photography for
  // the identified plant + any matched diseases / pests so the
  // scan result reads as "your photo ↔ verified references".
  // composeReferenceImagesForScan always returns a frozen envelope
  // (never throws); when nothing matches, every bucket is empty
  // and we hide the section.
  const referenceMedia = useMemo(() => {
    const raw = entry && entry.raw;
    if (!raw || typeof raw !== 'object') return null;
    const slug = String(raw.plantId || raw.cropId
      || entry?.cropId || entry?.plantName || '')
      .toLowerCase().replace(/\s+/g, '-');
    if (!slug) return null;
    try {
      return composeReferenceImagesForScan({
        plantId:    slug,
        region:     String(raw.region || entry?.region || ''),
        diseaseIds: Array.isArray(raw.diseaseIds)
          ? raw.diseaseIds.map(String) : [],
        pestIds:    Array.isArray(raw.pestIds)
          ? raw.pestIds.map(String) : [],
        maxRef:     6,
      });
    } catch { return null; }
  }, [entry]);

  // Farroway Knowledge Layer — canonical lookupPlantKnowledge
  // after the scan identifies a plant. Returns care guide,
  // common risks, today's tasks, pollinator info, companions.
  const scanKnowledge = useMemo(() => {
    const raw = entry && entry.raw;
    if (!raw || typeof raw !== 'object') return null;
    const slug = String(raw.plantId || raw.cropId
      || entry?.cropId || entry?.plantName || '')
      .toLowerCase().replace(/\s+/g, '-');
    if (!slug) return null;
    try { return knowledgeForPlant(slug); }
    catch { return null; }
  }, [entry]);

  useEffect(() => {
    if (!flagOn) {
      try { navigate('/scan-crop', { replace: true }); } catch { /* ignore */ }
    }
  }, [flagOn, navigate]);

  const onAddTasks = useCallback(() => {
    if (!entry?.raw) return;
    try {
      const stored = addScanTasks(entry.raw.suggestedTasks, {
        scanId:    entry.id,
        farmId:    entry.farmId,
        experience: entry.experience,
      });
      if (stored.length > 0) setTasksAdded(true);
      try { trackEvent('scan_task_created', { scanId: entry.id, count: stored.length, source: 'history' }); }
      catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [entry]);

  if (!flagOn) return null;

  return (
    <main style={STYLES.page} data-screen="scan-result-page" data-scan-id={scanId}>
      <button
        type="button"
        onClick={() => { try { navigate('/scan'); } catch { /* ignore */ } }}
        style={STYLES.back}
      >
        {'\u2190 '}{tStrict('scan.history.backToScans', 'Back to scans')}
      </button>

      {entry?.raw ? (
        <>
          <ScanResultCard
            result={entry.raw}
            experience={entry.experience || 'generic'}
            onRetake={() => { try { navigate('/scan'); } catch { /* ignore */ } }}
            onAddTasks={onAddTasks}
            alreadyAddedTasks={tasksAdded}
          />
          {produceIntel ? (
            <ProduceQualityBadge intel={produceIntel} variant="seller" />
          ) : null}

          {scanKnowledge && scanKnowledge.ok ? (
            <section data-testid="scan-result-knowledge" style={{
              background: '#FFFFFF',
              border: '1px solid rgba(31,41,51,0.08)',
              borderRadius: 14,
              padding: '14px 14px 8px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            marginBottom: 8 }}>
                {tStrict('scan.result.knowledge.title',
                  'From the Knowledge Layer')}
              </div>
              {scanKnowledge.plant ? (
                <div style={{ fontSize: 13, color: '#1F2933', marginBottom: 8 }}>
                  <strong>{scanKnowledge.plant.commonName}</strong>
                  {scanKnowledge.plant.scientificName
                    ? ' · ' + scanKnowledge.plant.scientificName : ''}
                </div>
              ) : null}
              {scanKnowledge.plant && scanKnowledge.plant.careGuide
                  && scanKnowledge.plant.careGuide.water ? (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  <strong>{tStrict('scan.result.knowledge.water', 'Water')}:</strong>
                  {' ' + scanKnowledge.plant.careGuide.water}
                </div>
              ) : null}
              {scanKnowledge.todaysTasks
                  && scanKnowledge.todaysTasks.length > 0 ? (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                                 textTransform: 'uppercase', letterSpacing: '0.06em',
                                 marginBottom: 4 }}>
                    {tStrict('scan.result.knowledge.todaysTasks', "Today")}
                  </div>
                  {scanKnowledge.todaysTasks.map((t, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#1F2933', padding: '2px 0' }}>
                      ✓ {tStrict(t.labelKey, t.labelDefault)}
                    </div>
                  ))}
                </div>
              ) : null}
              {scanKnowledge.pollinator && scanKnowledge.pollinator.ok
                  && scanKnowledge.pollinator.score != null ? (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  <strong>{tStrict('scan.result.knowledge.pollinator', 'Pollinator score')}:</strong>
                  {' ' + scanKnowledge.pollinator.score + ' / 10'}
                  {scanKnowledge.pollinator.attracts
                    && scanKnowledge.pollinator.attracts.length > 0
                    ? ' · attracts ' + scanKnowledge.pollinator.attracts.join(', ')
                    : ''}
                </div>
              ) : null}
              {scanKnowledge.companions && scanKnowledge.companions.ok
                  && scanKnowledge.companions.good
                  && scanKnowledge.companions.good.length > 0 ? (
                <div style={{ fontSize: 12, color: '#475569' }}>
                  <strong>{tStrict('scan.result.knowledge.companions', 'Companions')}:</strong>
                  {' ' + scanKnowledge.companions.good
                    .map((c) => c.commonName).join(', ')}
                </div>
              ) : null}
            </section>
          ) : null}

          {referenceMedia && (
            (referenceMedia.plantReferences && referenceMedia.plantReferences.length > 0)
            || (referenceMedia.diseaseReferences && referenceMedia.diseaseReferences.length > 0)
            || (referenceMedia.pestReferences && referenceMedia.pestReferences.length > 0)
          ) ? (
            <section data-testid="scan-result-reference-images" style={{
              background: '#FFFFFF',
              border: '1px solid rgba(31,41,51,0.08)',
              borderRadius: 14,
              padding: '14px 14px 8px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            marginBottom: 8 }}>
                {tStrict('scan.result.references.title', 'Reference plant images')}
              </div>
              {referenceMedia.plantReferences && referenceMedia.plantReferences.length > 0 ? (
                <div style={{ display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                              gap: 6, marginBottom: 10 }}>
                  {referenceMedia.plantReferences.map((m) => (
                    <PlantImage
                      key={m.id}
                      plantId={m.plantId}
                      plantLibraryImage={m.imageUrl}
                      alt={m.plantId}
                      size="thumb"
                      testid={'scan-result-reference-' + m.id}
                      style={{ width: '100%', height: 80, borderRadius: 8 }}
                    />
                  ))}
                </div>
              ) : null}
              {referenceMedia.diseaseReferences && referenceMedia.diseaseReferences.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9B4747',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                marginBottom: 6 }}>
                    {tStrict('scan.result.references.diseases', 'Possible disease references')}
                  </div>
                  <div style={{ display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                                gap: 6, marginBottom: 10 }}>
                    {referenceMedia.diseaseReferences.map((m) => (
                      <div key={m.id} style={{ textAlign: 'center' }}>
                        <PlantImage
                          plantId={m.plantId}
                          plantLibraryImage={m.imageUrl}
                          alt={m.plantId}
                          size="thumb"
                          testid={'scan-result-disease-' + m.plantId}
                          style={{ width: '100%', height: 80, borderRadius: 8 }}
                        />
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                          {m.plantId}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {referenceMedia.pestReferences && referenceMedia.pestReferences.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9B4747',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                marginBottom: 6 }}>
                    {tStrict('scan.result.references.pests', 'Possible pest references')}
                  </div>
                  <div style={{ display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                                gap: 6 }}>
                    {referenceMedia.pestReferences.map((m) => (
                      <div key={m.id} style={{ textAlign: 'center' }}>
                        <PlantImage
                          plantId={m.plantId}
                          plantLibraryImage={m.imageUrl}
                          alt={m.plantId}
                          size="thumb"
                          testid={'scan-result-pest-' + m.plantId}
                          style={{ width: '100%', height: 80, borderRadius: 8 }}
                        />
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                          {m.plantId}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <div style={STYLES.notFound} data-testid="scan-result-not-found">
          {tStrict(
            'scan.result.notFound',
            'We couldn\u2019t find that scan on this device. It may have been cleared.'
          )}
          <div>
            <button
              type="button"
              onClick={() => { try { navigate('/scan'); } catch { /* ignore */ } }}
              style={STYLES.cta}
            >
              {tStrict('scan.result.takeNew', 'Take a new photo')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
