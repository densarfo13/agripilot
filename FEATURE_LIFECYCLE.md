# Feature Lifecycle

How a feature goes from idea to production under the Product OS.

1. **Declare** — write a Feature Manifest in `src/product/featureManifest.js` with all 12 fields
   (problem · persona · value · successMetric · offlineBehavior · localizationImpact ·
   accessibilityImpact · performanceImpact · aiImpact · dataRequired · privacyImpact ·
   enterpriseImpact). Missing a field → `check:feature-manifest` fails the build. This is where the
   product question — "does this help the farmer make today's next best decision?" — is answered in writing.
2. **Design** — build only from the design system (DESIGN_BIBLE.md / `src/design/components`).
   New inline colors are rejected (`check:design-lint`); one hero + one primary action per screen.
3. **Localize** — every string via the i18n layer; 6-locale parity; no raw keys.
4. **Honest AI/data** — follow AI_GOVERNANCE.md + DATA_GOVERNANCE.md (no fabrication; fallback; privacy).
5. **Test + gate** — unit/integration tests + a `build:safe` gate that locks the behavior.
6. **Verify** — for previewable/visual work, verify on production (the loop that has caught real
   bugs); for runtime/device behavior, verify on device (field-pending items).
7. **Release** — RELEASE_STANDARD.md.

A feature that can't fill its manifest, or that fails a gate, does not ship.
