import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2025-02-10',
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss],
  build: {
    transpile: ['@decentraguild/ui'],
  },
  devServer: {
    port: 3000,
  },
  // Proxy API requests so browser talks to same-origin `/api`
  // and Nuxt/Nitro forwards to the backend at :3001.
  routeRules: {
    '/api/v1/**': {
      proxy: {
        to: 'http://localhost:3001/api/v1/**',
      },
    },
  },
  runtimeConfig: {
    public: {
      // Empty in dev so browser uses same-origin /api (proxied to API). Set NUXT_PUBLIC_API_URL in production.
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '',
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
    },
  },
})
