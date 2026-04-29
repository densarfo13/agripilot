/**
 * lucide.jsx — small inline icon set in the Lucide visual style.
 *
 * Why hand-rolled instead of `lucide-react`
 * ─────────────────────────────────────────
 * The repo doesn't ship `lucide-react` and the strict rule is
 * "do not redesign the entire app" — adding a 50KB icon dependency
 * for ~14 glyphs is a heavier change than a per-icon inline SVG.
 * The visual contract matches Lucide:
 *
 *   • 24×24 viewBox
 *   • stroke-only paths (no fills)
 *   • stroke="currentColor" so colour follows CSS
 *   • stroke-width=1.75, stroke-linecap=round, stroke-linejoin=round
 *
 * If the team later installs `lucide-react`, swap call sites with a
 * one-line import change — the prop API matches Lucide's React
 * component shape (`size`, `strokeWidth`, `className`).
 *
 * Icons exported here are deliberately limited to what My Farm
 * needs. Add more on demand rather than mirroring the full Lucide
 * catalogue (which would defeat the "no dependency" trade-off).
 */

import React from 'react';

function _Icon({ children, size = 20, strokeWidth = 1.75, className = '', title, ...rest }) {
  // role="img" + <title> when one is supplied so the icon participates
  // in the accessibility tree. When omitted, mark aria-hidden so
  // assistive tech ignores decorative icons.
  const ariaHidden = title ? undefined : true;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={ariaHidden}
      aria-label={title || undefined}
      className={('icon ' + className).trim()}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// ─── Icon set ────────────────────────────────────────────────

/** Sprout — used for "crop" and onboarding */
export const Sprout = (p) => (
  <_Icon {...p}>
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </_Icon>
);

/** Wheat — alternative crop glyph for stage indicators */
export const Wheat = (p) => (
  <_Icon {...p}>
    <path d="M2 22 16 8" />
    <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
    <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
    <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
  </_Icon>
);

/** Cloud-Sun — weather */
export const CloudSun = (p) => (
  <_Icon {...p}>
    <path d="M12 2v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="M20 12h2" />
    <path d="m19.07 4.93-1.41 1.41" />
    <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
    <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
  </_Icon>
);

/** Bug — pest risk */
export const Bug = (p) => (
  <_Icon {...p}>
    <path d="m8 2 1.88 1.88" />
    <path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
    <path d="M12 20v-9" />
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
    <path d="M6 13H2" />
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
    <path d="M22 13h-4" />
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </_Icon>
);

/** Activity — health / status */
export const Activity = (p) => (
  <_Icon {...p}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </_Icon>
);

/** Check-Circle — done / readiness */
export const CheckCircle = (p) => (
  <_Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </_Icon>
);

/** Alert-Triangle — needs attention */
export const AlertTriangle = (p) => (
  <_Icon {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </_Icon>
);

/** Map-Pin — GPS / location */
export const MapPin = (p) => (
  <_Icon {...p}>
    <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </_Icon>
);

/** Camera — scan crop / photo proof */
export const Camera = (p) => (
  <_Icon {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </_Icon>
);

/** Calendar — last updated, dates */
export const Calendar = (p) => (
  <_Icon {...p}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </_Icon>
);

/** Trending-Up — progress / smart suggestions */
export const TrendingUp = (p) => (
  <_Icon {...p}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </_Icon>
);

/** Coins — funding / opportunities */
export const Coins = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </_Icon>
);

/** Shopping-Cart — buyer readiness */
export const ShoppingCart = (p) => (
  <_Icon {...p}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </_Icon>
);

/** Refresh — update farm */
export const RefreshCw = (p) => (
  <_Icon {...p}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </_Icon>
);

/** Shield-Check — verification */
export const ShieldCheck = (p) => (
  <_Icon {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </_Icon>
);

/** Plus — add farm */
export const Plus = (p) => (
  <_Icon {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </_Icon>
);

/** Inbox — records / listings */
export const Inbox = (p) => (
  <_Icon {...p}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </_Icon>
);

/** Cloud-Off — weather data missing */
export const CloudOff = (p) => (
  <_Icon {...p}>
    <path d="m2 2 20 20" />
    <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
    <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
  </_Icon>
);

/** Alert-Circle — priority / urgency chip */
export const AlertCircle = (p) => (
  <_Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </_Icon>
);

/** Volume-2 — listen / speaker */
export const Volume2 = (p) => (
  <_Icon {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </_Icon>
);

/** Lightbulb — smart suggestions */
export const Lightbulb = (p) => (
  <_Icon {...p}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </_Icon>
);

/** Cloud-Rain — weather: rain expected */
export const CloudRain = (p) => (
  <_Icon {...p}>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M16 14v6" />
    <path d="M8 14v6" />
    <path d="M12 16v6" />
  </_Icon>
);

/** Arrow-Right — list-row affordance */
export const ArrowRight = (p) => (
  <_Icon {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </_Icon>
);

/** Wallet — funding header glyph */
export const Wallet = (p) => (
  <_Icon {...p}>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </_Icon>
);

/** Help-Circle — request help / FAQ */
export const HelpCircle = (p) => (
  <_Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </_Icon>
);

export default {
  Sprout, Wheat, CloudSun, Bug, Activity, CheckCircle, AlertTriangle,
  MapPin, Camera, Calendar, TrendingUp, Coins, ShoppingCart, RefreshCw,
  ShieldCheck, Plus, Inbox, CloudOff, AlertCircle, Volume2,
  Lightbulb, CloudRain, ArrowRight, Wallet, HelpCircle,
};
