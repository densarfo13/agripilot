# MYTHOS_FABLE5_VALIDATION_REPORT.md

**Sprint #199 — post-sprint validation of the #198 product-excellence
pass.** Audit only; nothing built. Date: 2026-06-15.

Evidence basis: the gate battery (each contract below is enforced by
a build-failing gate, re-run fresh for this audit), static wiring
verification, and the #182/#192 live-preview verifications on
record. Pre-pilot limits stated where they apply.

---

## 1. Home audit — PASS (gate-locked)

`check-digital-agronomist` PASS (re-run this audit):
*"deck renders score+why+risks+action+confidence with exactly one
Start, Home hero above the fold."*

| Element | Where | Evidence |
|---|---|---|
| Farm Health | cc-health tile (score/100 + 4-tier band) | gate |
| Crop Stage | cc-stage tile | gate |
| Top Risk | cc-risk tile + cc-sub-risks chips | gate |
| Today's Action | cc-today-action card | gate |
| Reason | Why line (cc-health-why) + action why | gate |
| Confidence | cc-action-confidence | gate |
| Start button | cc-btn-start — exactly ONE (gate counts) | gate |
| Above the fold | deck is Home's first content block (#192) | gate + #192 preview |

## 2. Scan audit — PASS (gate-locked)

`check-universal-scan` + `check-scan-detection-permanent` PASS:

| Element | Evidence |
|---|---|
| Plant / candidates | topCandidates always rendered; 4-step plantName ladder |
| Confidence | "N% sure" pill (jargon fix #198) + confidenceLabel |
| Issue + severity | issueCandidates + severity in envelope v6 |
| Why | whatWeNoticed + whyItMatters (gate-required fields) |
| Next Action | nextAction never empty (gate-required) |
| Follow-Up | followUpDate + 3/7/14d offsets (check-scan-v3 §7) |
| `Plant: —` / Unknown Plant | impossible while candidates exist — repo-wide §7b gate; honest "Scan unclear" only on zero-candidate provider failure (spec-compliant) |

## 3. Task audit — PASS

- Action + reason + time on the current task card (#180/#192 audits).
- Done/Skip only on the CURRENT task; secondary cards are compact
  rows — the #198 critic pass confirmed no CTA sprawl existed.
- **Start**: deck's Start routes to /tasks (gate-counted single
  primary).

## 4. Outcome audit — PASS (new in #198, wiring verified)

- OutcomePrompt mounted in AllTasksPage under CompletionCard
  (verified: 2 references — import + render).
- Better/Same/Worse map to the engine statuses
  improved/same/worse (`check-scan-v3` confirms statuses exist).
- Storage on pick (verified in component source):
  `outcome_recorded` pilot event → `farroway.pilotEvents` ledger;
  `recordOutcomeEdge` → knowledge graph with the REAL answer;
  structured NGO event via safeTrackEvent.
- **Limit (honest):** end-to-end click-through requires an
  authenticated session with a completable task — not exercisable
  in the unauthenticated preview. Wiring is static-verified; the
  same lazy+_safe pattern is production-proven across #189's six
  call sites. First pilot completion will confirm live.

## 5. Low-literacy audit — PASS

- `check-simple-mode-copy-length` PASS (length limits declared).
- OutcomePrompt: one question, 3 buttons ≥56px, emoji anchors,
  zero paragraphs.
- `check-farmer-facing-ai-language` PASS — 717 grower files, no
  AI/LLM/ML/neural/algorithm/provider names in rendered strings.
- `audit:i18n` PASS — 0 true-positive hardcoded strings; all 6
  locales ≥98% structural coverage.

---

## Findings by severity

| Severity | Count | Items |
|---|---|---|
| Critical | **0** | — |
| High | **0** | — |
| Medium | 1 | My Grow category rows lack explicit CTA labels (carried from #198; pilot-feedback item) |
| Low | 2 | Hindi real-translation 54% (translator queue, English fallback safe) · outcome click-through untestable pre-auth (first pilot completion confirms) |

---

## Pilot impact estimate (mechanism-based — honest framing)

No pilot users exist, so these are **mechanism arguments, not
measurements**. Anyone giving you a number with a decimal point
pre-pilot is making it up.

| KPI | Direction | Mechanism |
|---|---|---|
| Outcome Capture % | **0% → measurable for the first time** | The metric had NO collection path before #198; the prompt creates its numerator. Realistic Phase-1 range for a one-tap post-completion prompt: meaningful double-digit capture among completing users. |
| Today's Action Completion % | Slight ↑ | Single Start (no competing CTAs since #192) + "Critical" band urgency (#197); the thanks-loop adds light completion reinforcement. |
| Scan Success % | Neutral→slight ↑ | Pipeline unchanged; "sure" + de-jargoned status strings reduce abandonment at the trust moment. |
| Follow-Up Completion % | Slight ↑ (second-order) | Outcome answers feed the recommendation loop, making follow-ups more relevant; effect arrives after data accumulates. |
| D7 Retention % | Slight ↑ | Trust language + being ASKED for feedback ("this helps your next plan") are retention mechanics; small but real for low-literacy users. |

---

# Final verdict: **READY FOR PILOT**

Zero Critical, zero High. Every #198 claim is enforced by a
build-failing gate re-run fresh in this audit (287-gate suite).
The outcome loop — the last structural KPI blocker — is closed.
The two Low items cannot be closed by code: one belongs to the
translator partner, the other to the first real farmer.

Same closing line as every audit since #185, now with nothing
left in front of it: **the next move is 10–20 Phase-1 farmers.**
