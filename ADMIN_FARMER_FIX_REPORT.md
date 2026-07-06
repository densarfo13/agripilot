# ADMIN_FARMER_FIX_REPORT.md (2026-07-05)

## 1. Root cause
`/farmers/:id` (FarmerDetailPage) placed `const [showPhotoUpload] = useState(false)` **below** the
`loading` and error early returns. The loading render ran N hooks; the successful-load render
reached the extra `useState` and ran N+1 → React threw *"Rendered more hooks than during the
previous render"* → RouteErrorBoundary → **"Something went wrong"**. This was invisible to the
hooks gate because line 1 of the file carried a blanket `eslint-disable react-hooks/rules-of-hooks`
(a May-2026 TODO) — measured: it hid **exactly one** violation, this one. Secondary defect: the
loader's `.catch(() => setLoadError('Failed to load farmer'))` discarded status/body, so admins saw
a generic string with no diagnostic.

## 2. Files changed
- `src/pages/FarmerDetailPage.jsx` — removed the file-level lint suppression; hoisted the hook
  above all early returns; status-aware states; `FarmerLoadError` surface (renders in page body,
  never thrown → shell/sidebar survive).
- **NEW** `src/pages/farmerDetail/farmerLoadState.js` — pure classifier / shape-guard / diagnostic
  builder (testable).
- **NEW** `src/pages/farmerDetail/__tests__/farmerLoadState.test.js`.

## 3. Admin farmer page fix
Six render states, each safe: LOADING · LOADED · NOT_FOUND · UNAUTHORIZED · SERVER_ERROR ·
NETWORK_ERROR (+ BAD_SHAPE for a malformed 200 that would otherwise crash on `farmer.fullName`).
Retry shown only for transient states; "Back to Farmers" always; malformed/HTML/array 200 →
BAD_SHAPE, never a crash.

## 4. Error boundary fix
The page no longer throws on the success path (root cause removed), so the whole-page boundary is
not tripped by this bug. For any residual failure, staff get an inline **Export Diagnostic JSON**
(state · HTTP status · message · route · farmerId · deployed commit) with a copy affordance;
non-staff see farmer-friendly copy only. The error surface renders inside `page-body` — the sidebar
and shell stay usable.

## 5. Tests added
farmerLoadState: 404→NOT_FOUND, 401/403→UNAUTHORIZED, 500/502→SERVER_ERROR, 0→NETWORK_ERROR,
malformed/HTML/array→BAD_SHAPE, valid shape accepted, retryability per state, bounded safeSnippet
(circular-safe), diagnostic envelope shape, **+ a regression guard asserting the file-level
hooks-rule suppression never returns**.

## 6. Production verification
On a staff session: open `/farmers/<validId>` → detail renders (no "Something went wrong"); open
`/farmers/<garbage-id>` → NOT_FOUND card with Back (no crash); kill network, Retry → NETWORK_ERROR;
confirm sidebar stays usable throughout; click **Export Diagnostic JSON** on any error → JSON copied.
