import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// GitHub Pages project sites serve from /<repo-name>/, so every asset and internal
// link needs that prefix baked in at build time. Dev server stays at the root ("/")
// since Vite serves it directly there.
// `command` alone can't tell `vite preview` apart from `vite dev` — both report
// 'serve'. `mode` does: it's 'production' for both build and preview, 'development'
// only for the dev server. Preview has to serve the /schedulizer/ base too, since
// that's what the built files themselves reference.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/schedulizer/' : '/',
  // Three independent static pages, not client-side routes — the default SPA history
  // fallback would otherwise serve index.html's content for every request (schedule.html,
  // distribute.html, even asset files), which is exactly what was happening.
  appType: 'mpa',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        schedule: resolve(__dirname, 'schedule.html'),
        distribute: resolve(__dirname, 'distribute.html')
      }
    }
  }
}));
