import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icons/*.png',
        'robots.txt',
      ],
      manifest: {
        name: 'Matchlytics - Quantitative Sports Analytics',
        short_name: 'Matchlytics',
        description:
          'High-performance quantitative sports analytics, zero-vig odds, and Kelly staking.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['sports', 'utilities'],
        lang: 'en',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,txt,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // Core app chunk
          'app-core': [
            './src/lib/supabase',
            './src/context/AuthContext',
            './src/utils/analytics',
          ],
          // UI component chunk
          'ui-components': [
            './src/components/ui/Button',
            './src/components/ui/Badge',
            './src/components/ui/Chip',
            './src/components/ui/utils',
          ],
          // Terminal workspace
          'terminal-workspace': [
            './src/components/TerminalScanner',
            './src/components/TableView',
            './src/components/CompactTableView',
            './src/components/MatchCard',
            './src/components/FilterBar',
            './src/components/Sidebar',
            './src/components/MobileNav',
          ],
          // Quant workspace
          'quant-workspace': [
            './src/components/QuantLab',
            './src/components/ScoreMatrixModal',
            './src/components/KellyCalculatorModal',
          ],
          // Portfolio workspace
          'portfolio-workspace': [
            './src/components/PortfolioTracker',
            './src/components/ParlaySlipDrawer',
          ],
          // Ledger workspace
          'ledger-workspace': [
            './src/components/ModelLedger',
            './src/components/PerformanceModal',
          ],
          // Admin workspace
          'admin-workspace': [
            './src/components/AdminDashboard',
            './src/components/AdminPanel',
          ],
          // User workspace
          'user-workspace': [
            './src/components/UserProfile',
            './src/components/DailyPicksModal',
          ],
          // Virtualization
          'virtual-list': [
            './src/components/VirtualList',
          ],
        },
        // Chunk file naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Optimize build settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
    cssCodeSplit: true,
  },
})
