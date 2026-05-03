#!/usr/bin/env node
/**
 * check-launch-telemetry.mjs
 *
 * Go-live guard — asserts the events the launch team will
 * monitor on day 1 are actually wired into the codebase. If
 * the audit doc says we'll watch `backyard_guard_redirect` but
 * nothing in src/ ever calls `trackEvent('backyard_guard_redirect',
 * ...)`, that's a silent telemetry gap — the dashboard would
 * stay flat and the team would think nothing's broken when
 * actually nothing's being measured. This guard catches that
 * before launch.
 *
 *   node scripts/ci/check-launch-telemetry.mjs
 *     → exit 0 when every named event has at least one emit site
 *     → exit 1 with the list of unwired event names
 *
 * Match shapes recognised:
 *   * trackEvent('name', ...)
 *   * trackEvent("name", ...)
 *   * trackEvent?.('name', ...)
 *   * a.trackEvent('name', ...)
 *   * a.trackEvent?.('name', ...)
 *   * trackFundingEvent('name', ...)        (funding-side helper)
 *   * safeTrackEvent('name', ...)           (analytics queue helper)
 *
 * Add a new event below when the audit doc starts watching it.
 * Remove an event from the list when telemetry stops being a
 * launch-gate concern (e.g. promoted to a long-running KPI).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC  = path.join(ROOT, 'src');

// Events the launch-day dashboard needs. Each entry names the
// surface that should be the canonical emit site so a regression
// (rename / accidental delete) is easy to diagnose.
const REQUIRED_EVENTS = [
  { name: 'context_empty_state_shown', surface: 'BackyardGuard.jsx',
    why: 'Context-driven UI spec \u00a76 \u2014 fires when a garden-context user lands on a farm-only surface (Sell/Funding) and sees the empty-state card. Replaces the legacy backyard_guard_redirect event.' },
  { name: 'listing_expiry_sweep',     surface: 'App.jsx (boot microtask)',
    why: 'Reports how many ACTIVE listings auto-flipped to EXPIRED on app boot.' },
  { name: 'home_all_set_scan_tap',    surface: 'AllSetForTodayCard.jsx',
    why: 'Conversion signal from the empty-state Scan CTA when no priority task exists.' },
  { name: 'sw_update_available',      surface: 'SWUpdateBanner.jsx',
    why: 'Fires when a new SW activates — measures how many users see the reload banner.' },
  { name: 'sw_update_reload',         surface: 'SWUpdateBanner.jsx',
    why: 'Conversion: how many tap "Reload" instead of dismissing the banner.' },
  { name: 'sw_update_later',          surface: 'SWUpdateBanner.jsx',
    why: 'Counter-conversion: how many tap "Later" — health signal on update friction.' },
  { name: 'onboarding_entry_view',    surface: 'OnboardingEntry.jsx',
    why: 'Top of the V2 entry funnel.' },
  { name: 'onboarding_entry_pick',    surface: 'OnboardingEntry.jsx',
    why: 'Scan vs Farm split — primary funnel signal.' },
  { name: 'onboarding_entry_skipped', surface: 'OnboardingEntry.jsx',
    why: 'Returning-user shortcut — confirms repair / cached-session paths fire.' },
  { name: 'experience_switch_tap',    surface: 'ExperienceSwitcher.jsx',
    why: 'Multi-experience users tap the chip to switch between garden + farm.' },
  { name: 'experience_add_garden_tap', surface: 'ExperienceManageCard.jsx',
    why: 'Single-experience farm user adds a garden — measures cross-context adoption.' },
  { name: 'experience_add_farm_tap',   surface: 'ExperienceManageCard.jsx',
    why: 'Single-experience garden user adds a farm — measures cross-context adoption.' },
  { name: 'feedback_prompt_shown',     surface: 'UserFeedbackPromptHost.jsx',
    why: 'Quick-feedback prompt rendered after a meaningful action.' },
  { name: 'feedback_submitted',        surface: 'userFeedbackStore.js',
    why: 'User picked an option (or sent free-form text) — counts canonical confusion buckets.' },
  { name: 'feedback_top_issue_viewed', surface: 'FeedbackDashboard.jsx',
    why: 'Admin opened the dashboard and saw the recommended next fix.' },
  { name: 'experience_fallback_auto_repair', surface: 'ExperienceFallback.jsx',
    why: 'Auto-repair fired when the recovery branch would have shown — measures self-heal hit rate.' },
  { name: 'scan_hybrid_applied', surface: 'ScanPage.jsx',
    why: 'Hybrid engine refined the image-only verdict — measures rule-pipeline hit rate per issue.' },
  { name: 'scan_feedback', surface: 'ScanFeedbackPrompt.jsx',
    why: 'User answered "Was this helpful?" — feeds the training-data foundation (ML §9).' },
  { name: 'scan_verification_answer', surface: 'ScanVerificationChecklist.jsx',
    why: 'User answered a verification yes/no check — feeds high-confidence tier downgrade rules.' },
  { name: 'scan_expert_cta_tap', surface: 'ScanLocalExpertCTA.jsx',
    why: 'User tapped "Find local help" on the scan recovery card — measures expert-second-opinion demand.' },
  { name: 'scan_hero_tap', surface: 'ScanHero.jsx',
    why: 'User tapped the Home above-the-fold scan CTA — measures the retention loop entry point.' },
  { name: 'scan_fallback_used', surface: 'ScanPage.jsx',
    why: 'Scan returned the rule-based fallback (slow API or offline) — measures perf budget violations.' },
  { name: 'setup_garden_completed', surface: 'QuickGardenSetup.jsx',
    why: 'User completed the optimized garden onboarding — funnel hit per region.' },
  { name: 'setup_farm_completed', surface: 'QuickFarmSetup.jsx',
    why: 'User completed the optimized farm onboarding — funnel hit + unit pick by region.' },
  { name: 'treatment_add_to_plan', surface: 'TreatmentGuidanceCard.jsx',
    why: 'User accepted the engine-recommended non-chemical actions into Today\u2019s Plan.' },
  // Production-hardening spec \u00a71 \u2014 onboarding funnel telemetry.
  // The 8 events below let the launch dashboard build a complete
  // funnel without joining the experience-specific
  // setup_*_completed events.
  { name: 'onboarding_started',          surface: 'FastFlow.jsx',
    why: 'New user reaches the canonical onboarding entry (Step 0 language picker).' },
  { name: 'onboarding_step_viewed',      surface: 'FastFlow.jsx',
    why: 'Each step transition fires; lets us see drop-off per step.' },
  { name: 'onboarding_step_completed',   surface: 'FastFlow.jsx',
    why: 'User completed a step (language picked / experience picked) \u2014 forward funnel.' },
  { name: 'onboarding_draft_saved',      surface: 'onboardingDraft.js',
    why: 'Draft snapshot persisted \u2014 confirms the form-state-preservation path is live.' },
  { name: 'onboarding_draft_malformed',  surface: 'onboardingDraft.js',
    why: 'Stored draft failed version / sanitiser checks; signal a data-shape regression.' },
  { name: 'onboarding_recovery_shown',   surface: 'RecoveryErrorBoundary.jsx',
    why: 'Recovery card surfaced after an unhandled render error \u2014 spike means a regression.' },
  { name: 'onboarding_recovery_used',    surface: 'RecoveryErrorBoundary.jsx',
    why: 'Recovery action tapped (try_again / fix_setup / restart_setup) \u2014 measures self-heal.' },
  { name: 'onboarding_completed',        surface: 'QuickGardenSetup.jsx / QuickFarmSetup.jsx',
    why: 'Onboarding finished \u2014 canonical funnel-completion event for day-1 attribution.' },
];

function listFiles(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip the test fixture / build output dirs if they ever
      // land under src — production code only.
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      listFiles(full, acc);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (ext === '.js' || ext === '.jsx' || ext === '.mjs') acc.push(full);
    }
  }
  return acc;
}

const sources = listFiles(SRC, []);

function eventEmittedAnywhere(eventName) {
  // Build a regex that catches the recognised emit shapes. The
  // event name is escaped for safety even though our list is
  // ASCII-only.
  const safe = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`trackEvent\\?\\?\\.\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`trackEvent\\?\\.\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`\\btrackEvent\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`\\.trackEvent\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`\\.trackEvent\\?\\.\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`trackFundingEvent\\(\\s*['"\`]${safe}['"\`]`),
    new RegExp(`safeTrackEvent\\(\\s*['"\`]${safe}['"\`]`),
  ];
  for (const f of sources) {
    let body;
    try { body = fs.readFileSync(f, 'utf8'); }
    catch { continue; }
    for (const re of patterns) {
      if (re.test(body)) return f;
    }
  }
  return null;
}

let failed = 0;
for (const ev of REQUIRED_EVENTS) {
  const found = eventEmittedAnywhere(ev.name);
  if (found) {
    const rel = path.relative(ROOT, found);
    process.stdout.write(`\u2713 ${ev.name}  \u2192  ${rel}\n`);
  } else {
    failed += 1;
    process.stdout.write(`\u2717 ${ev.name}\n`
      + `    expected emit site: ${ev.surface}\n`
      + `    why we monitor it:  ${ev.why}\n`);
  }
}

if (failed > 0) {
  process.stderr.write(
    `\nlaunch-telemetry: ${failed} required event(s) have no emit site in src/.\n`
    + `Either wire the missing trackEvent call or remove the event from the\n`
    + `REQUIRED_EVENTS list at the top of scripts/ci/check-launch-telemetry.mjs\n`
    + `(only do that if the launch dashboard truly stops watching it).\n`
  );
  process.exit(1);
}

process.stdout.write(`\n\u2713 launch-telemetry: ${REQUIRED_EVENTS.length} events wired.\n`);
