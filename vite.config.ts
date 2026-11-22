import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Emits dist/sw.js with a precache list of every built file, so the app
 * works offline after the first visit.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'civics128-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = [
        'favicon.svg',
        'manifest.webmanifest',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
      ];
      const precache = ['./', ...new Set([...files, ...publicFiles])].map((f) =>
        f === './' ? f : `./${f}`,
      );
      const template = readFileSync(new URL('./pwa/sw.template.js', import.meta.url), 'utf8');
      const source = template
        .replace('__BUILD_ID__', Date.now().toString(36))
        .replace('__PRECACHE_LIST__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages (/<repo>/) or any host.
  base: './',
  plugins: [serviceWorkerPlugin()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
