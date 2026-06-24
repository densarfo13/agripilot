# LOCALE_AUDIT_V2

**CI gate that fails the build when Twi coverage drops below 95%**, and
names exactly which surfaces still show English. Sprint #230.

## The gate

`scripts/check-locale-audit-v2.mjs` (wired into `build:safe` as
`check:locale-audit-v2`):

- **Coverage** = % of active English keys whose Twi value is a real
  translation — present, non-blank, and **distinct from English**.
  Pure-universal tokens are exempt (numbers/symbols/units, `pH`, `OK`,
  brand names, and pure interpolation placeholders like `{task}`).
- **Threshold:** `TW_COVERAGE_MIN = 95.0%`. CI **fails** below it.
- **Leak detection** categorizes every English-on-Twi key so the report
  names the surface, not just a number:
  - **buttons / CTAs** (`*.button`, `*.cta`, `*.action`, `common.*`)
  - **notifications** (`notif*`, `*.toast`, `*.push`, `*.alert`)
  - **dialogs / modals** (`*.dialog`, `*.modal`, `*.confirm`, `*.sheet`)
  - **scan screens** (`scan*`, `plant.*`)
  - **other**

## Current state (measured)

**Twi coverage: 97.5%** (6480 / 6647 keys) — **PASS** (≥ 95%).

| Category | English leaks on Twi screens |
|---|---|
| buttons / CTAs | **0** ✅ |
| notifications | **0** ✅ |
| dialogs / modals | **0** ✅ |
| scan screens | **0** ✅ |
| other | 167 |

This sprint cleared the farmer-visible categories: the 5 button/scan
leaks the audit found (`common.scanPlant`, `common.addPlant`,
`common.remindMe`, `common.today`, `plant.possible`) were translated to
Twi; the lone "notification" hit was a false positive (`{task}` is a pure
placeholder, now exempt).

## The remaining 167 ("other")

Lower-priority, non-farmer-critical strings still English in Twi:
harvest units (`harvest.unit.bushel`), generated-task templates
(`generatedTask.crop.kale`, `generatedTask.custom.*`), and admin/buyer/
invite copy (`buyer.safe`, `invite.password`, `progress.admin`, …). These
keep coverage at 97.5% — well above the gate — and are the backlog for the
existing Translation Completion Program. The gate makes this debt visible
on every CI run and blocks it from ever growing past the 95% line.

## Why a distinctness-based measure

The pre-existing `check:translations` gate only verified a key was
*non-blank* — a Twi value byte-identical to English passed it while being
functionally untranslated. LOCALE_AUDIT_V2 closes that blind spot:
identical-to-English counts as **not covered**, which is what a farmer
actually experiences on screen.
