import type { BuildInfo } from './shared/types'
import { createResolver, useNuxt } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { isCI, isDevelopment, isWindows } from 'std-env'
import { isPreview } from './config/env'
import { currentLocales } from './config/i18n'
import { pwa } from './config/pwa'

const { resolve } = createResolver(import.meta.url)
const mockProxy = resolveModulePath('mocked-exports/proxy', { from: import.meta.url })

export default defineNuxtConfig({
  compatibilityDate: '2024-09-11',
  future: {
    compatibilityVersion: 4,
  },
  typescript: {
    tsConfig: {
      exclude: ['../service-worker'],
      compilerOptions: {
        noUncheckedIndexedAccess: false,
      },
      vueCompilerOptions: {
        target: 3.5,
      },
    },
  },
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@vue-macros/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@unlazy/nuxt',
    '@nuxt/test-utils/module',
    ...(isDevelopment || isWindows) ? [] : ['nuxt-security'],
    '~~/modules/emoji-mart-translation',
    '~~/modules/purge-comments',
    '~~/modules/build-env',
    '~~/modules/tauri/index',
    '~~/modules/pwa/index',
    'stale-dep/nuxt',
  ],
  vue: { propsDestructure: true },
  macros: { setupSFC: true },
  devtools: { enabled: true },
  features: { inlineStyles: false },
  experimental: { payloadExtraction: false, renderJsonPayloads: true },
  css: [
    '@unocss/reset/tailwind.css',
    'floating-vue/dist/style.css',
    '~/styles/default-theme.css',
    '~/styles/vars.css',
    '~/styles/global.css',
    ...process.env.TAURI_PLATFORM === 'macos' ? [] : ['~/styles/scrollbars.css'],
    '~/styles/tiptap.css',
    '~/styles/dropdown.css',
  ],
  alias: {
    'querystring': 'rollup-plugin-node-polyfills/polyfills/qs',
    'change-case': 'scule',
    'semver': resolve('./mocks/semver'),
  },
  imports: {
    dirs: [
      './composables/masto',
      './composables/push-notifications',
      './composables/settings',
      './composables/tiptap/index.ts',
    ],
    imports: [{ name: 'useI18n', from: '~/utils/i18n', priority: 100 }],
    injectAtEnd: true,
  },
  vite: {
    define: {
      'process.env.VSCODE_TEXTMATE_DEBUG': 'false',
      'process.mock': ((!isCI || isPreview) && process.env.MOCK_USER) || 'false',
      'process.test': 'false',
    },
    build: { target: 'esnext' },
    optimizeDeps: { include: [ /*...all your previous deps...*/ ] },
  },
  postcss: { plugins: { 'postcss-nested': {} } },
  appConfig: {
    storage: {
      // Use Vercel KV in CI / Vercel deploys, fallback to FS locally
      driver: process.env.NUXT_STORAGE_DRIVER ?? (isCI ? 'vercel-kv' : 'fs'),
    },
  },
  runtimeConfig: {
    adminKey: '',
    vercel: {
      url: '',
      token: '',
      env: '',
      base: '',
    },
    public: {
      privacyPolicyUrl: '',
      translateApi: '',
      defaultServer: 'm.webtoo.ls',
      singleInstance: false,
    },
    storage: { fsBase: 'node_modules/.cache/app' },
  },
  routeRules: {
    '/': { prerender: true },
    '/settings/**': { prerender: false },
    '/api/list-servers': { swr: true },
    '/manifest.webmanifest': {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    },
  },
  nitro: {
    alias: { 'isomorphic-ws': mockProxy },
    esbuild: { options: { target: 'esnext' } },
    prerender: { crawlLinks: true },
    publicAssets: [
      { dir: resolve('./public/avatars'), maxAge: 24 * 60 * 60 * 30, baseURL: '/avatars' },
      { dir: resolve('./public/emojis'), maxAge: 24 * 60 * 60 * 15, baseURL: '/emojis' },
      { dir: resolve('./public/fonts'), maxAge: 24 * 60 * 60 * 365, baseURL: '/fonts' },
    ],
  },
  sourcemap: isDevelopment,
  hooks: {
    'prepare:types': ({ references }) => {
      references.push({ types: '@types/wicg-file-system-access' })
    },
    'nitro:config': (config) => {
      const nuxt = useNuxt()
      config.virtual = config.virtual || {}
      config.virtual['#storage-config'] = `export const driver = ${JSON.stringify(nuxt.options.appConfig.storage.driver)}`
    },
  },
})
