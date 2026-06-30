# Product Constitution

Binding law for what gets built. Detailed how-to: PRODUCT_PLAYBOOK.md / PRODUCT_OS.md.

## Every feature must answer (or be rejected)
- What farmer problem is solved?
- How is success measured?
- Why now?
- **What existing feature becomes simpler?**

Unanswered → reject. This is enforced: a feature with no complete manifest fails the build
(`check:feature-manifest`, 12-field contract in `src/product/featureManifest.js`).

## Binding rules
- Every feature traces to the mission: help the farmer make the next best decision.
- Net complexity must not rise — a new feature should simplify or remove something.
- Do-not-build (auto-reject without production evidence): new AI buzzwords, blockchain, new
  dashboards, speculative ML, new "platforms/meshes", rewrites of working modules.

Enforced by: `check:feature-manifest`, `check:screen-contract`, the DO-NOT-BUILD list (charter).
