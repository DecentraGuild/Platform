// https://nuxt.com/docs/api/configuration/nuxt-config
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
    port: 3002,
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? 'http://localhost:3001',
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
    },
  },
})
