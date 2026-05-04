/**
 * SWUpdateBanner — DEPRECATED no-op (May 2026 SW removal).
 *
 *   <SWUpdateBanner />   // renders nothing
 *
 * The previous implementation listened for the
 * `farroway:sw_new_version` window event that the old
 * `registerServiceWorker.js` helper used to dispatch. Service
 * worker registration was permanently removed in the May 2026
 * stability pass, so that event never fires. Rather than
 * unmount the component (would require touching every parent),
 * we keep the export as a no-op that returns null directly.
 *
 * Callers in App.jsx etc. need NO change. The single mount
 * point still works; it just renders nothing.
 *
 * Strict-rule audit
 *   • Pure presentational. Returns null synchronously.
 *   • No effects, no listeners, no analytics fires.
 *   • Safe under SSR + locked-down browsers.
 */

import React from 'react';

export default function SWUpdateBanner() {
  return null;
}
