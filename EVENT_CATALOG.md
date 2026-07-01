# Event Catalog

The domain events that **actually exist** in `src/runtime/events/eventRuntime.js` and the FarmBrain
ingestion layer. This is the real inter-domain communication path — not an aspirational bus.

## Emitted domain events (eventRuntime.js)
| Event | Publisher | Meaning |
|---|---|---|
| `farm.created` | Farm | a farm was created |
| `farm.updated` | Farm | farm details changed |
| `farm.location_updated` | Farm | GPS / town / ZIP set |
| `scan.queued` | Scan | scan enqueued (offline-safe) |
| `scan.completed` | Scan | scan produced a result |
| `scan.drained` | Scan | queued scans synced |
| `task.created` | Tasks | a task was generated |
| `task.completed` | Tasks | a task was completed |
| `task.overdue` | Tasks | a task passed its window |
| `recommendation.acted` | FarmBrain/UI | farmer acted on a recommendation |
| `RECOMMENDATION_EMITTED` | FarmBrain | a recommendation was surfaced |
| `notification.sent` | Notifications | a notification was delivered |
| `notification.read` | Notifications | a notification was read |
| `JOURNAL_ENTRY_CREATED` | Timeline | a timeline/journal entry was written |

## Consumed by FarmBrainState (canonical ingestion kinds)
`farm_created` · `crop_added` · `scan_completed` · `task_completed` · `weather_update`
→ folded into ONE canonical `FarmBrainState` (see FARMBRAIN_SPEC.md). Per the FarmBrainState
contract, sources with no live feed (yield $, market, funding, buyers) resolve to `no_live_feed` —
**never fabricated**.

## Rule
Domains publish facts; **FarmBrain is the only consumer that produces recommendations.** New
cross-domain communication is added as an event here — not as a direct import into another domain's
internals. This keeps the seams clean (and makes a future service extraction a bounded refactor).
