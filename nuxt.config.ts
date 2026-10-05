// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],

  // Everything here needs a canvas, WASM and device sensors, so there is
  // nothing to render on a server. The static output is also what the
  // Capacitor shell bundles (docs/plan.md).
  ssr: false,

  compatibilityDate: '2026-09-08',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

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
      htmlAttrs: { lang: 'en' },
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
