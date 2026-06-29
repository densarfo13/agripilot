# Farroway — CTO Scorecard (weekly template)

Computed every Friday. This is a **template**: fill the Status/Evidence columns from real
build + telemetry at compute time. **Do not invent scores or metrics** — an unmeasured
dimension is marked `not-yet-measured`, not given a number.

> Rule: a number appears here only if it came from `build:safe`, a test, or production
> telemetry. Pre-pilot, business/usage rows are honestly `N/A (pre-pilot)`.

| Dimension | How measured | Status (fill weekly) |
|---|---|---|
| **Product** | KPIs moved this week (trust/productivity/accuracy/reliability/pilot) | _____ |
| **Engineering** | `build:safe` step count + all-green; open bugs; regressions caught by gates | _____ |
| **AI / Scan** | scan-id benchmark pass; real scan-success rate (when available) | _____ |
| **UX** | onboarding completion; time-to-first-value; dead-ends found | _____ |
| **Performance** | first-paint / interactive; GPS acquisition time; needless re-fetches | _____ |
| **Security** | secrets-in-logs = 0; admin routes gated; redaction holds | _____ |
| **Business** | DAU / retention | `N/A (pre-pilot)` until live |
| **Pilot Readiness** | [PILOT_GATE.md](PILOT_GATE.md) items code-green + field-pending count | _____ |
| **Overall** | one-line honest verdict + the single highest-ROI next task | _____ |

## How to compute (honestly)

1. Run `npm run build:safe`; record the step count + PASS/FAIL.
2. Pull production metrics for the [release metrics](RELEASE_POLICY.md) — definitions + real
   values, or `N/A` if not yet collected.
3. Check the [STOP conditions](RELEASE_POLICY.md): any regression vs last week halts the
   release.
4. Write one honest sentence for **Overall** and name the single highest-ROI next task,
   per the [priority order](ENGINEERING_PRINCIPLES.md).
