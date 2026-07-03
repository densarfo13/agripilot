# Platform Core — Service Registry, Runbook & Final Report

## 1. Core services → real implementations (the registry; no duplicates built)
| Requested service | Exists as |
|---|---|
| Identity | auth runtime + RBAC roles (farmer/gardener/buyer/NGO/gov/admin), protectedRouter |
| Organization / Tenant | `src/runtime/organization` + tenant isolation (gate-enforced) + enterprise runtime |
| Event Bus | `src/runtime/events/eventRuntime.js` (EVENT_CATALOG.md) — immutable domain events, audited |
| Notification | notification runtimes + `/settings/notifications` + templates |
| Document | journal/timeline + exports (full doc-mgmt = with first enterprise need) |
| Consent | `src/runtime/consent` (Policy/Registry/Store/Runtime) — composed by finance engine |
| Audit | AuditRuntime (canonical-event attestation) + finance/scan audit events w/ correlationId |
| Feature Flags | env-driven flags (`FARROWAY_FEATURE_*`, enableHindiLocale) — central admin UI = later |
| Workflow Engine | **DECLINED** — zero configurable workflows exist; a generic engine now is premature abstraction. Flows are explicit code (onboarding, invites, scan chain) — refactor to an engine when the 3rd party needs to *configure* one |
| Rule Engine | **DECLINED** — same class; rules live in gated engines (eligibility, sell decision) with tests. Config-rules come with the first non-engineer rule author |
| API Gateway | the Express app IS the gateway at this scale (auth/rate-limit/audit per route) |
| Search | **absent — no live search requirement**; build with the first search feature |
| Payments | **DECLINED** (recorded in INVESTOR_DUE_DILIGENCE.md): custody/escrow with no PSP contract or license = liability. Provider-agnostic seam documented; build with first payment partner |
| AI Platform | FarmBrain — the single orchestrator, duplication build-blocked (`check:single-brain`) |
| Knowledge Graph | event spine + FarmBrainState; nodes/edges as future event-projection (recorded design) |
| Data Governance | consent enforcement + PII discipline (coarse GPS, no image bytes logged) live; catalog/lineage/retention docs = with DPA compliance pack (P1 security list) |
| Developer Platform | deferred to first partner (playbook in PUBLIC_API_PARTNER_ECOSYSTEM_REPORT.md) |
| Observability | per-domain health runtimes, scan/provider metrics, launch ladder, dashboards |

Doc map: EVENT_CATALOG.md ✓ · AI→FARMBRAIN_SPEC ✓ · SECURITY→SECURITY_AUDIT+BASELINE ✓ ·
API→API_BLUEPRINT ✓ · ENTERPRISE→NGO_GOVERNMENT_PORTAL_REPORT ✓ · ARCHITECTURE→PLATFORM_ARCHITECTURE ✓.

## 2. Operational Runbook (new — how to run Farroway)
- **Deploy:** `npm run build:safe` must print `PASS — N steps green` → commit → `railway up
  --detach` (grep "Build Logs" for the deploy id). Never deploy on a red gate.
- **Rollback:** `git revert <sha>` → build:safe → redeploy (no force-push; frozen-core hash gates).
- **Health:** `GET /api/health` (persistence+readiness envelope) · `/admin/scan-health` (providers)
  · `/admin/scan-debug` (per-scan 15-step trace + Export JSON) · `window.__startupHealth()`.
- **Logs:** Railway drain; grep `[FARROWAY_CRASH]` + correlationId to match a field report to a scan.
- **Keys:** provider keys server-side only (`PLANT_ID_API_KEY` canonical); readiness measured at
  runtime — check `/api/admin/scan/last-trace` keyFingerprint, never local .env.
- **Incident:** crash-free < 0.95 with traffic → launch ladder auto-reads NOT_READY → pause
  onboarding (PILOT_OPERATIONS_PLAYBOOK escalation) → fix → gate → redeploy.
- **Backups:** BackupHealthRuntime + docs/ runbook; Prisma migrations append-only (gate-checked).

## 3. Final report
**Maturity ~80/100** (code ~88 · business ~74 — unchanged; no new evidence).
**Top engineering risks:** solo-maintainer bus factor · unpinpointed device render-throw (capture
ready) · growing wave-36 exception list · root-dir report sprawl (~60 .md files).
**Top operational risks:** pilot never run (everything downstream starves) · provider credit
exhaustion unmonitored in the field · no on-call rotation.
**Debt register (real):** 15 pre-existing react-hooks lint errors · 4,276 inline-hex (ratcheted) ·
Hindi 54% (hidden) · screen design-system migration partial · no standalone typecheck script ·
report sprawl → move to docs/reports/ (force-add; docs/ is gitignored).
**Roadmaps:** scalability/security/commercial — see EXECUTIVE_BOARD_REPORT + INVESTOR_DUE_DILIGENCE
(single prioritized sequence; next 12 months = pilot → partners → verification debt → model v1).
**Launch ladder:** 10 farmers ✅ GO today · 100 farmers ✅ GO (the designed pilot) · regional ❌
until READY_FOR_1000 gates met by real data · national ❌ until READY_FOR_COMMERCIAL + pen-test +
measured performance. Evidence-gated by `launchGateDecision` — no manual overrides.
