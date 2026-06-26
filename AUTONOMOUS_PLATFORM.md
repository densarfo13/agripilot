# AUTONOMOUS_PLATFORM — Farroway v15

v15 extends the platform (existing APIs compatible, production certification kept).
The spec asks FarmBrain to become an "autonomous reasoning engine"; most of that
would require fabricating numbers v15's own AI-SAFETY section forbids. So v15 ships
the one genuinely real, high-value piece and declares the rest.

## Built real (live)
- **Farmer Copilot** (`src/runtime/farmos15/FarmerCopilot.ts`): a deterministic,
  explainable natural-language router. It maps a farmer's plain question to the
  EXISTING honest engines and returns their real output:
  - *"What should I do today?"* → Farm Agent morning plan (real signals).
  - *"When should I harvest?"* → crop calendar harvest window (real with a planting date).
  - *"Will rain affect spraying?"* → live weather-risk engine.
  - *"Why is my maize yellow?"* → routes to a photo **Scan** (we diagnose from an
    image, not a worded guess).
  - *"Estimate my profit."* → **honest decline** (confidence 0): no price/cost feed,
    so it won't guess; points to logging sales + an advisor.
  Every reply carries reason + evidence + confidence + source + alternative.
- **Capability Registry** (`V15CapabilityRegistry.ts`): every v15 ask → true status.

## Why this is the real centerpiece
The platform has accumulated honest engines (scan, twin, agent, weather, calendar).
The Copilot is what makes them reachable by a farmer who just asks a question — and
it's honest precisely because it routes to real engines and declines what it can't
answer instead of inventing. 27-assertion test + gate enforce it.
