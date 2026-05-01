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
import { getScanEntry } from '../data/scanHistory.js';
import { addScanTasks } from '../core/scanToTask.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import ScanResultCard from '../components/scan/ScanResultCard.jsx';

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
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
    color: '#22C55E',
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
    color: 'rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.10)',
    borderRadius: 14,
  },
  cta: {
    marginTop: 12,
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
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
  const entry = useMemo(() => {
    try { return getScanEntry(scanId); } catch { return null; }
  }, [scanId]);

  const [tasksAdded, setTasksAdded] = useState(false);

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
        <ScanResultCard
          result={entry.raw}
          experience={entry.experience || 'generic'}
          onRetake={() => { try { navigate('/scan'); } catch { /* ignore */ } }}
          onAddTasks={onAddTasks}
          alreadyAddedTasks={tasksAdded}
        />
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
