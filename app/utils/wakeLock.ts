/**
 * Keeps the screen on, so it does not dim while the phone lies on the table
 * showing a result. Returns a function that lets it sleep again.
 *
 * The browser drops the lock whenever the page is hidden, so it is taken again
 * each time the page comes back.
 */
export function keepScreenAwake(): () => void {
  if (!('wakeLock' in navigator)) return () => {}

  let sentinel: WakeLockSentinel | null = null
  let released = false

  const acquire = async () => {
    if (released || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      if (released) sentinel.release()
    }
    catch {
      // Refused, for example in low power mode. The app works without it.
    }
  }

  document.addEventListener('visibilitychange', acquire)
  acquire()

  return () => {
    released = true
    document.removeEventListener('visibilitychange', acquire)
    sentinel?.release()
  }
}
