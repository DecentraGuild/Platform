// https://nuxt.com/docs/api/configuration/nuxt-config
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')

// In dev without NUXT_PUBLIC_API_URL: use same-origin + proxy (no CORS, no localhost in prod). In prod: use live API URL.
const apiUrl =
  process.env.NUXT_PUBLIC_API_URL ??
  (import.meta.dev ? '' : 'https://api.dguild.org')
const apiProxyTarget = process.env.NUXT_PUBLIC_API_PROXY_TARGET ?? 'https://api.dguild.org'

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2025-02-10',
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [uiVarsCss],
  build: {
    transpile: ['@decentraguild/ui'],
  },
  devServer: {
    port: 3002,
  },
  routeRules: {
    '/api/v1/**': {
      proxy: {
        to: `${apiProxyTarget}/api/v1/**`,
      },
    },
  },
  runtimeConfig: {
    public: {
      apiUrl,
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
    },
  },
})
