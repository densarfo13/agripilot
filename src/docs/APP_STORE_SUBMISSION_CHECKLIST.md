# App Store submission checklist — Farroway

Companion to `APP_STORE_LAUNCH_AUDIT.md`. The audit confirms the **code** is ready; this checklist tracks the **operational** items that must be done outside the codebase before pressing Submit.

> **How to use:** every item is a tickbox. The release coordinator owns this file and ticks each item with a date + initials in the launch ticket. Do not submit while any tickbox is empty.

---

## Required before submission

### App Store Connect listing

- [ ] App name finalised (consistent with branding everywhere — `Farroway`)
- [ ] App icon uploaded (1024×1024 source, all required derived sizes)
- [ ] Screenshots uploaded for **iPhone 6.7"**, **iPhone 5.5"**, **iPad Pro** (per Apple requirements at submission time)
- [ ] App description copy reviewed by product
- [ ] Keywords reviewed by product
- [ ] Primary category: **Productivity** (or Lifestyle — confirm with marketing)
- [ ] Privacy Policy URL pointed at the live `/privacy` route
- [ ] Terms / EULA URL pointed at the live `/terms` route
- [ ] Support URL pointed at the live `/contact` route
- [ ] Marketing URL set (or deliberately omitted)
- [ ] Test account credentials supplied to Apple reviewers (email + password, role = farmer in Ghana for the most representative flow)

### Permissions (`Info.plist` for iOS, `AndroidManifest.xml` for Android)

- [ ] **Camera permission reason** — wording must match the actual scan flow:
      *"Farroway uses your camera to take crop and plant photos so you can track issues and harvest readiness. Photos remain on your device."*
- [ ] **Photo library permission reason** — same wording, applied to library use:
      *"Farroway uses photos so you can attach existing crop or plant images when reporting issues."*
- [ ] **Location permission reason** — wording must match region UX + weather:
      *"Farroway uses your country (and, if you allow it, your coarse location) to give regional guidance and local weather. You can choose your country manually."*
- [ ] **Microphone permission reason** — wording must match the voice assistant:
      *"Farroway uses your microphone for the voice assistant so you can ask questions and navigate by voice. Audio is processed on your device."*

### Privacy nutrition label (App Store privacy questions)

Match the actual data flow documented in `PrivacyPolicy.jsx`:

- [ ] **Location** — collected, linked to user, used for app functionality
- [ ] **Photos / videos** — collected, **not** linked to user, processed on device
- [ ] **Email address** — collected, linked to user, used for app functionality
- [ ] **User content** (farm profile, feedback) — collected, linked to user, used for app functionality
- [ ] **Identifiers** (account ID) — collected, linked to user
- [ ] **Diagnostics** (analytics events) — collected, **not** linked to user, used for product improvement
- [ ] No third-party SDKs perform tracking — confirm by checking `package.json`

### Backend / infrastructure

- [ ] Production backend is live and stable for at least 7 days before submission
- [ ] `DATABASE_URL` set in Railway / hosting
- [ ] `JWT_SECRET` set in Railway / hosting
- [ ] `VITE_API_BASE_URL` baked into the production bundle
- [ ] (Optional) Twilio + SendGrid keys set if SMS / email features are enabled at launch
- [ ] Database migrations have been run on production (`prisma migrate deploy` exit 0)
- [ ] Service worker cache-busts on deploy (verified by `bake-sw-version.mjs` post-build hook)
- [ ] Support inbox `support@farroway.app` is monitored and routes to a real human

### Code-level pre-flight gates

- [ ] `npm run launch-gate` (full) ends with `✓ Launch gate passed. Safe to deploy.`
- [ ] `npm run guard:crops` returns `crop-type-drift: <N> references (baseline <N>, tolerance 0)` (no growth)
- [ ] `npm run guard:i18n` reports `all launch languages pass every domain`
- [ ] `npm run guard:crop-render` returns clean across all JSX files
- [ ] No `console.error` on cold app boot in the production build (run `npm run build` then `vite preview` and watch DevTools console)

### Manual device tests (per `LAUNCH_PLAYBOOK.md` §1)

- [ ] **A. New Ghana farmer flow** completes end-to-end on a real Android device
- [ ] **B. Returning Ghana farmer** logs back in without re-onboarding
- [ ] **C. U.S. backyard flow** shows "My Garden" wording and no Sell tab
- [ ] **D. Unknown country** shows generic plan + region banner
- [ ] **E. GPS denied** lets user pick country manually and continue
- [ ] **F. Backend offline** allows farm save + Home + pending-sync banner
- [ ] **G. Corrupted localStorage** is repaired by the new bootstrap step (verified by manually editing `farroway_farms` to invalid JSON and refreshing)
- [ ] Language switch through **English → French → Hindi → Twi → Hausa** on `/dashboard`, `/my-farm`, `/tasks`, `/progress`, `/funding` shows no English bleed
- [ ] **Voice button** speaks the active language label on the four main farmer pages
- [ ] **Voice assistant** floating mic responds to `tasks` / `farm` / `progress` / `scan` / `weather` / `buyers`
- [ ] Camera permission flow completes on iOS and Android
- [ ] Location permission denial does not block onboarding
- [ ] Bottom nav active state highlights correctly on every tab
- [ ] No horizontal scroll on iPhone 14 / Galaxy S23 (mid-tier) viewports

### Known launch risks accepted

These are documented in the launch playbook and acknowledged at submission time:

- [ ] **Twi voice quality** — only ~22 prompts have prerecorded native-speaker mp3; remaining text falls through browser TTS with the proper `ak` BCP-47 tag. Pronunciation is acceptable but imperfect.
- [ ] **Hausa server TTS** — not configured; falls back to Android Chrome's `ha-NG` voice on devices that ship it. Other browsers fall through to Nigerian English.
- [ ] **Web Speech recognition unavailable on Firefox / iOS Safari** — `MicInput` and `VoiceAssistant` self-hide when unsupported. Safari users navigate by tap.
- [ ] **`farroway..logo.jpg` stray file** at repo root is not part of the production build (gitignored doesn't apply but Vite doesn't import it). Cleanup task pending.

---

## Submission day runbook

1. Run `npm run launch-gate` one more time — must end ✓.
2. Verify all tickboxes above are filled.
3. Build the iOS / Android bundles (Capacitor / Cordova / etc. — out of scope for this codebase).
4. Upload to App Store Connect / Google Play Console.
5. Fill the "What's new" copy.
6. Press Submit.
7. Post in the launch channel: build hash, commit SHA, submission date.

After submission:
- Watch the support inbox daily.
- Watch the Sentry / Railway error stream daily for the first 7 days.
- Follow the **first-72-hour operating plan** in `LAUNCH_PLAYBOOK.md` §5.

---

*Last updated: companion to commit at HEAD when this file landed. Owner: launch coordinator.*
