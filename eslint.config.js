// eslint.config.js — flat config, scoped to React hook rules.
//
// Why narrow
//   The codebase predates a project-wide lint policy. A blanket
//   ESLint setup would surface thousands of unrelated style /
//   import / no-unused-vars findings. The ONLY rule we enforce
//   right now is the one we keep regressing on:
//
//     react-hooks/rules-of-hooks       — error
//     react-hooks/exhaustive-deps      — warn
//
//   `npm run lint:hooks` returns non-zero if either rule is
//   violated anywhere in src/, so the React #300 / #310 class
//   of bugs cannot land again without CI catching it.
//
//   When the team is ready to broaden the lint surface (no-undef,
//   import/order, etc.) add the rules here in a follow-up PR.
//
// Targets
//   • src/**/*.{js,jsx,ts,tsx}            — every client module
//   • Excludes: node_modules, dist, build, .next, coverage, server.
//
// Why ESLint flat config (not legacy .eslintrc)
//   ESLint 9 (installed) DEFAULTS to flat config. The legacy
//   .eslintrc family is no longer auto-discovered.

import reactHooks from 'eslint-plugin-react-hooks';
import globals    from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      'server/**',
      'android/**',
      'ios/**',
      'public/**',
      'scripts/**',
      'security-tests/**',
    ],
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType:  'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // The hard guarantee — no conditional hook calls, no hook
      // calls inside loops / try blocks / nested functions, and
      // every component must call its hooks in the same order
      // on every render. Violating this rule causes React error
      // #300 (StrictMode) or #310 (production).
      'react-hooks/rules-of-hooks': 'error',
      // Soft warning — surfaces stale-closure / dependency-array
      // bugs without blocking the build. Promote to 'error' once
      // the existing exemptions are cleared.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
