#!/usr/bin/env node
/**
 * scripts/check-raw-crop-render.js — public-path entry point that
 * delegates to the canonical implementation in scripts/ci/.
 *
 * The actual scanner lives at scripts/ci/check-raw-crop-render.mjs
 * (alongside the other CI guards) so we don't duplicate the rule
 * set. This file exists because the i18n upgrade spec asks for a
 * stable script path under `scripts/` and a `check:crop-labels`
 * npm script. Both work; both run the exact same rules.
 *
 *   npm run guard:crop-render   → scripts/ci/check-raw-crop-render.mjs
 *   npm run check:crop-labels   → this file → same canonical guard
 */

import './ci/check-raw-crop-render.mjs';
