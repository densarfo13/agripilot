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

## Core values

1. **Farmer First** — never optimize for developers over farmers.
2. **Truth over AI** — if evidence is weak, say "I don't know." Never fabricate.
3. **Simplicity wins** — if two solutions work, ship the simpler one.
4. **Reliability beats features** — one feature that works 100% beats ten unreliable ones.
5. **Explain every recommendation** — answer What? Why? Evidence? Confidence? Risk?
6. **Build once** — duplicate logic is forbidden; every business rule has one owner.
7. **Measure everything** — no feature without telemetry, no optimization without metrics.

## Engineering pyramid

A higher layer may never compromise a lower one:

```
6  Enterprise
5  AI
4  UX
3  Performance
2  Reliability
1  Security        ← foundation
```

(Security/reliability are load-bearing; an AI or enterprise feature that weakens them is
rejected. This complements the day-to-day work order in
[ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md).)

## If in doubt

Ask: **"Does this help a farmer today?"** If not, don't build it.

---

See also: [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) ·
[RELEASE_POLICY.md](RELEASE_POLICY.md) · [QUALITY_BAR.md](QUALITY_BAR.md) ·
[PILOT_GATE.md](PILOT_GATE.md).
