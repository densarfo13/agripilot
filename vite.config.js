import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// ── Sentry release resolution ──────────────────────────────────
// Compute a per-build release identifier at vite-config load
// time so:
//   1. @sentry/vite-plugin uploads source maps under this name.
//   2. The client runtime tags events with the same name (via
//      `import.meta.env.VITE_BUILD_ID`) so symbolicated events
//      line up with the uploaded maps in the Sentry UI.
//
// Priority mirrors `server/src/lib/sentry.js#_readRelease` so
// the frontend, the backend, and the uploaded source maps all
// agree on one release per deploy. Railway sets
// RAILWAY_GIT_COMMIT_SHA automatically; the other names are
// supported by Render / Heroku / manual CI.
const _sentryRelease =
     process.env.SENTRY_RELEASE
  || process.env.VITE_BUILD_ID
  || process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.RENDER_GIT_COMMIT
  || process.env.SOURCE_COMMIT
  || process.env.FARROWAY_COMMIT_SHA
  || undefined;

// Propagate the release into the client bundle as VITE_BUILD_ID
// so the existing runtime `_readRelease()` returns the same
// value the source maps are uploaded under. We only set it when
// the deploy environment hasn't already (a directly-set
// VITE_BUILD_ID always wins).
if (_sentryRelease && !process.env.VITE_BUILD_ID) {
  process.env.VITE_BUILD_ID = _sentryRelease;
}

// Upload + sanitize control. We only enable the plugin when
// SENTRY_AUTH_TOKEN is present, which is the canonical
// "is this a real deploy with Sentry credentials" signal. Local
// builds and CI runs without the token are pure no-ops — the
// plugin doesn't upload, doesn't delete maps, and doesn't tag
// a release.
const _sentryUploadEnabled = !!process.env.SENTRY_AUTH_TOKEN;

// Orphan sourcemap sweeper — defence-in-depth so the final
// artifact NEVER ships .map files when there are no Sentry
// credentials to upload them. With the Sentry plugin enabled,
// its `filesToDeleteAfterUpload` is the authoritative delete
// (it only fires after a successful upload, so failed uploads
// stay retriable). Without the token, no upload runs and the
// .map files would otherwise linger in dist/ where a static
// host could serve them by URL guess. This rollup plugin closes
// that window. `sourcemap: 'hidden'` already prevents browsers
// from auto-discovering maps; this is the second layer.
const _orphanSourcemapSweeperPlugin = {
  name:    'farroway:cleanup-orphan-sourcemaps',
  apply:   'build',
  // closeBundle runs AFTER writeBundle, where the Sentry plugin
  // does its upload + delete. So when the upload mode is on we
  // bail out and let Sentry own the lifecycle.
  async closeBundle() {
    if (_sentryUploadEnabled) return;
    const fs   = await import('node:fs/promises');
    const path = await import('node:path');
    const distDir = path.resolve(process.cwd(), 'dist');
    async function* _walk(dir) {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())              yield* _walk(full);
        else if (e.isFile() && e.name.endsWith('.map')) yield full;
      }
    }
    let removed = 0;
    try {
      for await (const f of _walk(distDir)) {
        try { await fs.unlink(f); removed += 1; }
        catch { /* tolerate per-file */ }
      }
    } catch { /* tolerate top-level walk failures */ }
    if (removed > 0) {
      // eslint-disable-next-line no-console
      console.log(
        '[farroway:cleanup-orphan-sourcemaps] removed '
        + removed + ' orphan .map file(s) '
        + '(no SENTRY_AUTH_TOKEN — maps would not be useful to anyone).',
      );
    }
  },
};

export default defineConfig({
  plugins: [
    react(),
    // Sentry source-map upload + release tagging. Must come AFTER
    // react() so it sees the final emitted assets. Behaviour:
    //   • disable=true when SENTRY_AUTH_TOKEN is unset — no work,
    //     no upload, no map deletion. Build stays green.
    //   • when enabled, uploads .map files keyed by the debug-id
    //     injected into each .js+.map pair, then deletes the
    //     .map files from dist/ so they're never served publicly.
    //     `sourcemap: 'hidden'` (set below) already prevents
    //     browsers from auto-loading them, but deletion is the
    //     defence-in-depth pass.
    //   • telemetry off — no extra outbound traffic from CI.
    //   • errorHandler swallows so a misconfigured plugin can
    //     never fail a deploy; the runtime DSN-disabled path
    //     stays in effect.
    sentryVitePlugin({
      org:        process.env.SENTRY_ORG,
      project:    process.env.SENTRY_PROJECT,
      authToken:  process.env.SENTRY_AUTH_TOKEN,
      release:    _sentryRelease ? { name: _sentryRelease } : undefined,
      sourcemaps: {
        // Anchor to dist/ so we never accidentally delete .map
        // files outside the build output (e.g. node_modules or
        // committed maps elsewhere in the tree).
        assets: ['./dist/**/*'],
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
      disable:    !_sentryUploadEnabled,
      telemetry:  false,
      silent:     !_sentryUploadEnabled,
      errorHandler: (err) => {
        // Never fail the build on Sentry-side errors. Log loudly
        // so deploy logs surface a misconfigured upload, but let
        // the build artifact ship without source maps rather than
        // block release.
        // eslint-disable-next-line no-console
        console.warn('[sentry-vite-plugin] non-fatal:', err && err.message);
      },
    }),
    // Must run AFTER sentryVitePlugin so its closeBundle observes
    // any maps Sentry chose to leave in place (only triggers when
    // the upload mode is off — see _sentryUploadEnabled above).
    _orphanSourcemapSweeperPlugin,
  ],
  build: {
    // Explicit so deployment scripts that look for the artifact
    // never hunt the wrong directory. Matches the Vite default;
    // pinned here per the cache-bust playbook.
    outDir: 'dist',
    // Soft-launch hardening: the i18n-core chunk is 1.4 MB
    // (translations.js is a 13.6k-line flat map with all 6
    // locales inline — splitting per-locale requires a real
    // refactor, tracked separately). Lifted from 600 to 1500
    // so the chunk warnings stop polluting CI logs without
    // hiding genuinely-too-big chunks (vendor-recharts 290 KB,
    // vendor-leaflet 152 KB are well under the new ceiling).
    chunkSizeWarningLimit: 1500,
    // Bump the heap ceiling for the minify step. The previous
    // single-bundle output was a 1.9 MB chunk that blew past
    // the default Node heap on the deploy daemon (build daemon
    // OOM'd with no specific error — just "Build failed in
    // ~2s after 761 modules transformed"). The manualChunks
    // split below also reduces per-chunk minification pressure.
    target: 'es2019',
    // Hidden source maps — generated alongside the bundle but
    // NOT referenced via a //# sourceMappingURL comment, so end
    // users don't see them in DevTools but Sentry can fetch and
    // symbolicate stack traces server-side. The .map files live
    // next to their .js counterparts in dist/; either upload
    // them via @sentry/vite-plugin during the deploy build, or
    // serve them from the same origin so Sentry's debug-id
    // resolver finds them automatically.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Hand-pick vendor chunks for the heavy dependencies so
        // the main app bundle stays well under any reasonable
        // heap ceiling. Anything not matched here falls back to
        // the per-route lazy chunks the existing React.lazy()
        // splits already produce.
        manualChunks(id) {
          // Normalise Windows backslashes so the path patterns
          // below match consistently across platforms. Without
          // this, `id.includes('/react/')` is FALSE on Windows
          // (the ID arrives as `node_modules\react\index.js`)
          // and every React file falls through to the `vendor`
          // catchall. That creates a circular chunk graph where
          // `vendor` both contains React AND is imported by
          // `vendor-react-dom`, and at runtime the browser
          // resolves `PureComponent` off `undefined` — exactly
          // the prod regression observed at farroway.app.
          const p = id.replace(/\\/g, '/');
          // Application-code splits — peel heavy first-party modules
          // off the main app shell so Home renders before the giant
          // dictionaries arrive.
          if (p.includes('node_modules') === false) {
            // i18n translation modules. translations.js is now a
            // thin shim that eagerly imports only the English
            // column (T-en.js); other locales lazy-load via
            // columnLoader.js. The shim + en column + loader all
            // sit in i18n-core so the default locale never pays an
            // async cost. Lazy columns split into i18n-col-{locale}.
            if (p.includes('/src/i18n/translations.js'))     return 'i18n-core';
            if (p.includes('/src/i18n/columnLoader'))        return 'i18n-core';
            if (p.includes('/src/i18n/columns/T-en.js'))     return 'i18n-core';
            // Lazy per-locale column chunks. Each is ~50-100 KB
            // minified+gzipped and is fetched on demand by
            // columnLoader.loadColumn(locale) when the user lands
            // on or switches to that language.
            if (p.includes('/src/i18n/columns/T-fr.js'))     return 'i18n-col-fr';
            if (p.includes('/src/i18n/columns/T-sw.js'))     return 'i18n-col-sw';
            if (p.includes('/src/i18n/columns/T-ha.js'))     return 'i18n-col-ha';
            if (p.includes('/src/i18n/columns/T-tw.js'))     return 'i18n-col-tw';
            if (p.includes('/src/i18n/columns/T-hi.js'))     return 'i18n-col-hi';
            if (p.includes('/src/i18n/jsonLocaleLoader'))    return 'i18n-overlays';
            if (p.includes('/src/i18n/') && p.endsWith('Translations.js'))
                                                              return 'i18n-overlays';
            // Per-language single-file packs (hi.js / tw.js) —
            // separate from the column files above; these are flat
            // overlays merged at boot via mergePacks() in index.js.
            if (p.includes('/src/i18n/hi.js'))               return 'i18n-pack-hi';
            if (p.includes('/src/i18n/tw.js'))               return 'i18n-pack-tw';
            // Brand mark data URL (~76 KB inline base64).
            // Eagerly imported by the splash so it can't move
            // out of the main bundle without changing the splash;
            // leave it in main for now.
            return undefined;
          }
          // Vendor chunks — pin heavy deps so the main app bundle
          // stays well under any reasonable heap ceiling.
          //
          // Order matters: more-specific matches first. The shared
          // 'scheduler' / 'react-is' / 'react/jsx-runtime' deps that
          // both react and react-dom pull in are co-located with
          // react-dom to break the circular `vendor → vendor-react-dom
          // → vendor` warning that was visible on prior builds.
          if (p.includes('/recharts/'))                      return 'vendor-recharts';
          if (p.includes('/leaflet/') || p.includes('/react-leaflet/'))
                                                              return 'vendor-leaflet';
          if (p.includes('/react-router'))                   return 'vendor-router';
          // React-shared internals → bundle WITH react-dom so the
          // top-level chunk graph stays acyclic.
          if (p.includes('/react-dom/')
              || p.includes('/scheduler/')
              || p.includes('/react-is/')
              || p.includes('/react/jsx-runtime')
              || p.includes('/react/jsx-dev-runtime'))       return 'vendor-react-dom';
          // React itself — match `node_modules/react/...` and
          // the bare `node_modules/react` entry. The leading
          // slash anchors against `node_modules/` so we don't
          // accidentally catch e.g. `node_modules/preact/`.
          if (p.includes('/node_modules/react/')
              || p.endsWith('/node_modules/react'))           return 'vendor-react';
          if (p.includes('/axios/'))                         return 'vendor-axios';
          if (p.includes('/lucide-react/'))                  return 'vendor-icons';
          if (p.includes('/date-fns/') || p.includes('/dayjs/'))
                                                              return 'vendor-dates';
          // Everything else under node_modules — small libs
          // and shared utilities.
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['server/src/**/*.test.js', 'src/**/*.test.js'],
    exclude: ['server/tests/**', 'node_modules/**'],
    // Fallback env vars so tests that import server modules don't
    // crash at module-load time when DATABASE_URL / token secrets
    // aren't set. Tests that actually exercise the DB still gate
    // themselves with describe.skipIf inside.
    setupFiles: ['./vitest.setup.js'],
  },
});
