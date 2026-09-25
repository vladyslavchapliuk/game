import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: index.html carries all JS/CSS/fonts, so the game also runs
// by double-clicking dist/index.html on Mac or Windows (no server needed).
// Art lives in dist/assets and is loaded with relative URLs.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false, emptyOutDir: false },
  test: { globals: true, environment: 'node' },
});
