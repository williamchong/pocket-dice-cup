const SOUND_KEY = 'pocket-dice-cup:sound'
const VIBRATION_KEY = 'pocket-dice-cup:vibration'
const TOTAL_KEY = 'pocket-dice-cup:total'
const ISLAND_KEY = 'pocket-dice-cup:island'

/** A switch saved as '0' or '1', on unless turned off, as every option starts on. */
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

/** Whether the dice are felt; stilling them leaves the sound. */
export const loadVibrationOn = (): boolean => loadOn(VIBRATION_KEY)
export const saveVibrationOn = (on: boolean): void => saveOn(VIBRATION_KEY, on)

/** Whether the result card adds the dice up, which games that read each die, such as liar's dice, do without. */
export const loadTotalOn = (): boolean => loadOn(TOTAL_KEY)
export const saveTotalOn = (on: boolean): void => saveOn(TOTAL_KEY, on)

/** Whether the last roll is kept in the Dynamic Island and on the Lock Screen, in the iPhone app. */
export const loadIslandOn = (): boolean => loadOn(ISLAND_KEY)
export const saveIslandOn = (on: boolean): void => saveOn(ISLAND_KEY, on)
