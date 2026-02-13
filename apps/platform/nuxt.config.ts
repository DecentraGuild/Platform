import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uiVarsCss = path.resolve(dirname, '../../packages/ui/src/theme/vars.css')

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
    transpile: ['@decentraguild/ui', '@decentraguild/auth'],
  },
  devServer: {
    port: 3000,
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? 'https://api.dguild.org',
      heliusRpc: process.env.NUXT_PUBLIC_HELIUS_RPC ?? '',
    },
  },
})
