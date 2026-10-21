// https://nuxt.com/docs/api/configuration/nuxt-config

// The GitHub Pages build serves the site from the project path (CLAUDE.md).
const baseURL = process.env.NUXT_APP_BASE_URL ?? '/'
// In the page itself, for search engines and link previews that run no script;
// the app sets it in the reader's language once it starts (app.vue).
const DESCRIPTION = 'A dice cup in your phone: shake it, hear the dice rattle, lay it down and read the roll.'

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

  vite: {
    // vue-i18n's build flags: the Composition API and `$t` only, without its
    // <i18n-t> components and v-t directive, and no devtools hooks in production.
    define: {
      __VUE_I18N_FULL_INSTALL__: false,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },
  },

  nitro: {
    prerender: {
      // The about page as a file of its own, which GitHub Pages serves for
      // its address; otherwise it would get the 404 page, with a 404 status
      // that keeps it out of search results.
      routes: ['/about'],
    },
  },

  runtimeConfig: {
    public: {
      // The debug overlay without `?debug` in the URL, for the iOS app, which
      // has no address bar: `NUXT_PUBLIC_DEBUG=1 npm run ios`.
      debug: false,
      // Pro unlocked without buying it, for trying Pro skins in the native
      // shells before the store plugin exists: `NUXT_PUBLIC_PRO=1 npm run ios`.
      pro: false,
    },
  },

  app: {
    // No id, so Nuxt leaves the loading screen (app/spa-loading-template.html)
    // in place as the app mounts; the page fades it out once the dice are ready.
    spaLoaderAttrs: { id: '' },
    head: {
      // In the reader's language once the app starts (app.vue).
      title: 'Pocket Dice Cup',
      // `dark` selects Nuxt UI's dark theme, as there is no color-mode module.
      htmlAttrs: { lang: 'en', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        // No pinch or double-tap zoom: the page is one fixed canvas that is
        // handled while being shaken.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#12241b' },
        { name: 'description', content: DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Pocket Dice Cup' },
        { property: 'og:description', content: DESCRIPTION },
      ],
      // From the base URL rather than relative, so they also resolve from
      // the about page's address, a folder deeper.
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
        { rel: 'apple-touch-icon', href: `${baseURL}apple-touch-icon.png` },
      ],
    },
  },
})
