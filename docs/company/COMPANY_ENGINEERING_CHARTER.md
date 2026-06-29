# Farroway — Company Engineering Charter

**North Star:** *Help every farmer make one better decision every day.*

If a piece of work cannot be traced back to that sentence, do not build it.

Architecture is **LOCKED**. The platform's engines exist (Observe → Understand → Digital
Twin → Decision → Communication → Learning → Enterprise). We do not add new engines,
platform redesigns, or speculative architecture. We improve what runs.

---

## Every task must improve at least one KPI

| KPI | Meaning |
|---|---|
| **Farmer Trust** | The farmer believes what the app tells them — honest confidence, no fabrication, specific failures. |
| **Farmer Productivity** | Fewer taps / less confusion to reach a decision or complete a task. |
| **Recommendation Accuracy** | The advice shown is evidence-backed and correct for the farm context. |
| **Reliability** | The app works on a real phone, on weak signal, without crashes or dead ends. |
| **Pilot Success** | A real farmer can install → onboard → scan → act, and comes back. |

A change that improves none of these is **not built**.

## DO NOT BUILD (auto-reject without production evidence)

New AI buzzwords · quantum · blockchain · new dashboards · new enterprise portals ·
speculative ML · experimental providers · new "platforms" or "meshes" · grand rewrites of
already-working modules.

Architecture **expansion** requires *measurable production evidence* that the current system
can't meet a real farmer need — not a spec describing a bigger system.

## Non-negotiable: honesty

- Never fabricate a diagnosis, confidence, treatment, translation, or metric.
- "Unknown" is an acceptable answer; a confident wrong answer is not.
- A mistranslated agronomic/safety term harms farmers — we ship only verified translations.
- Secrets are never logged; image bytes and precise coordinates are never stored.

See also: [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) ·
[RELEASE_POLICY.md](RELEASE_POLICY.md) · [PILOT_GATE.md](PILOT_GATE.md).
