export interface ScreenAwake {
  /** Lets the screen sleep for now (false), or keeps it on again (true). */
  setWanted(wanted: boolean): void
  /** Lets the screen sleep for good. */
  release(): void
}

/**
 * Keeps the screen on, so it does not dim while the phone lies on the table
 * showing a result, unless it is not wanted for now: while it lies
 * screen-down, nobody sees it.
 *
 * The browser drops the lock whenever the page is hidden, so it is taken again
 * each time the page comes back.
 */
export function keepScreenAwake(): ScreenAwake {
  if (!('wakeLock' in navigator)) return { setWanted: () => {}, release: () => {} }

  let sentinel: WakeLockSentinel | null = null
  let wanted = true
  let released = false

  const letGo = () => {
    sentinel?.release()
    sentinel = null
  }

  const acquire = async () => {
    if (released || !wanted || document.visibilityState !== 'visible') return
    try {
      const taken = await navigator.wakeLock.request('screen')
      if (released || !wanted) return taken.release()
      // A request made while this one was pending may have landed first.
      sentinel?.release()
      sentinel = taken
    }
    catch {
      // Refused, for example in low power mode. The app works without it.
    }
  }

  document.addEventListener('visibilitychange', acquire)
  acquire()

  return {
    setWanted(next) {
      if (next === wanted) return
      wanted = next
      if (wanted) acquire()
      else letGo()
    },
    release() {
      released = true
      document.removeEventListener('visibilitychange', acquire)
      letGo()
    },
  }
}
