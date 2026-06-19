# LANGUAGE_MASTER_INDEX.md

**Sprint #204 — user-facing string inventory.**
Generated from `src/i18n/columns/T-en.js` (the canonical key set
every rendered string resolves through). 6474 keys total.

## Per-locale coverage

| Locale | Keys | Structural | Real-translation | Pending review |
|---|---:|---:|---:|---:|
| en | 6474 | 100% | 100% | 0 |
| fr | 6474 | 100% | 99.2% | 53 |
| sw | 6474 | 100% | 99.2% | 53 |
| ha | 6474 | 100% | 99.2% | 53 |
| tw | 6474 | 100% | 99.2% | 53 |
| hi | 6474 | 100% | 53.9% | 2987 |

## Inventory by surface

| Surface | Keys | Sample keys |
|---|---:|---|
| Tasks | 246 | `task.clearField.high`, ` task.clearField.medium`, ` task.clearField.low`, ` task.prepareDrainage.high` |
| Scan | 73 | `scan.page.title.farm`, ` scan.page.title.backyard`, ` scan.page.subtitle.farm`, ` scan.page.subtitle.backyard` |
| Market / Sell | 332 | `market.myListings.title`, ` market.myListings.create`, ` market.myListings.all`, ` market.myListings.empty` |
| Funding | 207 | `funding.mayQualify`, ` funding.deadline`, ` funding.deadlineRolling`, ` funding.benefit` |
| Farm | 289 | `farm.myFarm`, ` farm.edit`, ` farm.crop`, ` farm.acres` |
| Garden | 12 | `myGrow.title`, ` garden.growingSetup.title`, ` garden.growingSetup.label`, ` garden.growingSetup.container` |
| Activity | 15 | `activity.planting`, ` activity.spraying`, ` activity.fertilizing`, ` activity.irrigation` |
| Notifications | 77 | `notifications.daily_ready`, ` notifications.missed_day`, ` notifications.high_risk`, ` notifications.weather_warning` |
| Settings | 28 | `settings.notifications.title`, ` settings.notifications.daily`, ` settings.notifications.time`, ` settings.notifications.browser` |
| Onboarding | 243 | `onboarding.progress`, ` onboarding.validation.title`, ` onboarding.fields.country`, ` onboarding.fields.state` |
| Voice | 26 | `voice.enableGuide`, ` voice.turnOn`, ` voice.welcome`, ` voice.askFarroway` |
| Errors | 9 | `error.loadProfile`, ` error.loadFarmData`, ` error.createProfile`, ` error.somethingWrong` |
| Home / Hero | 197 | `today.done.title`, ` today.done.body`, ` today.done.donePill`, ` today.optional.title` |
| Common / Buttons | 107 | `common.continue`, ` common.ready`, ` common.stepN`, ` common.next` |
| (other namespaces) | 4613 | — |

## How a rendered string maps to a key

Every grower-facing string flows through `tSafe(key, fallback)`
/ `tStrict` / `getLocalizedTaskTitle` / `getLocalizedCropName` /
the scan `scan.*` keys. The build gate `audit:i18n` fails the
build on any NEW hardcoded literal in the 19 scanned surfaces;
`check-language-consistency` + `MythosLanguageGuard` attest the
runtime. So "file → component → string → key" is enforced, not
just documented: a string with no key cannot ship.

_Regenerate: `node scripts/generate-language-master-index.mjs`_
