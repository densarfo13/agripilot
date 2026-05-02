/**
 * OnboardingFlow \u2014 redirect-only shim.
 *
 * Status: REDIRECT-ONLY (production-hardening risk follow-up).
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * The legacy 6-step Simple Onboarding body that lived here
 * (Farmer type \u2192 Location \u2192 Language \u2192 Crop \u2192 Farm setup \u2192 Plan
 * preview) is superseded by the canonical 4-step path at
 * /onboarding/start (FastFlow \u2192 QuickGardenSetup / QuickFarmSetup).
 * Only the canonical path receives:
 *   \u2022 versioned + sanitised draft I/O,
 *   \u2022 the 8-event onboarding telemetry funnel,
 *   \u2022 the polished Step 0 language picker + experience tile pick,
 *   \u2022 predefined plant / crop tiles + search,
 *   \u2022 garden-specific growing-setup picker,
 *   \u2022 farm-specific acre buckets,
 *   \u2022 user-friendly recovery card wording.
 *
 * The /onboarding/simple route stays REGISTERED in App.jsx so
 * pre-existing deep links / scripts don't 404; landing here
 * triggers an unconditional redirect to /onboarding/start. The
 * legacy 6-step body lives in git history at commit 136541a^
 * (the production-hardening commit's parent).
 *
 * Risk closed: the legacy flow used to be reachable via a
 * feature flag (default true) and divergence between the two
 * paths meant every fix had to land twice. The redirect
 * collapses traffic into the polished path regardless of any
 * flag state.
 *
 * Strict-rule audit
 *   \u2022 No imports beyond React + react-router. No telemetry, no
 *     storage I/O \u2014 those concerns belong to the canonical flow.
 *   \u2022 Never throws \u2014 the navigate call is wrapped.
 *   \u2022 Renders null after dispatching the redirect so the user
 *     sees the canonical screen on the next render tick (or the
 *     router transition, whichever wins).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

const CANONICAL_ENTRY = '/onboarding/start';

export default function OnboardingFlow() {
  const navigate = useNavigate();
  React.useEffect(() => {
    try { navigate(CANONICAL_ENTRY, { replace: true }); }
    catch { /* router failure shouldn't block render */ }
  }, [navigate]);
  return null;
}
