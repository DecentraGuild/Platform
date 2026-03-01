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
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss],
  plugins: ['~/plugins/buffer.server', '~/plugins/buffer.client', '@decentraguild/auth/plugin.client'],
  routeRules:
    process.env.NODE_ENV === 'development'
      ? {
          // Proxy /api to the API server so requests work from same origin in dev.
          '/api/**': { proxy: 'http://localhost:3001' },
        }
      : {},
  nitro: {
    preset: 'static',
    prerender: {
      routes: [
        '/modules',
        '/docs',
        '/docs/general/getting-started',
        '/docs/general/creating-a-dguild',
        '/docs/general/directory',
        '/docs/general/billing-overview',
        '/docs/modules/admin',
        '/docs/modules/admin/domains-and-slugs',
        '/docs/modules/marketplace',
        '/docs/modules/marketplace/how-it-works',
        '/docs/modules/marketplace/collections-currencies',
        '/docs/modules/marketplace/fees-tiers',
        '/docs/modules/discord',
        '/docs/modules/discord/verify-flow',
        '/docs/modules/discord/setup',
      ],
      failOnError: false,
    },
  },
  build: {
    transpile: ['@decentraguild/ui', '@decentraguild/auth', '@decentraguild/web3', '@decentraguild/contracts', '@decentraguild/config'],
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
    resolve: {
      alias: { '@coral-xyz/anchor': anchorBrowser },
    },
    optimizeDeps: {
      include: ['buffer'],
    },
    ssr: {
      noExternal: ['buffer'],
    },
  },
  devServer: {
    port: 3000,
  },
  runtimeConfig: {
    public: {
      // In dev, default to local API so CORS and auth work without setting env. No trailing slash.
      apiUrl: (process.env.NUXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://api.dguild.org' : 'http://localhost:3001')).replace(/\/$/, ''),
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
      // Base domain for tenant subdomains (e.g. dguild.org -> https://skull.dguild.org). Override via NUXT_PUBLIC_TENANT_BASE_DOMAIN for staging/white-label.
      tenantBaseDomain: process.env.NUXT_PUBLIC_TENANT_BASE_DOMAIN ?? 'dguild.org',
      platformDocsUrl: process.env.NUXT_PUBLIC_PLATFORM_DOCS_URL ?? 'https://dguild.org/docs',
    },
  },
})
