/**
 * pathOwnership.mjs — canonical path→ownership model for commit-scope discipline.
 *
 * ONE source of truth, imported by:
 *   • scripts/ci/validate-commit-scope.mjs  (CLI validator, used by hook + CI)
 *   • scripts/git/safe-commit.mjs           (preview→validate→commit→verify→push)
 *   • .github/workflows/commit-hygiene.yml  (via the validator)
 *
 * Motivation: an auto-commit process was bundling unrelated modules (NGO fix +
 * Jarvis + Prisma + infra) into single commits. This model classifies every
 * changed path into exactly ONE ownership group so a commit that spans more
 * than one FEATURE group can be rejected with a report.
 *
 * Group types:
 *   feature      — a product area. A commit may touch AT MOST ONE feature group.
 *   crosscutting — schema / infra / theme. May accompany a single feature group.
 *   neutral      — docs / uncategorised. Reported but never blocks on its own.
 *
 * Rules are ORDERED and FIRST-MATCH-WINS — put specific groups before broad ones.
 * No third-party deps (mirrors the other pure-Node CI guards).
 */

// ─── Ownership groups (ordered; first match wins) ───────────────────────────
export const GROUPS = [
  // ── Cross-cutting concerns first (most specific) ──────────────────────────
  {
    id: 'infrastructure', label: 'Infrastructure / CI-CD', type: 'crosscutting',
    globs: [
      '.github/**', '.githooks/**', 'scripts/ci/**', 'scripts/deploy/**',
      'scripts/git/**', 'Dockerfile', '.dockerignore', '.railwayignore',
      'railway.{json,toml}', 'nixpacks.toml', 'RELEASE_GUARD.md',
      'path-ownership.config.mjs', '.gitignore', '.gitattributes',
      // Build / dependency / tooling config (not owned by any one feature).
      'package.json', 'package-lock.json', 'server/package.json',
      'server/package-lock.json', 'tsconfig*.json', 'server/tsconfig*.json',
      'vite.config.*', 'vitest.config.*', 'server/vitest.config.*',
      'vitest.setup.*', '.eslintrc*', 'eslint.config.*', 'babel.config.*',
      'postcss.config.*', 'tailwind.config.*', 'capacitor.config.*',
    ],
  },
  {
    id: 'prisma', label: 'Prisma / Schema', type: 'crosscutting',
    globs: [
      'server/prisma/**', 'src/generated/prismaModelFields.json',
      'scripts/check-prisma*.mjs', 'scripts/ci/check-prisma*.mjs',
      'scripts/check-prisma-fields.mjs',
      'server/src/__tests__/checkPrismaFieldsGate.test.js',
    ],
  },
  {
    id: 'ui-theme', label: 'UI Theme / Design System', type: 'crosscutting',
    globs: [
      'src/**/theme/**', 'src/**/*[Tt]heme*', 'src/styles/**', 'src/**/*.css',
      'src/design/**', 'src/**/designTokens*', 'DESIGN_TOKENS.md',
      'DESIGN_SYSTEM*.md', 'DESIGN_BIBLE.md',
    ],
  },

  // ── Feature areas (a commit may touch only one) ───────────────────────────
  {
    id: 'scan', label: 'Scan / Plant Intelligence', type: 'feature',
    globs: [
      'src/runtime/scan/**', 'src/runtime/plant*/**', 'src/**/[Ss]can*',
      'server/routes/scan*', 'server/routes/seed-scans.js',
      'server/src/modules/**/scan*', 'scripts/check-scan-*.mjs',
      'scripts/check-plant-*.mjs',
    ],
  },
  {
    id: 'ngo-dashboard', label: 'NGO Dashboard', type: 'feature',
    globs: [
      'server/routes/ngoDashboard.js', 'server/routes/ngoV2.js',
      'server/src/modules/ngo*/**', 'server/src/modules/ngoReports/**',
      'server/src/modules/ngoAdmin/**', 'server/src/modules/ngoImport/**',
      'server/src/__tests__/ngo*', 'src/**/[Nn]go*',
      'src/runtime/organization/**', 'scripts/check-ngo-*.mjs',
    ],
  },
  {
    id: 'admin', label: 'Admin Console', type: 'feature',
    globs: [
      'src/pages/Admin*', 'src/runtime/admin/**', 'src/admin/**',
      'server/routes/adminBasic.js', 'server/src/modules/**/admin*',
      'scripts/check-admin-*.mjs', 'ADMIN_*.md',
    ],
  },
  {
    id: 'analytics', label: 'Analytics', type: 'feature',
    globs: [
      'src/analytics/**', 'src/runtime/analytics/**',
      'server/routes/analytics*.js', 'server/src/modules/analytics/**',
      'scripts/check-*analytics*.mjs', 'ANALYTICS_*.md',
    ],
  },
  {
    id: 'jarvis', label: 'Jarvis / Autonomous', type: 'feature',
    globs: [
      'JARVIS*', 'src/runtime/jarvis/**', 'src/**/[Jj]arvis*',
      'server/src/modules/autonomousActions/**', 'server/src/modules/decision*/**',
      'src/runtime/farmos13/**',
    ],
  },
  {
    id: 'farmer-app', label: 'Farmer App', type: 'feature',
    globs: [
      // Broad: farmer-facing pages/routes/modules. Placed LATE so more
      // specific feature groups above claim their files first.
      'server/routes/farm*.js', 'server/routes/farmProfile.js',
      'server/routes/harvest*.js', 'server/routes/tasks.js',
      'server/routes/seasons.js', 'server/routes/recommendations.js',
      'server/routes/usRecommendations.js', 'server/routes/cropCycles.js',
      'server/routes/auth.js',
      'server/src/modules/farmers/**', 'server/src/modules/farmProfiles/**',
      'server/src/modules/auth/**', 'server/src/modules/lifecycle/**',
      'src/runtime/farmer/**', 'src/pages/**',
    ],
  },

  // ── Neutral (reported, never blocks) ──────────────────────────────────────
  {
    id: 'docs', label: 'Docs', type: 'neutral',
    globs: ['*.md', 'docs/**'],
  },
  {
    // Catch-all. Files here are "unowned" — reported, and failed only under
    // --strict-ownership (see POLICY). Add explicit rules over time to shrink it.
    id: 'shared', label: 'Shared / Uncategorised', type: 'neutral',
    globs: ['**'],
  },
];

// ─── Generated artifacts (must accompany a change to their SOURCE) ──────────
export const GENERATED = {
  globs: ['src/generated/**', 'dist/**', '**/*.generated.*', 'BUILD_SHA', 'BUILD_TIMESTAMP'],
  // A generated artifact may only be committed alongside a change to a
  // NON-generated source file. e.g. src/generated/prismaModelFields.json is
  // regenerated from server/prisma/schema.prisma — committing it without a
  // server/prisma/** change means it is stale or hand-edited.
  requires: [
    { artifact: 'src/generated/prismaModelFields.json', source: ['server/prisma/**'] },
  ],
};

// ─── Policy ─────────────────────────────────────────────────────────────────
export const POLICY = {
  maxFeatureGroups: 1,              // commit may touch at most one feature group
  protectedBranches: ['master', 'main'],
  failOnUnowned: false,             // default: warn; --strict-ownership fails
  // Escape hatch for a deliberate cross-scope commit: a commit-message trailer
  // `Scope-Override: <reason>` (validated by safe-commit / CI) downgrades the
  // mixed-feature failure to a logged warning. Use sparingly.
  overrideTrailer: 'Scope-Override',
};

// ─── Minimal glob matcher (supports ** , * , ? , {a,b}) — no deps ───────────
function escChar(c) { return /[.+^${}()|[\]\\]/.test(c) ? '\\' + c : c; }

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') { i += 1; re += '(?:.*/)?'; } // **/  → any dirs
        else re += '.*';                                        // **   → anything
      } else {
        re += '[^/]*';                                          // *    → seg chars
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const j = glob.indexOf('}', i);
      if (j === -1) { re += '\\{'; } else {
        const alts = glob.slice(i + 1, j).split(',')
          .map((a) => a.split('').map(escChar).join(''));
        re += '(?:' + alts.join('|') + ')';
        i = j;
      }
    } else {
      re += escChar(c);
    }
  }
  return new RegExp('^' + re + '$');
}

const _compiled = GROUPS.map((g) => ({ ...g, res: g.globs.map(globToRegExp) }));
const _generatedRes = GENERATED.globs.map(globToRegExp);

/** Classify a single POSIX path into its owning group (first match wins). */
export function classify(file) {
  const f = file.replace(/\\/g, '/');
  for (const g of _compiled) {
    if (g.res.some((re) => re.test(f))) {
      return { file: f, group: g.id, label: g.label, type: g.type };
    }
  }
  // GROUPS always ends with a '**' catch-all, so this is unreachable in practice.
  return { file: f, group: 'shared', label: 'Shared / Uncategorised', type: 'neutral' };
}

export function isGenerated(file) {
  const f = file.replace(/\\/g, '/');
  return _generatedRes.some((re) => re.test(f));
}

/**
 * Analyse a set of changed files. Returns a structured verdict:
 *   { ok, files, byGroup, featureGroups, crosscutting, neutral,
 *     unowned, generated, violations[] }
 */
export function analyze(files, { strictOwnership = POLICY.failOnUnowned } = {}) {
  const classified = files.map(classify);
  const byGroup = {};
  for (const c of classified) (byGroup[c.group] ||= []).push(c.file);

  const featureGroups = [...new Set(classified.filter((c) => c.type === 'feature').map((c) => c.group))];
  const crosscutting = [...new Set(classified.filter((c) => c.type === 'crosscutting').map((c) => c.group))];
  const neutral = [...new Set(classified.filter((c) => c.type === 'neutral').map((c) => c.group))];
  const unowned = classified.filter((c) => c.group === 'shared').map((c) => c.file);
  const generated = files.map((f) => f.replace(/\\/g, '/')).filter(isGenerated);

  const violations = [];
  if (featureGroups.length > POLICY.maxFeatureGroups) {
    violations.push({
      code: 'MIXED_FEATURE_SCOPE',
      message: `commit spans ${featureGroups.length} feature groups (max ${POLICY.maxFeatureGroups}): ${featureGroups.join(', ')}`,
      groups: featureGroups,
    });
  }
  if (strictOwnership && unowned.length) {
    violations.push({
      code: 'UNOWNED_FILES',
      message: `${unowned.length} file(s) match no ownership rule (group "shared")`,
      files: unowned,
    });
  }
  // Generated artifacts must be accompanied by a change to their SOURCE.
  const nonGenerated = files.map((f) => f.replace(/\\/g, '/')).filter((f) => !isGenerated(f));
  for (const rule of GENERATED.requires) {
    const artRe = globToRegExp(rule.artifact);
    const present = generated.filter((gf) => artRe.test(gf));
    if (!present.length) continue;
    const srcRes = rule.source.map(globToRegExp);
    const hasSource = nonGenerated.some((f) => srcRes.some((re) => re.test(f)));
    if (!hasSource) {
      violations.push({
        code: 'UNEXPECTED_GENERATED',
        message: `generated ${present.join(', ')} committed without its source (${rule.source.join(', ')})`,
        files: present,
      });
    }
  }

  return {
    ok: violations.length === 0,
    files: classified,
    byGroup, featureGroups, crosscutting, neutral, unowned, generated,
    violations,
  };
}
