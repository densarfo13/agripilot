/**
 * StandardHome.jsx — the Standard Mode Home renderer.
 *
 * Hard-split partner of SimpleHome. Used when `useSimpleMode().enabled`
 * is false. The two renderers never share a component tree — Home.jsx
 * routes to one or the other and returns early.
 *
 * The standard renderer's body lives inside src/pages/Home.jsx (the
 * immersive hero / daily plan card / weather / streak / on-track row,
 * gated behind the `simpleModeEnabled` branch). This file exists as a
 * NAMED SYMBOL so the runtime diagnostic
 * (window.__simpleModeHealth().homeComponent === 'StandardHome') and
 * the governance gate can attest which renderer the page chose.
 *
 * To prevent any chance of a render loop when this component is reached
 * directly, it short-circuits to a tiny marker rather than re-entering
 * the page-level branch.
 */

import React from 'react';

export default function StandardHome() {
  // The standard renderer's actual content lives in the Home page body
  // and is never reached via this symbol in production — Home.jsx
  // branches before invoking either Simple or Standard renderers.
  return (
    <div data-testid="standard-home" data-renderer="standard" />
  );
}
