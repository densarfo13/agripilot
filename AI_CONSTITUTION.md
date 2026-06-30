# AI Constitution

Binding law for every recommendation. Detailed how-to: AI_GOVERNANCE.md.

## Every recommendation must include
Evidence · Confidence · Explanation · Fallback · Retry · Human language.

## Two absolutes
- **Unknown is acceptable.**
- **Guessing is prohibited.** Never fabricate a diagnosis, confidence, price, or metric.

## Enforced by
- Scan honesty + no-generic-failure: `check-no-scan-unclear`, `classifyProviderFailure`,
  `isRetriableScanFailure` (retry transient only), `FarmBrainScanIngestion.test` (failed scan never
  corrupts data).
- Sell decision: `check-sell-decision` (never invents a price).
- Daily decision contract: `check-recommendation-engine-v1`, `check-decision-task-outcome-link`.
- Farmer-safe wording: `check-farmer-facing-ai-language`, `check-scan-farmer-safe-language`,
  `check-decision-no-jargon`.
- Secrets: provider keys are server-side only; never logged, never in the browser.

## Field-pending
Real-image accuracy is verified on real scans (`/api/admin/scan/last-trace`), not asserted from code.
