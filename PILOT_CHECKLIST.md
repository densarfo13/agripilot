# Pilot Checklist

Four checklists for the four pilot audiences. Code prerequisites are **met** (399 gates green);
the remaining items are **operational** (a person + a device), which is the point of a pilot.

## 1. Internal pilot (the gate to everything)
- [ ] One real scan of a supported crop on a real phone → confident named result, confirmed via
      `/api/admin/scan/last-trace`. (Flips the live provider cert DEGRADED → READY.)
- [ ] One real onboarding + GPS (and town/ZIP fallback) on real **Android** and **iPhone**, read via
      `/api/admin/location/debug`.
- [ ] Telemetry events fire + are visible for a full session (wire the remaining 8 first).
- [ ] First-paint / scan latency / GPS-to-save captured on device.
- [ ] Spot-check the 9 core screens in fr/tw/sw/ha for leaks; confirm no clipped text.
- [ ] Timeline reads from DB after a real scan (source-of-truth confirmed).

## 2. NGO pilot
- [ ] Field-officer account: bulk-add / invite farmers (server invites + idempotency verified).
- [ ] Tenant isolation confirmed: NGO A cannot see NGO B's farmers (gate-verified; confirm live).
- [ ] Audit log shows farmer-provisioning + key events.
- [ ] Outcome/follow-up surfaces render for a real cohort.
- [ ] Export/report produces a real file.

## 3. Commercial farm
- [ ] Multi-farm switch + per-farm context correct.
- [ ] Sell decision honest on a real crop (SELL_NOW / WAIT / NEED_MORE_PRICE_DATA / NO_BUYERS_FOUND).
- [ ] Task completion → timeline + KPI funnel updates.
- [ ] Performance acceptable on a mid-range Android.

## 4. Farmer pilot (25 users)
- [ ] Install → onboard → add farm/crop → location → first scan → first recommendation → first task,
      end-to-end on a real device in under ~15 min.
- [ ] No dead-ends, no raw keys, no backend words seen (gate-verified; confirm on screen).
- [ ] Day-2 return: the farmer comes back and the Home shows one clear action.
- [ ] Capture scan-success / retention / crash-free numbers → feed the lifecycle ladder.

**Passing checklist #1 escalates the verdict from PILOT READY toward PRODUCTION READY** as the live
metrics populate the scan lifecycle ladder (`certifyScanLifecycle`) and the provider cert.
