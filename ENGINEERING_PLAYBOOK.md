# Engineering Playbook

How to build in Farroway so the Product OS stays green.

## Golden rules
- **Build once.** Reuse a component/engine; never fork one. Duplicate cards/logic are rejected.
- **Tokens only.** No inline colors/spacing/shadows/type — import from `src/design/tokens`.
- **One source of truth.** Every business rule has one owner (e.g. `decideSell`, `resolveCompletionCrop`).
- **Honesty.** Never fabricate a diagnosis/confidence/price/metric/translation. "Unknown" is fine.
- **Never crash, never dead-end.** Failures return a truthful farmer-facing reason + a way forward.

## The build is the contract
`npm run build:safe` runs the full gate chain. A fix that touches a known failure mode adds a gate
so the mode is locked. Prefer the **ratchet** pattern (baseline + only-decrease) to turn a law on
immediately without a flag-day rewrite.

## Verification
- Pure logic → a self-running `tsx *.test.ts` (exit 1 on fail). Server logic → `vitest`.
- Previewable UI → verify on the running app / production; never claim a visual result unseen.
- Build verdict: never pipe through `tail`; grep for the `build:safe] (PASS|FAIL)` line.

## Git
Branch off; commit only when asked; end commit messages with the Co-Authored-By line. Scope
`git add` tightly — a stray `git add -A` once swept an unrelated file into a commit.
