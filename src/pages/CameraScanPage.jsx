/**
 * CameraScanPage — DEPRECATED (May 2026 canonical scan-system lock).
 *
 *   ╔══════════════════════════════════════════════════════════╗
 *   ║                  ⚠  DEPRECATED — DO NOT EXTEND           ║
 *   ║                                                          ║
 *   ║  The canonical scan surface is `src/pages/ScanPage.jsx`. ║
 *   ║  This file ships only to keep historical lazy imports    ║
 *   ║  resolvable; on mount it redirects to `/scan`.           ║
 *   ║                                                          ║
 *   ║  New scan work goes into:                                ║
 *   ║    • src/pages/ScanPage.jsx           (entry route)      ║
 *   ║    • src/components/scan/ScanCapture.jsx                 ║
 *   ║    • src/components/scan/ScanAnalyzing.jsx               ║
 *   ║    • src/components/scan/ScanResultCard.jsx              ║
 *   ║    • src/lib/cameraLifecycle.js       (camera helper)    ║
 *   ║                                                          ║
 *   ║  Soil scan: src/pages/SoilScanPage.jsx (separate flow).  ║
 *   ║  Crash recovery: src/components/scan/ScanFallback.jsx    ║
 *   ║                  (embeds SafeCameraSurface).             ║
 *   ╚══════════════════════════════════════════════════════════╝
 *
 *   App.jsx already maps `/scan-crop` → `<Navigate to="/scan" />`
 *   so the route is unreachable through the router. The redirect
 *   in this component covers direct-import edge cases (stale
 *   lazy reference, saved home-screen shortcut, voice intent
 *   built before the consolidation).
 *
 *   May 2026 risk-cleanup pass — the legacy phase machine
 *   (ENTRY / LOADING / RESULT), the cameraDiagnosis engine, and
 *   the cameraDiagnosisHistory + cameraFollowup services were
 *   stripped. None of them have any other consumer; the
 *   tree-shaker dropped them from the production bundle but
 *   they were lingering in source. Now this file is a
 *   redirect-only shell — the canonical path is the only one
 *   that ships.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CameraScanPage() {
  const navigate = useNavigate();

  useEffect(() => {
    try { navigate('/scan', { replace: true }); }
    catch { /* never throw from a redirect effect */ }
  }, [navigate]);

  // Render nothing — the redirect runs as a microtask. SSR /
  // first-paint flashes are avoided because <Navigate replace>
  // also fires from App.jsx's route entry, so most callers
  // never even instantiate this component.
  return null;
}
