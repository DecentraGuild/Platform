import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')
const anchorBrowser = path.resolve(dirname, '../../node_modules/@coral-xyz/anchor/dist/browser/index.js')

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2025-02-10',
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss],
  plugins: ['@decentraguild/auth/plugin.client'],
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
    },
  },
})
