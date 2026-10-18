import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal multi-file build in dist/ with three.js bundled.
// `npm run build:single` inlines the game into dist-single/index.html and loads three.js from jsDelivr,
// which keeps the shareable page small.
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      chunkSizeWarningLimit: 1200,
      modulePreload: { polyfill: false },
      rollupOptions: single ? { external: ['three'], output: { paths: { three: THREE_CDN } } } : {},
    },
  };
});
