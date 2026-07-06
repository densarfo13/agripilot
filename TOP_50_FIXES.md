# TOP_50_FIXES.md — the ranked, evidence-backed backlog (2026-07-05)

**35 items, not 50** — the spec says "do not invent work," and 35 is what the evidence supports.
Every item cites its evidence; nothing here is speculative. Ratings: Impact / Effort / Risk /
Pilot-value, each H(igh)/M(ed)/L(ow). Sorted by tier, then by Impact-per-Effort.

## TIER 0 — the gate everything waits on
| # | Fix | Evidence | I | E | R | P |
|---|---|---|---|---|---|---|
| 1 | **Operator device scan on the previously-failing phone** (result screen OR Export Diagnostic Report) | RELEASE_PLAN #1/#4; 11 of 12 criteria downstream | H | L | L | H |
| 2 | If #1 fails: fix the captured exception at source + regression | Diagnostic pipeline shipped & bundle-verified; JSON contains message/stack/correlationId | H | ? | L | H |

## TIER 1 — production hardening (this week)
| # | Fix | Evidence | I | E | R | P |
|---|---|---|---|---|---|---|
| 3 | ~~Patch 5 root prod-dependency vulns (3 high)~~ **DONE 2026-07-05** (commit 224ff503, deploy 63880895; audit → 0) | npm audit 2026-07-05 | H | L | M | H |
| 4 | ~~Patch 14 server prod-dependency vulns (2 high)~~ **DONE 2026-07-05** (same commit; audit → 0) | npm audit (server) | H | L | M | H |
| 5 | Add CI dependency-scan gate so vuln-drift blocks merge | 19 vulns accumulated silently — no gate exists | H | L | L | M |
| 6 | W4: verify `/api/v2/analytics/track|events` persist rows with real userId | 0 rows found for scanning user pre-W2; W2 landed — persistence unverified | H | M | L | H |
| 7 | W5: crash-free-session counter from shipped client diagnostics | Criterion #3 NOT MEASURED; localStorage exception store live | H | M | L | H |
| 8 | Upload MIME/type guard on `/api/scan/analyze` (2 MB limit exists; no mimetype validation found) | app.js:403; queued security pair | M | L | L | M |
| 9 | W6: device acceptance matrix (iPhone Safari + Android Chrome) per docs/PRODUCTION_ACCEPTANCE_TEST.md — covers Phase-1 loading/offline/retry/error/recovery per workflow | Criteria #6,8,9,10,11 pending; checklist exists | H | M | L | H |
| 10 | Founder session: `/api/admin/scan/last-trace` ↔ correlationId match check | Closeout item 6 — admin-gated, needs founder login | M | L | L | M |
| 11 | Decide on pre-W2 orphaned scan rows (null userId): backfill via scanId↔trace match, or accept loss | History rows persisted ownerless before the fix | M | M | L | M |

## TIER 2 — quality & performance (weeks 2–4)
| # | Fix | Evidence | I | E | R | P |
|---|---|---|---|---|---|---|
| 12 | W8a: fix `i18n.test.js` (14 fails) + `checkTranslations.test.js` (2) — stale expectations vs current columns | stash-compare proved pre-existing | M | M | L | M |
| 13 | W8b: fix `apiAuthGate.test.js` (8 fails — client refresh diagnostics) | same run | M | M | L | M |
| 14 | W8c: remaining ~26 legacy fails across 10 files (finalRuntimeStabilization, assetManifestGuard, productionReliability×2, hardening×2, taskEngine×2, …) → `npm test` becomes a trustworthy signal | full-suite log | M | M | L | M |
| 15 | Main-chunk trim: route-lazy `/internal/*`+`/admin/*` out of the 375 KB-gzip main chunk; ship before/after gzip diff | measured dist; chunk-graph edits are regression-prone → after #1, behind device smoke | H | M | M | H |
| 16 | Boot-effect deferral: ~27 non-critical health installs past first paint + Lighthouse before/after on throttled Android | PERFORMANCE_REPORT pending item (204 dynamic imports) | H | M | M | H |
| 17 | RUM: capture web-vitals (LCP/INP/TTFB) → telemetry so Phase-3 metrics are FIELD numbers | no field perf data exists — only synthetic | M | L | L | H |
| 18 | Copy-governor debt 1 → 0 (single real banned-term value) | rebaseline after NaN fix | L | L | L | L |
| 19 | W7 i18n ratchet burn-down: onboarding batch (~90 keys ×5) next; 1,137 → down by user impact | farmer-gate baseline | M | M | L | H |
| 20 | WCAG-AA pass: contrast/focus-order/screen-reader across farmer surfaces (48px + aria already in new components) | UX_AUDIT gap — never fully run | M | M | L | H |
| 21 | Console-error zero pass: measure via client diagnostics once #6 lands; fix what real devices report | Phase 2 target; capture pipeline live | M | M | L | M |
| 22 | Raster pass: confirm all knowledge/realism images webp + width-capped | 1 webp found in scan realism; rest unaudited | L | L | L | L |
| 23 | Cold-start TTFB (782 ms first hit): evaluate Railway keep-warm / min-instances | 1 of 5 samples | L | L | L | L |
| 24 | Edge cache/CDN in front of Railway for hashed assets | single-origin today; ops change | M | M | M | M |

## TIER 3 — observability, security review, pilot metrics (weeks 3–6)
| # | Fix | Evidence | I | E | R | P |
|---|---|---|---|---|---|---|
| 25 | Wire scan-success / crash-free / avg-confidence / avg-scan-time into the EXISTING pilot analytics pages once #6/#7 land (no new dashboard) | pilot-metrics + analytics runtimes exist; Phase-5 list maps onto them | H | M | L | H |
| 26 | Error-envelope completeness: correlationId+session+device+version+language on every reported error (diagnostics already carry most; add app version + flag state) | clientDiagnostics report fields vs Phase-4 list | M | L | L | M |
| 27 | Rate-limit coverage check: verify login/refresh/analyze/track all limited (24 limiter refs — coverage unattested) | app.js grep | M | L | L | M |
| 28 | JWT expiry review: 24 h access tokens (config default) — consider shorter + refresh rotation | config/index.js | M | M | M | L |
| 29 | Secrets-in-bundle gate: automated check that no VITE_ secret-shaped value ships in dist | manual spot-checks only so far | M | L | L | M |
| 30 | Audit-log coverage attestation for mutating admin routes (AuditRuntime exists; re-run coverage check) | wave-39 attestation exists — re-verify current | L | L | L | L |
| 31 | Backup restore DRILL (BackupHealthRuntime exists; an actual restore has never been evidenced) | runtime present; no drill artifact | M | M | L | M |
| 32 | Pen-test remains the standing security gap (external engagement) | PRODUCTION_SCORECARD v10 flagged; still true | M | H | L | M |

## TIER 4 — Jarvis (improve-only, flag stays off) & UX polish (after Tier 0 closes)
| # | Fix | Evidence | I | E | R | P |
|---|---|---|---|---|---|---|
| 33 | Jarvis field measurement: intent/routing accuracy, completion, unknown-rate from the 10 shipped telemetry events (needs #6); sw/ha/tw STT field test BEFORE any pilot flag-on | events wired on branch; risk noted in JARVIS_TEST_REPORT | M | M | L | M |
| 34 | Scan result delight layer: confidence meter, result-screen timeline strip, inline photo-compare (reuse PhotoComparisonCard) — each lazy | UX_AUDIT after-P0 items 2/6/7/9 | M | M | M | H |
| 35 | PDF report + Share-with-agronomist (consented) — lazy-loaded, never in the farmer main chunk | UX_AUDIT items 10/11 | M | H | M | M |

## Standing rules
No major modules, no architecture redesign, no duplicate services (spec + RELEASE_PLAN). Every fix
lands behind the full gate chain; farmer-visible changes get a device check. This file supersedes
scattered fix lists — update it in place as items close (rule: evidence in, sprawl out).
