// ══════════════════════════════════════════════════════════════════
// PERMANENT ROUTING RULE (optional-setup-perm — 2026-05-05)
//
// ProfileGuard is a PASS-THROUGH. It never auto-redirects to any
// setup, onboarding, or location screen. Setup is OPTIONAL.
//
// DO NOT ADD:
//   • <Navigate to="/onboarding/..." />
//   • <Navigate to="/profile/setup" />
//   • navigate('/setup')  or  navigate('/location')
//   • any redirect based on location / crop / farm completeness
//
// Auth is the ONLY reason to redirect (handled by AuthGuard /
// App.jsx before this component is even mounted).
// Missing farm / location / crop → show inline prompts only.
// See src/core/routePolicy.js for the canonical rule set.
// ══════════════════════════════════════════════════════════════════

export default function ProfileGuard({ children }) {
  // Setup is optional. Always render children.
  // Inline prompt cards (CompleteSetupCard, EmptyFarmState, etc.)
  // surface missing data on the destination page without trapping
  // the user on a setup screen they did not choose to visit.
  return children;
}
