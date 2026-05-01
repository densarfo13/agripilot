# Farroway — Full Architecture Go-Live Test Checklist

**Companion to:** `FULL_ARCHITECTURE_GO_LIVE_AUDIT.md`
**Verdict carried forward:** READY FOR TESTING

19 pass/fail scenarios to walk through on a real device before
flipping the production DNS / pushing the App Store build.

---

## Pre-flight (automated)

```
npm run launch-gate:final     ← all 4 sub-guards green
npm run guard:mobile          ← 58/58
npm run guard:telemetry       ← 15/15
npm run guard:ios-quirks      ← 3/3 categories within baseline
npm run guard:i18n            ← 100% across 6 launch languages
npm run guard:crops           ← 272 (baseline)
npm run build                 ← Vite SW versioned bundle
```

If any of the above fail, **STOP** — do not proceed to manual.

---

## Manual scenarios

### 1. Legacy backyard migrates to Garden

- Pre: localStorage has `farroway.farms` with one row,
  `farmType: 'backyard'`. No `farroway_full_architecture_migrated`
  sentinel.
- Action: open the app, sign in (or refresh).
- Expected:
  - `farroway_legacy_farms_backup` written (verbatim copy).
  - `farroway_gardens` array contains 1 row with
    `experience: 'garden'`.
  - `farroway_farms` array empty (or unchanged).
  - `farroway_full_architecture_migrated === 'true'`.
  - User lands on Home with garden experience surface.
- [ ] PASS

### 2. Legacy real farm migrates to Farm

- Pre: same setup but with `farmType: 'small_farm'`.
- Expected: row lands in `farroway_farms` with
  `experience: 'farm'`. Garden array empty. User lands on Home
  with farm experience surface.
- [ ] PASS

### 3. Garden setup works

- Land on `/start` as new U.S. user → choose Backyard.
- Save garden (plant + location + size category +
  growing location).
- Expected: `farroway_gardens` gets the new row.
  `farroway_active_experience = 'garden'`. Lands on `/home`.
- [ ] PASS

### 4. Farm setup works

- Same flow but choose Farm.
- Save farm (crop + country + farm type + size + unit).
- Expected: `farroway_farms` gets the new row.
  `farroway_active_experience = 'farm'`. Lands on `/home`.
- [ ] PASS

### 5. Switch Garden ↔ Farm works

- Pre: user has both a garden AND a farm.
- Tap the header chip Garden ↔ Farm.
- Expected:
  - Toast "Switched to Garden 🌱" / "Switched to Farm 🚜"
  - Bottom nav flips between BACKYARD_TABS and FARM_TABS
  - Home dashboard re-renders for the new context
  - `farroway_active_experience` flips
- [ ] PASS

### 6. Close/reopen restores last context

- Switch to Garden. Close the app.
- Reopen.
- Expected: lands on Home with Garden surface still active.
- [ ] PASS

### 7. Logout/reopen stays logged out

- Tap Logout.
- Expected: lands on `/login`. Refresh page →
  bootstrap reads `farroway_explicit_logout = 'true'`,
  short-circuits, stays on `/login`.
- Login manually → flag cleared, lands on `/home` with last
  active context.
- [ ] PASS

### 8. Garden nav has no Sell / Funding

- As a backyard user, inspect bottom nav.
- Expected: tabs are Home / My Garden / Tasks / Progress / Ask /
  Scan. Sell + Funding NOT present.
- Type `/sell` directly → redirected to `/home` (BackyardGuard
  fires `backyard_guard_redirect` analytics).
- Type `/funding` directly → same redirect.
- [ ] PASS

### 9. Farm nav has Sell / Funding

- As a farm user, inspect bottom nav.
- Expected: Home / My Farm / Tasks / Progress / Funding / Sell.
- [ ] PASS

### 10. Tasks isolated per experience

- Complete a task while Garden active.
- Switch to Farm.
- Expected: the garden task does NOT appear on the farm Today's
  Priority. Switch back → it reappears.
- [ ] PASS

### 11. Scan isolated per experience

- Run a scan while Garden active.
- Expected: scan history attaches to the garden's id.
- Switch to Farm. Run another scan.
- Expected: that scan attaches to the farm's id. Garden scan
  does not show in farm scan history.
- [ ] PASS

### 12. Funding restricted correctly

- Garden user tap Funding tab → tab is HIDDEN. Direct URL
  `/funding` → redirect to `/home`.
- Farm user → `/funding` renders FundingHub with cards.
- [ ] PASS

### 13. Sell restricted correctly

- Same: garden cannot reach `/sell`; farm can.
- Farm user lists produce → row saved with `status: ACTIVE` +
  `farmId` matching active farm.
- [ ] PASS

### 14. Buyer interest works

- As a buyer, browse `/marketplace` (public) or `/market/browse`
  (auth).
- Tap a listing → tap "I'm interested" → form submits.
- Buyer interest record created. Farmer sees the count on their
  My Listings card.
- Tapping again on the same listing should NOT create a
  duplicate interest.
- [ ] PASS

### 15. NGO/admin dashboard works

- Sign in with NGO/staff role → lands on `/applications`
  (per FarmerEntry redirect).
- Open `/ngo` → NGOOverview renders.
- 0-farmer state → empty state reads
  "Invite farmers to start tracking program activity."
- Mobile → `NgoBottomNav` renders 6 tabs (Dashboard / Farmers /
  Programs / Reports / Funding Leads / Settings).
- [ ] PASS

### 16. Language not mixed

- Switch to Hindi (or any non-English) language.
- Visit Home, Tasks, Scan, My Farm pages.
- Expected: every visible string is in Hindi. No English bleed.
  If any key is missing, the affected screen falls back to
  English entirely (per `useScreenTranslator`).
- [ ] PASS

### 17. Land size conversion correct

- Save a farm with 4,356,000 sq ft.
- Expected: displays "4,356,000 sq ft".
- Switch displayUnit to acres → displays "100 acres".
- Save → reopen → still 4,356,000 sq ft / 100 acres.
- No double conversion.
- [ ] PASS

### 18. Help / Contact / Privacy / Terms work

- Without signing in, visit `/help`, `/contact`, `/privacy`,
  `/terms`. Each renders.
- Privacy mentions: camera/photos, location, analytics, account
  data, **marketplace contact handling**, **localStorage +
  data deletion**.
- [ ] PASS

### 19. Mobile smoke test

On a real iPhone or Android device:
- [ ] Bottom nav doesn't overlap home indicator
- [ ] Keyboard doesn't cover the focused input
  (`scroll-margin-bottom: 96px` global rule)
- [ ] Camera permission denied → "Upload from gallery" promotes
  to primary CTA on `/scan`
- [ ] PWA "Reload" banner appears when SW updates
- [ ] No console errors on initial load
- [ ] Service worker registers
- [ ] All 4 legal routes reachable without sign-in

---

## Final verdict gate

Mark the build **READY** only when all 19 scenarios pass.

If ANY of the following fails, mark **NOT READY**:
- Migration duplicates data (#1, #2)
- Active context fails (#3, #4, #6)
- Logout auto-login returns (#7)
- Garden/farm switch fails (#5)
- Tasks/scans mix (#10, #11)
- Buyer/admin routing fails (#14, #15)
- Home crashes
