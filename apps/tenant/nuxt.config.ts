// https://nuxt.com/docs/api/configuration/nuxt-config
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')
const anchorBrowser = path.resolve(dirname, '../../node_modules/@coral-xyz/anchor/dist/browser/index.js')

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2025-02-10',
  experimental: { clientNodeCompat: true },
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1',
    },
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss, '~/assets/global.css'],
  plugins: ['~/plugins/buffer.server', '~/plugins/tenant.server', '~/plugins/theme-inject.server', '~/plugins/buffer.client', '~/plugins/tenant.client', '@decentraguild/auth/plugin.client'],
  routeRules:
    process.env.NODE_ENV === 'development'
      ? { '/api/**': { proxy: 'http://localhost:3001' } }
      : {},
  nitro: {
    preset: 'static',
  },
  build: {
    transpile: ['@decentraguild/ui', '@decentraguild/auth', '@decentraguild/web3', '@decentraguild/contracts'],
  },
  hooks: {
    'vite:extendConfig'(config) {
      config.plugins = config.plugins || []
      config.plugins.push(
        nodePolyfills({
          include: ['buffer'],
          globals: { Buffer: true },
        })
      )
    },
  },
  vite: {
    server: {
      hmr: { port: 3002, clientPort: 3002 },
    },
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
      // Default tenant when running on localhost without subdomain (e.g. 0000000 or decentraguild). Set NUXT_PUBLIC_DEV_TENANT or use ?tenant=.
      devTenantSlug: process.env.NUXT_PUBLIC_DEV_TENANT ?? '',
      // When true, Deploy sets deactivatedate to now+2m so cron moves active->deactivating after 2 mins (testing).
      moduleLifecycleTestTiming: process.env.NUXT_PUBLIC_MODULE_LIFECYCLE_TEST_TIMING === 'true',
      // Poll tenant context every N seconds when on a module page and tab visible (0 = disable). Default 60.
      tenantContextPollSeconds: Number(process.env.NUXT_PUBLIC_TENANT_CONTEXT_POLL_SECONDS ?? 60),
      // Explorer base URLs for tx, account, token links (default: Solscan). No trailing slash.
      explorerTxUrl: process.env.NUXT_PUBLIC_EXPLORER_TX_URL ?? 'https://solscan.io/tx',
      explorerAccountUrl: process.env.NUXT_PUBLIC_EXPLORER_ACCOUNT_URL ?? 'https://solscan.io/account',
      explorerTokenUrl: process.env.NUXT_PUBLIC_EXPLORER_TOKEN_URL ?? 'https://solscan.io/token',
      platformDocsUrl: process.env.NUXT_PUBLIC_PLATFORM_DOCS_URL ?? 'https://dguild.org/docs',
      platformBaseUrl: process.env.NUXT_PUBLIC_PLATFORM_BASE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://dguild.org' : 'http://localhost:3000'),
      // Single host for ?tenant= entry (e.g. dapp.dguild.org). When on this host and URL has no ?tenant=, we use cached last tenant so refresh keeps the same org.
      tenantSingleHost: process.env.NUXT_PUBLIC_TENANT_SINGLE_HOST ?? 'dapp.dguild.org',
    },
  },
})
