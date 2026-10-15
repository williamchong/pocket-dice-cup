const STORAGE_KEY = 'pocket-dice-cup:shaken'

/** Whether the phone has ever rolled the dice by a shake, after which the hint to shake is not shown. */
export function loadShaken(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return false
  }
}

export function saveShaken(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  }
  catch {
    // Not saved; the hint shows again next time.
  }
}
