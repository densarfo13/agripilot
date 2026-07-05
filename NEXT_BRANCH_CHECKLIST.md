# NEXT_BRANCH_CHECKLIST.md — entry gate for implementing Track B (`feature/farmbrain-os`)

**Rule:** nothing on this branch is implemented, and nothing merges to `master`, until every box
below is checked. Design documents only until then.

## A. Release exit (all 12 from RELEASE_PLAN.md, each with production evidence)
- [ ] Scan success > 99% (telemetry over a real usage window)
- [ ] No React runtime errors (gates green + no production boundary hits)
- [ ] Crash-free sessions > 99.9% (measured, not assumed)
- [ ] Result page always renders (incl. the formerly-failing device)
- [ ] Journal persistence verified (post `req.user.id` fix)
- [ ] Tasks created (device-verified)
- [ ] Recommendations displayed (device-verified)
- [ ] Camera retry works (device-verified)
- [ ] Offline handled gracefully (airplane-mode pass)
- [ ] iPhone Safari verified (full acceptance run)
- [ ] Android Chrome verified (full acceptance run)
- [ ] Production telemetry healthy (events persist with real userId)

## B. Business gate
- [ ] Pilot metrics justify expansion (FOS-1 north-star metrics answered with data)
- [ ] Founder sign-off recorded here with date: ______________

## C. Branch hygiene (standing, applies now)
- [ ] Branch rebased on `master` before any work session (Release fixes flow IN, never out)
- [ ] No edits to shared CI, gates, or `build:safe` from this branch
- [ ] No schema migrations against the production database
- [ ] No deploys from this branch (Railway deploys `master` builds only)
- [ ] Any future merge to `master`: feature-flagged OFF + full 411-gate chain + device acceptance

## D. First-implementation order (when A+B are green)
1. Voice CC honest kernel (keyword router → existing screens; flagged; not mounted on /scan) — `VOICE_PLATFORM.md`
2. Knowledge Graph v1 (entity-link the existing stores, read-side) — `KNOWLEDGE_GRAPH_SPEC.md`
3. Mission Control (composition over existing signals) — `MISSION_CONTROL.md`
— everything else per `ROADMAP_2026_2035.md` phase gates; canonical architecture:
`FARMBRAIN_OS_MASTER_ARCHITECTURE.md`.
