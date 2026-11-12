const SOUND_KEY = 'pocket-dice-cup:sound'
const ISLAND_KEY = 'pocket-dice-cup:island'

/** A switch saved as '0' or '1', on unless turned off, as both options start on. */
function loadOn(key: string): boolean {
  try {
    return localStorage.getItem(key) !== '0'
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return true
  }
}

function saveOn(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  }
  catch {
    // Not saved; the switch still applies until the page is closed.
  }
}

/** Whether the dice are heard; muting leaves the vibration. */
export const loadSoundOn = (): boolean => loadOn(SOUND_KEY)
export const saveSoundOn = (on: boolean): void => saveOn(SOUND_KEY, on)

/** Whether the last roll is kept in the Dynamic Island and on the Lock Screen, in the iPhone app. */
export const loadIslandOn = (): boolean => loadOn(ISLAND_KEY)
export const saveIslandOn = (on: boolean): void => saveOn(ISLAND_KEY, on)
