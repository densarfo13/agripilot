import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    // Bump the heap ceiling for the minify step. The previous
    // single-bundle output was a 1.9 MB chunk that blew past
    // the default Node heap on the deploy daemon (build daemon
    // OOM'd with no specific error — just "Build failed in
    // ~2s after 761 modules transformed"). The manualChunks
    // split below also reduces per-chunk minification pressure.
    target: 'es2019',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Hand-pick vendor chunks for the heavy dependencies so
        // the main app bundle stays well under any reasonable
        // heap ceiling. Anything not matched here falls back to
        // the per-route lazy chunks the existing React.lazy()
        // splits already produce.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts'))                       return 'vendor-recharts';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
          if (id.includes('react-router'))                   return 'vendor-router';
          if (id.includes('react-dom'))                      return 'vendor-react-dom';
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
  },
});
