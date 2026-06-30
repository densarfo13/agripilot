# Engineering Constitution

Binding law for how code ships. Detailed how-to: ENGINEERING_PLAYBOOK.md / QUALITY_BAR.md.

## No PR merges without
Build · Tests · Accessibility · Localization · Performance · Telemetry · Security · Rollback ·
Documentation.

## How each is enforced
- **Build / Tests** — `npm run build:safe` (~398 gates: lint, typecheck, tests, production build).
- **Accessibility (structural)** — 48px floor + no-color-only (`check:design-system-v1`).
- **Localization** — `check:language-consistency` + 6-locale parity ratchet.
- **Security** — `check:federation-security`, `check:audit-logging`, `check:bulk-onboarding-security`.
- **Documentation / Rollback** — the QUALITY_BAR 8-point per-PR contract (revert commit / flag).
- **Performance / Telemetry (runtime)** — targets documented (PERFORMANCE in PRODUCT_OS); measured
  on device/pilot — field-pending, not faked.

## Binding rules
- **Build Once** — reuse, never fork; duplicate logic/cards rejected.
- **Tokens only** — no inline colors/spacing/type (`check:design-lint` ratchet).
- The build is the contract: a fix that touches a known failure mode adds a gate that locks it.
