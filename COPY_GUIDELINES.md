# Copy Guidelines

Every sentence a farmer reads must be **simple, actionable, farmer-first**.

## Reading level
- **Maximum Grade 6.** Short sentences. Common words. One idea per line.
- Action-first: "Inspect onion leaf tips" — not "Monitoring of foliar symptoms is advised."

## Never show backend / internal terminology
Banned in farmer-facing text (enforced by `check:home-no-internal-terms`, `check:decision-no-jargon`,
`check:farmer-facing-ai-language`, `check:scan-farmer-safe-language`):

`FarmBrain · provider · API · model · backend · debug · evidence tier · confidence engine ·
data quality engine`

Approved replacements: Recommendation confidence · Farm readiness · Scan your crop · Record what happened.

## Honesty (hard rule)
- Never fabricate a diagnosis, confidence, treatment, price, or metric.
- "We couldn't read this photo clearly" + a next step — never a generic "Unknown" or "Scan unclear".
- Failure copy = **what happened · why · what to do next** (no stack traces, no error codes).

## Recommendations always carry
What to do · Why · Confidence (honest) · Evidence · What could change it · Next step.

## Localization (6 locales)
English · Twi · French · Hausa · Hindi · Swahili. Rules (enforced by `check:language-consistency`
+ the parity ratchet):
- All visible strings via the i18n layer (`tSafe`/`tStrict`) — **no hardcoded English** in core UI.
- No raw translation keys ever shown.
- Missing key → fall back to English (honest), and log it. Never a blank or a key.
- Copy must not clip/overflow — Twi/Hausa/Swahili run longer than English; design for +40% length.
- Hindi is hidden in the picker until its ~3k keys are translated (intentional; `enableHindiLocale=false`).

## Tone
Calm, confident, warm. Encourage, never alarm. The app is a companion, not a compliance system.
