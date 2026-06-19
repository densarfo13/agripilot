# FARROWAY OPERATING SYSTEM (FOS-1)

## Mission

Help farmers know exactly what to do today.

---

## Product Promise

When a farmer opens Farroway, they should immediately see:

* Farm Health
* Crop Stage
* Top Risk
* Today's Action
* Reason
* Confidence

Nothing is more important.

---

## North Star Metrics

1. Today's Action Started %
2. Today's Action Completed %
3. Scan Success %
4. Outcome Capture %
5. Follow-Up Completion %
6. D7 Retention %

Every sprint must improve at least one metric.

---

## Build Rules

### Build

* Better scan accuracy
* Better recommendations
* Better crop-stage detection
* Better outcome tracking
* Better task completion
* Better onboarding
* Better localization
* Better mobile experience

### Do Not Build

* New AI modules without user demand
* Additional dashboards without KPI impact
* Complex scoring systems without farmer value
* Features that do not improve adoption or retention

---

## Home Screen Hierarchy

1. Farm Health
2. Crop Stage
3. Top Risk
4. Today's Action
5. Reason
6. Confidence
7. Start Button

---

## Scan Standard

Every scan must produce:

* Plant Name
* Confidence
* Possible Issue
* Severity
* Why
* Next Action
* Follow-Up

If candidates exist:

Never show:

* Plant: —
* Unknown Plant

Show candidate matches instead.

---

## Outcome Loop

Task
→ Complete
→ Better / Same / Worse
→ Store Result
→ Improve Recommendations

---

## Pilot Targets

Phase 1

* 10–20 users
* 500 scans
* 250 completed tasks
* 100 outcomes

Phase 2

* 100 users
* 5,000 scans
* 2,000 completed tasks
* 1,000 outcomes

---

## Founder Decision Rule

Before every sprint ask:

Will this improve:

* Today's Action Completion?
* Scan Success?
* Outcome Capture?
* Follow-Up Completion?
* D7 Retention?

If not, postpone it.

---

*Runtime architecture behind this charter:
[FARROWAY_OS_RUNTIME_ARCHITECTURE.md](./FARROWAY_OS_RUNTIME_ARCHITECTURE.md)
(the `__farrowayHealth()` composite, subsystem probes, and the
286-gate `build:safe` suite that enforce these rules in code).*
