import { createI18n } from 'vue-i18n'
import en from '~/locales/en.json'
import zhCN from '~/locales/zh-CN.json'
import zhHK from '~/locales/zh-HK.json'

// Every language is in the bundle rather than fetched: the iOS app runs from
// local files and the PWA has to start offline, and each is small. The
// language follows the system's, as the iOS app's does through
// CFBundleLocalizations, so there is no switcher.
export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createI18n({
    legacy: false,
    locale: pickLocale(navigator.languages ?? [navigator.language]),
    fallbackLocale: LOCALES[0],
    messages: { 'en': en, 'zh-CN': zhCN, 'zh-HK': zhHK },
  })
  nuxtApp.vueApp.use(i18n)
})
