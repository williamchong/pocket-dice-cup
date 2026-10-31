import type { Gtag } from './analytics'

/**
 * Registers Google's script. In a file of its own, imported only when needed,
 * because Nuxt Scripts would otherwise add to the first download, 11 KB gzipped
 * in this chunk, which the phone apps would carry and never run.
 */
export function loadGtag(id: string): Gtag {
  const { proxy } = useScriptGoogleAnalytics({
    id,
    // Measurement only: no ad storage, and nothing for Google's advertising.
    defaultConsent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
    onBeforeGtagStart: gtag => gtag('set', { allow_google_signals: false }),
  })
  return (command, event, params) => proxy.gtag(command, event, params)
}
