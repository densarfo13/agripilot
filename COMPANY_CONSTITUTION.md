# Farroway Company Constitution

Today Farroway stops being an application and becomes a company. This is the top-level law; every
domain constitution below is subordinate to it, and each is **enforced by a real build gate**, not
by memory.

## Mission
**Help every farmer make the next best decision.**

## We compete on Trust
Not AI. Not features. Not complexity. If a choice trades trust for cleverness, trust wins.

## Core values
1. **Farmer First**
2. **Truth Before Intelligence** — "I don't know" beats a confident wrong answer.
3. **Simple Beats Clever**
4. **Reliability Beats Features**
5. **Evidence Beats Guessing**
6. **Quality Beats Speed**
7. **Consistency Beats Novelty**

## The STOP RULE (binding)
If work does not improve **Trust · Daily Usage · Farmer Outcomes · Reliability · Enterprise
Readiness** — do not build it. (This rule applied to itself is why this constitution does not
duplicate existing docs: each domain has ONE owner.)

## The domain constitutions (one owner each, each gate-enforced)

| Domain | Constitution (binding law) | Detailed playbook | Enforced by |
|---|---|---|---|
| Company | this file | docs/company/COMPANY_ENGINEERING_CHARTER.md | — |
| Product | PRODUCT_CONSTITUTION.md | PRODUCT_PLAYBOOK.md / PRODUCT_OS.md | `check:feature-manifest`, `check:screen-contract` |
| Engineering | ENGINEERING_CONSTITUTION.md | ENGINEERING_PLAYBOOK.md / QUALITY_BAR.md | `build:safe` (~398 gates) |
| UX | UX_CONSTITUTION.md | DESIGN_BIBLE.md / UX_PRINCIPLES.md | `check:ui-design-system`, `check:design-lint` |
| AI | AI_CONSTITUTION.md | AI_GOVERNANCE.md | scan / sell / decision honesty gates |
| Data | DATA_CONSTITUTION.md | DATA_GOVERNANCE.md | FarmBrain ingestion + redaction gates |
| Security | SECURITY_CONSTITUTION.md | — | `check:federation-security`, `check:audit-logging`, … |
| Quality | QUALITY_CONSTITUTION.md | QUALITY_MANUAL.md | every-release-improves-a-KPI |
| Direction | ROADMAP_2030.md | — | — |

## Honest standing state
The constitution + its enforcement are real and live. The product itself remains at
**GO_FOR_INTERNAL_TEST** (PRODUCTION_CERTIFICATION.md): the gate to a real pilot is operational —
one on-device acceptance run + lit telemetry — not more governance. A company that writes laws but
never ships to a farmer has not become a company; the next move is the field run.
