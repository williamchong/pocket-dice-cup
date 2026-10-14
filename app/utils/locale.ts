/** The languages the app is translated into; the first is the fallback. */
export const LOCALES = ['en', 'zh-CN', 'zh-HK'] as const
export type AppLocale = typeof LOCALES[number]

/**
 * The app's language for the reader's preferred languages, best first, as
 * `navigator.languages` lists them. Chinese in traditional script, or from
 * Hong Kong, Macau or Taiwan, reads the Hong Kong text, and any other Chinese
 * the simplified; a language the app lacks is passed over for the next one.
 * The splash screen picks its line the same way (spa-loading-template.html).
 */
export function pickLocale(languages: readonly string[]): AppLocale {
  for (const language of languages) {
    const [base, ...rest] = language.toLowerCase().split(/[-_]/)
    if (base === 'en') return 'en'
    if (base === 'zh') return rest.some(part => ['hant', 'hk', 'mo', 'tw'].includes(part)) ? 'zh-HK' : 'zh-CN'
  }
  return LOCALES[0]
}
