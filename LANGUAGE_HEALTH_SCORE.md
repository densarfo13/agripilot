# LANGUAGE_HEALTH_SCORE.md

**Sprint #211 — language health (farmer-facing).**
Date: 2026-06-19.

| Dimension | Status | Basis |
|---|---|---|
| Coverage (visible locales fr/sw/ha/tw) | GREEN (visible locales) | min 95.9% |
| Coverage (Hindi) | RED | 53.5% — hidden until complete |
| Consistency (structural parity) | GREEN | all locales 6505 keys |
| Fallback usage | YELLOW | English fallback safe; Hindi-heavy |
| Mixed-language screens | GREEN | Hindi gated → no mixed screen shipped; visible locales ≥95% |
| Pilot readiness (language) | GREEN | 4 visible locales pilot-ready; Hindi deferred |

## Overall

Farmer-facing language health: **GREEN** for the 5 visible locales (Hindi hidden by design).

## Top 100 missing farmer-facing translations

(ranked by how many locales lack them — 5 = missing everywhere)

| # | key | English | missing in |
|--:|---|---|--:|
| 1 | `age.25_34` | 25 – 34 | 5/5 |
| 2 | `age.25to35` | 25 – 35 | 5/5 |
| 3 | `age.35_44` | 35 – 44 | 5/5 |
| 4 | `age.36to50` | 36 – 50 | 5/5 |
| 5 | `age.45_54` | 45 – 54 | 5/5 |
| 6 | `age.55_plus` | 55+ | 5/5 |
| 7 | `auth.phonePlaceholder` | 024 123 4567 | 5/5 |
| 8 | `commandCenter.healthBand.critical` | Critical | 5/5 |
| 9 | `commandCenter.healthBand.excellent` | Excellent | 5/5 |
| 10 | `commandCenter.healthBand.good` | Good | 5/5 |
| 11 | `commandCenter.healthBand.watch` | Watch | 5/5 |
| 12 | `common.today` | Today | 5/5 |
| 13 | `farmBrain.next.addCrop.guide` | Tell us your crop and planting date — we build y | 5/5 |
| 14 | `farmBrain.next.addCrop.title` | Add your crop to get your first plan | 5/5 |
| 15 | `farmBrain.next.firstScan.guide` | Take one clear photo of a leaf — we check it and | 5/5 |
| 16 | `farmBrain.next.firstScan.title` | Scan a plant to begin | 5/5 |
| 17 | `farmBrain.next.startAction.guide` | Open today's plan and mark your first task done. | 5/5 |
| 18 | `farmBrain.next.startAction.title` | Start your first action | 5/5 |
| 19 | `farmHealth.why.goodWeather` | Favorable weather | 5/5 |
| 20 | `farmHealth.why.healthyScans` | Healthy recent scans | 5/5 |
| 21 | `farmHealth.why.tasksCompleted` | Tasks completed this week | 5/5 |
| 22 | `farmQuality.action.location` | Add your location | 5/5 |
| 23 | `farmQuality.action.outcome` | Record your first outcome | 5/5 |
| 24 | `farmQuality.action.plantingDate` | Add your planting date | 5/5 |
| 25 | `farmQuality.improveBy` | Improve by | 5/5 |
| 26 | `farmQuality.level.fair` | Fair | 5/5 |
| 27 | `farmQuality.level.good` | Good | 5/5 |
| 28 | `farmQuality.level.low` | Low | 5/5 |
| 29 | `farmQuality.level.strong` | Strong | 5/5 |
| 30 | `farmQuality.subtitle` | Better data means better advice | 5/5 |
| 31 | `farmQuality.title` | Farm data quality | 5/5 |
| 32 | `farmTimeline.empty` | Your timeline starts when you add a crop and run | 5/5 |
| 33 | `farmTimeline.kind.crop_added` | Crop added | 5/5 |
| 34 | `farmTimeline.kind.farm_created` | Farm created | 5/5 |
| 35 | `farmTimeline.kind.health_score_changed` | Health score changed | 5/5 |
| 36 | `farmTimeline.kind.issue_detected` | Issue detected | 5/5 |
| 37 | `farmTimeline.kind.outcome_recorded` | Outcome recorded | 5/5 |
| 38 | `farmTimeline.kind.planting_date_added` | Planting date added | 5/5 |
| 39 | `farmTimeline.kind.scan_completed` | Scan completed | 5/5 |
| 40 | `farmTimeline.kind.task_completed` | Task completed | 5/5 |
| 41 | `farmTimeline.kind.weather_alert` | Weather alert | 5/5 |
| 42 | `farmTimeline.title` | Farm timeline | 5/5 |
| 43 | `generatedTask.custom.detail` | {detail} | 5/5 |
| 44 | `generatedTask.custom.title` | {title} | 5/5 |
| 45 | `growth.channels.facebook` | Facebook | 5/5 |
| 46 | `growth.channels.sms` | SMS | 5/5 |
| 47 | `growth.channels.whatsapp` | WhatsApp | 5/5 |
| 48 | `helpers.generic` |   | 5/5 |
| 49 | `home.streakDayCount` | {n}-day streak | 5/5 |
| 50 | `home.weatherStatusLive` | Live | 5/5 |
| 51 | `home.weatherStatusUpdating` | Updating… | 5/5 |
| 52 | `market.advisoryBody` | Prices shown are estimated ranges for general gu | 5/5 |
| 53 | `market.advisoryLabel` | Advisory only: | 5/5 |
| 54 | `market.bestForLabel` | Best for: | 5/5 |
| 55 | `market.buyerTypesHeader` | Buyer Types | 5/5 |
| 56 | `market.cropTypeLabelRequired` | Crop Type * | 5/5 |
| 57 | `market.errorExpressFailed` | Failed to express interest | 5/5 |
| 58 | `market.errorLoadFailed` | Failed to load market data | 5/5 |
| 59 | `market.errorWithdrawFailed` | Failed to withdraw interest | 5/5 |
| 60 | `market.expressInterestCta` | + Express Interest | 5/5 |
| 61 | `market.expressInterestSubmitCta` | Express Interest | 5/5 |
| 62 | `market.loadingPrices` | Loading market data... | 5/5 |
| 63 | `market.mySellingInterestsHeader` | My Selling Interests | 5/5 |
| 64 | `market.noInterestsMessage` | Express interest to connect with buyers for your | 5/5 |
| 65 | `market.noInterestsTitle` | No selling interests yet | 5/5 |
| 66 | `market.noPriceDataMessage` | Market prices will appear here when available fo | 5/5 |
| 67 | `market.noPriceDataTitle` | No price data available | 5/5 |
| 68 | `market.noSpecificTips` | No specific tips available for this crop. | 5/5 |
| 69 | `market.notesLabel` | Notes | 5/5 |
| 70 | `market.notesPlaceholder` | Any additional information | 5/5 |
| 71 | `market.perKg` | per kg | 5/5 |
| 72 | `market.preferredBuyerTypeLabel` | Preferred Buyer Type | 5/5 |
| 73 | `market.preferredBuyerTypePlaceholder` | e.g. cooperative, export | 5/5 |
| 74 | `market.priceExpectationLabel` | Price Expectation | 5/5 |
| 75 | `market.priceRangesHeader` | Estimated Price Ranges | 5/5 |
| 76 | `market.quantityKgLabel` | Quantity (kg) | 5/5 |
| 77 | `market.searchCropsPlaceholder` | Search crops... | 5/5 |
| 78 | `market.sellingTipsLabel` | Selling Tips: | 5/5 |
| 79 | `market.status.expressed` | Expressed | 5/5 |
| 80 | `market.status.matched` | Matched | 5/5 |
| 81 | `market.status.withdrawn` | Withdrawn | 5/5 |
| 82 | `market.submittingCta` | Submitting... | 5/5 |
| 83 | `market.tableActionHeader` | Action | 5/5 |
| 84 | `market.tableBuyerTypeHeader` | Buyer Type | 5/5 |
| 85 | `market.tableCropHeader` | Crop | 5/5 |
| 86 | `market.tableDateHeader` | Date | 5/5 |
| 87 | `market.tableMaxPriceHeader` | Max Price | 5/5 |
| 88 | `market.tableMinPriceHeader` | Min Price | 5/5 |
| 89 | `market.tablePriceHeader` | Price | 5/5 |
| 90 | `market.tableQuantityHeader` | Quantity | 5/5 |
| 91 | `market.tableSeasonAdviceHeader` | Season Advice | 5/5 |
| 92 | `market.tableStatusHeader` | Status | 5/5 |
| 93 | `market.tableTipsHeader` | Tips | 5/5 |
| 94 | `market.tableUnitHeader` | Unit | 5/5 |
| 95 | `market.trackingNote` | Tracked for demand analysis — not a marketplace | 5/5 |
| 96 | `market.viewTipsCta` | View Tips | 5/5 |
| 97 | `market.withdrawCta` | Withdraw | 5/5 |
| 98 | `notification.daily.generic.body` | {task} | 5/5 |
| 99 | `onboarding.age25to35` | 25 – 35 | 5/5 |
| 100 | `onboarding.age36to50` | 36 – 50 | 5/5 |
