# MUSHROOM_PROVIDER_SAFETY_REPORT

## Safety stance: absolute
Mushroom edibility is life-critical. The system NEVER tells a user a wild
mushroom is safe or edible to act on.

- The server adapter (`mushroomProvider.js`) defaults edibility to `unknown` and
  never upgrades unknown → edible; toxic gets an explicit "do not touch or eat".
- The client normalizer (`MushroomProvider.ts`) passes edibility through as
  INFORMATION only and produces ONLY warnings — never a "safe to eat" action.
- The consensus (`ScanProviderConsensus.ts`) never produces a mushroom action and
  always surfaces: "Do not eat wild mushrooms based only on this scan."

## Gate-enforced
`check:mushroom-safety` fails the build if any mushroom code asserts safe/edible,
and runs a tsx probe: even with provider `edibility:'edible', confidence:99%`, no
safe recommendation is produced and the never-eat warning is always present.

## When it runs (§4)
Only for scanType = mushroom (cost-aware; otherwise short-circuits UNSUPPORTED).

## Result card (§8)
Mushroom scan shows: Possible mushroom / Confidence / Warning +
"Do not eat wild mushrooms based only on this scan." — never an edibility verdict.
