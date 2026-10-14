type WebKitWindow = Window & { webkit?: { messageHandlers?: Record<string, { postMessage: (body: unknown) => void } | undefined> } }

/** As long as the fade of `.splash--gone` in app/spa-loading-template.html. */
const FADE_MS = 400

/**
 * Fades out the loading screen of app/spa-loading-template.html, and removes
 * it. The iOS app shows its own until now (DiceCupViewController), and is
 * told to fade that out too.
 */
export function hideSplash() {
  (window as WebKitWindow).webkit?.messageHandlers?.cupReady?.postMessage(null)
  const splash = document.getElementById('splash')
  if (!splash || splash.classList.contains('splash--gone')) return
  splash.classList.add('splash--gone')
  // A timer rather than transitionend, which never comes in a hidden tab.
  setTimeout(() => splash.remove(), FADE_MS)
}
