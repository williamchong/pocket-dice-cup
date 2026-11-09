import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { parseCupLink, type CupLinkSheet } from '~/utils/cupLink'

/**
 * Opens the sheet a `pocketdicecup://` link asks for, in the phone apps, such
 * as a tap on the pool or the time in the Dynamic Island. A link that brings
 * the app back to the front arrives as `appUrlOpen`; one that starts it came
 * before the listener could be added, so it is read from `getLaunchUrl`. Both
 * may report the same link at launch, which opens the same sheet twice and
 * so changes nothing. The web has no such links.
 */
export function useCupLinks(open: (sheet: CupLinkSheet) => void) {
  let listener: PluginListenerHandle | null = null
  let unmounted = false

  function follow(url: string | undefined) {
    const sheet = url ? parseCupLink(url) : null
    if (sheet && !unmounted) open(sheet)
  }

  onMounted(async () => {
    if (!Capacitor.isNativePlatform()) return
    // Imported here, so the web never downloads the App plugin.
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('appUrlOpen', event => follow(event.url))
    if (unmounted) {
      void handle.remove()
      return
    }
    listener = handle
    follow((await App.getLaunchUrl())?.url)
  })

  onBeforeUnmount(() => {
    unmounted = true
    void listener?.remove()
  })
}
