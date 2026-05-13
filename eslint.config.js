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
//   • src/**/*.{js,jsx}                   — every client JS/JSX module
//   • Excludes: node_modules, dist, build, .next, coverage, server.
//
// Note on TypeScript files
//   .ts and .tsx files are NOT linted by this config. ESLint's
//   default parser (espree) can't read TS syntax — interface
//   declarations + `as` casts + type annotations trip a parsing
//   error on every file. The build pipeline (Vite + oxc) handles
//   TS type-checking at compile time, which is the correct gate.
//   Adding @typescript-eslint/parser would let lint cover .ts
//   too, but it's a heavier dependency for marginal value given
//   none of the .ts files in the tree are React components
//   (governance/coordination/global modules only).
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
    files: ['src/**/*.{js,jsx}'],
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
      // Warn — stale-closure / missing-dep findings stay
      // visible in the lint output but don't block CI. Many
      // legacy callsites have intentional missing deps (the
      // closure captures a primitive that changes reference
      // identity on every render; including it would re-fire
      // the effect uselessly). These cases carry inline "why
      // excluded" comments above the hook call; promoting
      // them to `// eslint-disable-next-line` would be 100+
      // mechanical edits.
      //
      // The `rules-of-hooks` error above stays at 'error' —
      // that's the React #300/#310 class of bugs we cannot
      // tolerate. Missing-deps is a different category: it
      // reveals stale closures, but never crashes React.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
