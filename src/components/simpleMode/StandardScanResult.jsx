/**
 * StandardScanResult.jsx — Standard Mode scan-result renderer (hard-split
 * partner of SimpleScanResult).
 *
 * The actual standard scan-result rendering lives in the wave-36 frozen
 * scan flow (ScanResultCard) and is intentionally NOT modified here.
 * This file exists as a named symbol so the diagnostic
 * (window.__simpleModeHealth().scanComponent === 'StandardScanResult')
 * and the governance gate can attest which renderer Simple Mode would
 * delegate to when disabled.
 *
 * It renders nothing visible — the scan flow itself owns its render.
 */

import React from 'react';

export default function StandardScanResult() {
  return <div data-testid="standard-scan-result" data-renderer="standard" />;
}
