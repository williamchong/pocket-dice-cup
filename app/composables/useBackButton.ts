import type { PluginListenerHandle } from '@capacitor/core'

/**
 * Android's back gesture in the app: `back` closes what is open and returns
 * true, or returns false when nothing is, and the app then goes to the
 * background, as Android's own apps do from their first screen. Without
 * this, back would quit the app with a sheet open. Browsers and iOS have no
 * back gesture to take.
 */
export function useBackButton(back: () => boolean) {
  let listener: PluginListenerHandle | null = null
  let unmounted = false

  onMounted(async () => {
    // Imported here rather than statically, so Capacitor stays out of the
    // page's first download, as the engine does (useDiceCup).
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.getPlatform() !== 'android') return
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('backButton', () => {
      if (!back()) void App.minimizeApp()
    })
    if (unmounted) void handle.remove()
    else listener = handle
  })

  onBeforeUnmount(() => {
    unmounted = true
    void listener?.remove()
  })
}
