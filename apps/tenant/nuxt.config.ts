// https://nuxt.com/docs/api/configuration/nuxt-config
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')
const anchorBrowser = path.resolve(dirname, '../../node_modules/@coral-xyz/anchor/dist/browser/index.js')

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2025-02-10',
  experimental: { clientNodeCompat: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss, '~/assets/global.css'],
  plugins: ['~/plugins/buffer.server', '~/plugins/tenant.server', '~/plugins/buffer.client', '~/plugins/tenant.client', '@decentraguild/auth/plugin.client'],
  nitro: {
    preset: 'static',
  },
  build: {
    transpile: ['@decentraguild/ui', '@decentraguild/auth', '@decentraguild/web3', '@decentraguild/contracts'],
  },
  vite: {
    resolve: {
      alias: { '@coral-xyz/anchor': anchorBrowser },
    },
    optimizeDeps: {
      include: ['buffer'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Split heavy Solana/Anchor stack so no single chunk exceeds 500 kB and caching improves.
            if (id.includes('@coral-xyz/anchor')) return 'anchor'
            if (id.includes('@solana/web3.js') || id.includes('@solana\\web3.js')) return 'solana-web3'
            if (id.includes('@solana/spl-token') || id.includes('@solana\\spl-token')) return 'solana-spl-token'
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    ssr: {
      noExternal: ['buffer'],
    },
  },
  devServer: {
    port: 3002,
  },
  runtimeConfig: {
    public: {
      // In dev, default to local API so CORS and auth work without setting env. No trailing slash.
      apiUrl: (process.env.NUXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://api.dguild.org' : 'http://localhost:3001')).replace(/\/$/, ''),
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
      // Default tenant slug when running on localhost without subdomain. Override via NUXT_PUBLIC_DEV_TENANT.
      devTenantSlug: process.env.NUXT_PUBLIC_DEV_TENANT ?? 'skull',
    },
  },
})
