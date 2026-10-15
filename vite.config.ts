import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// `base` relativa: el sitio funciona igual en GitHub Pages (subcarpeta) o Cloudflare Pages (raíz).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icono-192.png', 'icono-512.png'],
      manifest: {
        name: 'Estudio Med',
        short_name: 'Estudio Med',
        description: 'Estudiá con tus fuentes: citas clicables, tarjetas, simuladores y atlas 3D.',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El motor WASM de embeddings (~27 MB) NO se precachea: se guarda al primer uso.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          { urlPattern: /\.wasm$/, handler: 'CacheFirst', options: { cacheName: 'wasm', expiration: { maxEntries: 6 } } },
          { urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract/, handler: 'CacheFirst', options: { cacheName: 'ocr', expiration: { maxEntries: 20 } } },
          { urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\//, handler: 'CacheFirst', options: { cacheName: 'ocr-idiomas', expiration: { maxEntries: 5 } } },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
  },
})
