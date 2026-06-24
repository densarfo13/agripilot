# FARMER_DEMO_CHECKLIST.md

**Run this before standing in front of a real farmer.** Date: 2026-06-24.
Goal: zero surprises during a live scan demo. ~10 minutes.

---

## A. The night before (operator, on the demo device)
- [ ] Device is the **target class**: a mid-range Android on Chrome (or the
      iPhone you'll actually demo). Test on THAT device, not a laptop.
- [ ] **Online** — confirm a working data connection. (No offline shell yet;
      H2.) If the venue is patchy, tether a hotspot.
- [ ] Open the app, **log in**, complete onboarding once (crop + location) so
      the farmer sees a warm, populated Home — not an empty first-run.
- [ ] **Set language to Twi** (🌐 header). Walk every demo screen in Twi and
      confirm no English on: scan result, quality coaching, "Do this today",
      follow-up, Review Queue. (60 scan strings translated this cycle.)
- [ ] **Provider is live:** open `/api/scan/diagnostics?live=1` (logged in) →
      confirm `providerConfigured:true` and `live.httpStatus:200`. If 401/429,
      stop and fix the key before demoing — every scan will read "unclear".
- [ ] Do **3 real scans** (a healthy leaf, a clearly-diseased leaf, a blurry
      shot). Confirm: healthy → "Looks Healthy"; diseased → a named issue +
      "Do this today"; blurry → friendly retake coach, **no "Unknown Plant"**,
      no error screen.
- [ ] Save a plant → confirm it appears in **My Plants**. Reopen the app →
      confirm it's still there. (Don't clear browser data — H1: no server backup.)

## B. Two minutes before (in the room)
- [ ] App already **open and logged in** (don't cold-start on stage).
- [ ] Camera permission **already granted** (grant it during setup, not live).
- [ ] Battery > 50%, screen brightness up (camera + outdoor light).
- [ ] One **known-good leaf** in your pocket as the guaranteed-success scan.

## C. The demo flow (what to actually show)
1. **Scan a real leaf** → plant name + confidence + "Do this today" (in Twi).
2. **Tap Listen** → it reads the result aloud. *(If on Twi and you hear an
   English-accented voice, that's the known TTS-voice gap — L1; lead with the
   text, treat voice as a bonus.)*
3. **Save to My Plants** → show it lands in the farmer's plant list.
4. **Show the daily task** the scan created on Home.
5. Optional: switch language live (🌐) to show the farmer their own language.

## D. Do NOT demo (not pilot-ready)
- ❌ **Buyers / marketplace / "Sell" cross-device** — listings are device-local
      and the buyer flow is dark. A buyer on another phone sees nothing.
- ❌ **Offline scanning** — turn airplane mode OFF; the app shell needs network.
- ❌ **Clearing browser data / switching devices mid-demo** — local data is not
      yet server-backed; it won't follow the farmer to a new device.

## E. If something goes wrong (recovery scripts)
- **"Scan unclear" on a clear leaf** → check `/api/scan/diagnostics?live=1`
  (key/quota). Fall back to the pocket known-good leaf.
- **Camera won't open** → use "Upload a photo" (gallery) — the fallback path
  is fixed (F1) and works.
- **White screen after a recent deploy** → it self-recovers once (cache+SW
  purge + reload); if not, hard-reload.
- **Slow load on venue wifi** → the bundle is splitting in; wait for Home,
  then it's fast. (Pre-load before the farmer arrives — step B.)

## F. One-line truth to tell the farmer
"It looks at your plant, tells you in your language what it might be and what
to do today, and remembers it for you." Everything in that sentence works.
