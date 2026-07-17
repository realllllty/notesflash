import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NotesFlash',
        short_name: 'NotesFlash',
        lang: 'zh-CN',
        description: 'A compact, search-first cloud notebook.',
        theme_color: '#f7f7f4',
        background_color: '#f7f7f4',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        icons: [
          {
            src: '/icons/notesflash-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/notesflash-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/notesflash-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/setup(?:\/|$)/],
        runtimeCaching: [],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ],
  server: {
    port: 4173,
    strictPort: true
  },
  clearScreen: false
});
