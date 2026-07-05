# SPEC_CROSSWALK.md — mega-spec filenames → canonical Track B docs

Purpose: expansion specs keep arriving with new document filenames for the same concepts. To honor
**Build Once**, this maps requested names to the canonical doc that already exists. Do NOT create a
new file when a canonical one covers it — extend the canonical doc instead.

## Canonical set (authoritative)
| Concept | Canonical doc |
|---|---|
| Whole-platform architecture | `FARMBRAIN_OS_MASTER_ARCHITECTURE.md` |
| Knowledge graph | `KNOWLEDGE_GRAPH_SPEC.md` |
| AI agents (facades over engines) | `AI_AGENT_FRAMEWORK.md` |
| Intelligence kernel / reasoning engine | `FARMBRAIN_OS_MASTER_ARCHITECTURE.md` §Layer 4 + `AI_AGENT_FRAMEWORK.md` §kernel routing |
| Mission Control | `MISSION_CONTROL.md` |
| Voice / Jarvis | `VOICE_PLATFORM.md` |
| Enterprise / partner / public platform | `PARTNER_PLATFORM.md` |
| Roadmap | `ROADMAP_2026_2035.md` |

## Requested-name → canonical (recent specs)
| Requested filename | Canonical (use this) |
|---|---|
| FARROWAY_OS_V2.md, FARROWAY_OS_MASTER_ARCHITECTURE.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md |
| JARVIS_ARCHITECTURE.md, VOICE_COMMAND_CENTER_REPORT.md, JARVIS_COMMAND_CENTER_REPORT.md | VOICE_PLATFORM.md |
| FARMBRAIN_ENGINE.md, FARMBRAIN_KERNEL.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md §Layer 4 |
| MEMORY_ENGINE.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md §Layer 3 |
| ENTERPRISE_CLOUD.md | PARTNER_PLATFORM.md |
| KNOWLEDGE_GRAPH_SPEC.md | (canonical — same name) |
| MISSION_CONTROL.md | (canonical — same name) |
| ROADMAP_2027.md, ROADMAP_2026_2035.md | ROADMAP_2026_2035.md |
| VOICE_PRIVACY_REPORT.md, COMMAND_ROUTER_REPORT.md, FARMBRAIN_JARVIS_TEST_REPORT.md | VOICE_PLATFORM.md §Privacy/§Command map (implementation-time; no report until built) |
| FARROWAY_X_ARCHITECTURE.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md |
| JARVIS_ENGINE.md | VOICE_PLATFORM.md (+ §Context awareness) |
| KNOWLEDGE_GRAPH.md | KNOWLEDGE_GRAPH_SPEC.md |
| DIGITAL_TWIN.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md §Digital Twin & Farm Records |
| ENTERPRISE_PLATFORM.md, DEVELOPER_PLATFORM.md | PARTNER_PLATFORM.md |
| ROADMAP_2030.md (new request; the legacy file of that name is history) | ROADMAP_2026_2035.md |
| PREDICTION_ENGINE.md | ROADMAP_2026_2035.md §Phase 5 prediction lines + AI_AGENT_FRAMEWORK.md |
| MEMORY_ENGINE.md, FARM_RECORDS.md | FARMBRAIN_OS_MASTER_ARCHITECTURE.md §Layer 3 / §Digital Twin & Farm Records |

## Legacy docs (history only — NOT canonical)
`FARMBRAIN_SPEC.md`, `FARMBRAIN3.md`, `FARMBRAIN_OPERATING_MODEL.md`, `AI_AGENTS.md` (superseded by
AI_AGENT_FRAMEWORK.md), `KNOWLEDGE_GRAPH_FARMBRAIN_REPORT.md`, `ROADMAP_2026_2030.md`, `ROADMAP_2030.md`,
`COMMERCIAL_ROADMAP.md`, and the various `FARMBRAIN_*_REPORT/CERTIFICATION/VALIDATION.md` files.

## Hard gate (unchanged)
None of these are implemented until the 12 Release exit criteria are green + pilot metrics justify +
founder sign-off (`NEXT_BRANCH_CHECKLIST.md`). Jarvis, Memory Engine, the reasoning engine, Mission
Control (real-time), and Enterprise Cloud are all **behind that gate** — design docs only on this
branch, forbidden on `master`.
