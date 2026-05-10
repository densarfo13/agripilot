import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Explicit so deployment scripts that look for the artifact
    // never hunt the wrong directory. Matches the Vite default;
    // pinned here per the cache-bust playbook.
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
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
          // Application-code splits — peel heavy first-party modules
          // off the main app shell so Home renders before the giant
          // dictionaries arrive.
          if (id.includes('node_modules') === false) {
            // i18n translation modules. translations.js alone is
            // ~1.8 MB of source (130+ keys × 6 locales) and pulls
            // 30+ overlay files. Loading these in parallel with
            // the app shell is the biggest single perf win.
            if (id.includes('/src/i18n/translations.js'))     return 'i18n-core';
            if (id.includes('/src/i18n/jsonLocaleLoader'))    return 'i18n-overlays';
            if (id.includes('/src/i18n/') && id.endsWith('Translations.js'))
                                                              return 'i18n-overlays';
            // Per-language single-file packs (hi.js / tw.js).
            if (id.includes('/src/i18n/hi.js'))               return 'i18n-pack-hi';
            if (id.includes('/src/i18n/tw.js'))               return 'i18n-pack-tw';
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
          if (id.includes('recharts'))                       return 'vendor-recharts';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
          if (id.includes('react-router'))                   return 'vendor-router';
          // React-shared internals → bundle WITH react-dom so the
          // top-level chunk graph stays acyclic.
          if (id.includes('react-dom')
              || id.includes('/scheduler/')
              || id.includes('/react-is/')
              || id.includes('react/jsx-runtime')
              || id.includes('react/jsx-dev-runtime'))       return 'vendor-react-dom';
          if (id.includes('/react/') || id.endsWith('/react'))
                                                              return 'vendor-react';
          if (id.includes('axios'))                          return 'vendor-axios';
          if (id.includes('lucide-react'))                   return 'vendor-icons';
          if (id.includes('date-fns') || id.includes('dayjs'))
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
