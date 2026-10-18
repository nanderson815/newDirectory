import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal multi-file build in dist/.
// `npm run build:single` inlines everything into dist-single/index.html (used for the shareable artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
}));
