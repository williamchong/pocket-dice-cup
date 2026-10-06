// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  // Everything here needs a canvas, WASM and device sensors, so there is
  // nothing to render on a server. The static output is also what the
  // Capacitor shell bundles (docs/plan.md).
  ssr: false,

  compatibilityDate: '2026-09-08',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  ui: {
    // System font and one dark theme (app.head below): no web fonts to fetch
    // and no light theme to switch to.
    fonts: false,
    colorMode: false,
    // Styles only for the components in use, not for all of Nuxt UI's.
    experimental: { componentDetection: true },
  },

  icon: {
    // The PWA works offline and the iOS app bundles the static build, so
    // icons are built in and never fetched from the Iconify API.
    provider: 'none',
    clientBundle: { scan: true },
  },

  runtimeConfig: {
    public: {
      // The debug overlay without `?debug` in the URL, for the iOS app, which
      // has no address bar: `NUXT_PUBLIC_DEBUG=1 npm run ios`.
      debug: false,
    },
  },

  app: {
    head: {
      title: 'Pocket Dice Cup',
      // `dark` selects Nuxt UI's dark theme, as there is no color-mode module.
      htmlAttrs: { lang: 'en', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        // No pinch or double-tap zoom: the page is one fixed canvas that is
        // handled while being shaken.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#12241b' },
      ],
    },
  },
})
