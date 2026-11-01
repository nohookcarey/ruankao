import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 子路径部署：https://nohookcarey.github.io/ruankao/
export default defineConfig({
  base: '/ruankao/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '软考·软件设计师刷题',
        short_name: '软考刷题',
        description: '软考中级·软件设计师 章节练习与模考',
        lang: 'zh-CN',
        start_url: '/ruankao/',
        scope: '/ruankao/',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/ruankao/index.html',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
