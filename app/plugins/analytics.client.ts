import { Capacitor } from '@capacitor/core'

/**
 * Picks where events go. Registered from here rather than in `scripts.registry`
 * in nuxt.config.ts, as that would also put Google's script in the phone apps,
 * which report through Firebase's SDK: cookies are not reliable in their web
 * views, and GA4 can then count each event as a new user.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { gaId } = useRuntimeConfig().public

  function backend(): AnalyticsBackend | null {
    // These runs start the dice on a fixed grid, which are not real rolls.
    if (isDebugRun()) return null
    if (Capacitor.isNativePlatform()) return new NativeAnalyticsBackend()
    if (!gaId) return null
    // Back in the plugin's context, which is long gone once the switch is turned on.
    return new GtagAnalyticsBackend(gaId, async () => {
      const { loadGtag } = await import('~/utils/loadGtag')
      return nuxtApp.runWithContext(() => loadGtag(gaId))
    })
  }

  const analytics = new Analytics(backend(), loadAnalyticsEnabled())
  analytics.start()
  return { provide: { analytics } }
})
