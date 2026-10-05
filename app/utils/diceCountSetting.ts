import { MAX_DICE } from '../engine/physics/world'

const STORAGE_KEY = 'pocket-dice-cup:dice'

/** A whole number of dice from 1 to MAX_DICE, or null for anything else. */
export function parseDiceCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= MAX_DICE ? count : null
}

/** The number of dice chosen last time, or null if none was saved or storage is unavailable. */
export function loadDiceCount(): number | null {
  try {
    return parseDiceCount(localStorage.getItem(STORAGE_KEY))
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return null
  }
}

export function saveDiceCount(count: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(count))
  }
  catch {
    // Not saved; the count still applies until the page is closed.
  }
}
