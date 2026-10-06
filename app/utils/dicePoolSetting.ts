import { d6Pool, formatPool, MAX_DICE, parseNotation, type DicePool } from '../engine/core/pool'

const STORAGE_KEY = 'pocket-dice-cup:pool'
/**
 * Where the number of d6 was kept before the kinds of dice could be chosen,
 * still read for anyone who has not changed their dice since.
 */
const COUNT_STORAGE_KEY = 'pocket-dice-cup:dice'

/**
 * A pool from dice notation ("2d6 + d20"), or from a bare number of d6, as
 * `?dice=3` and the old saved count give; null for anything else.
 */
export function parsePoolSetting(value: unknown): DicePool | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) return parseNotation(text)
  const count = Number(text)
  return count >= 1 && count <= MAX_DICE ? d6Pool(count) : null
}

/** The dice chosen last time, or null if none were saved or storage is unavailable. */
export function loadPool(): DicePool | null {
  try {
    return parsePoolSetting(localStorage.getItem(STORAGE_KEY)) ?? parsePoolSetting(localStorage.getItem(COUNT_STORAGE_KEY))
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return null
  }
}

export function savePool(pool: DicePool): void {
  try {
    localStorage.setItem(STORAGE_KEY, formatPool(pool))
  }
  catch {
    // Not saved; the dice still apply until the page is closed.
  }
}
