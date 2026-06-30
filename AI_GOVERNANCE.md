# AI Governance

Every AI / model / provider recommendation in Farroway must carry, and is gate-checked for:

- **Confidence** — honest, normalized + banded (high/medium/low). Never overstated.
- **Evidence source** — what the recommendation is based on.
- **Explanation** — human-readable reasoning a farmer understands.
- **Fallback** — a non-AI path when the provider fails (rule-based result).
- **Retry strategy** — transient failures retry; terminal failures (auth/credits/malformed) give up fast.
- **No fabrication** — never invent a diagnosis, confidence, price, or metric. "Unknown" is allowed.

## Enforced today
- Scan: `scanIdentificationBenchmark`, `check-no-scan-unclear`, `classifyProviderFailure`,
  `isRetriableScanFailure` (retry only transient), `FarmBrainScanIngestion.test` (a failed scan
  cannot corrupt data). Provider keys are server-side secrets; never called from the browser.
- Sell decision: `check-sell-decision` — 4 honest verdicts, never invents a price.
- Daily decision: `check-recommendation-engine-v1`, `check-decision-task-outcome-link` — action +
  reason + confidence + evidence + next step.
- Farmer-safe language: `check-farmer-facing-ai-language`, `check-scan-farmer-safe-language`,
  `check-decision-no-jargon` — no model/provider words reach a farmer.

## Field-pending
Real-image CV accuracy is measured on real scans via `/api/admin/scan/last-trace` (device/pilot),
not asserted from code. The pipeline is proven not to drop a good match; provider accuracy on real
photos is verified in the field.
