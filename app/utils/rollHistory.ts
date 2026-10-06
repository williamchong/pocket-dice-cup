const STORAGE_KEY = 'pocket-dice-cup:history'

/** How many rolls are kept; older ones drop off the end. */
export const MAX_HISTORY = 50

export interface Roll {
  /** One value per die, in the cup's order. */
  values: number[]
  /** When the dice settled, in milliseconds since the epoch. */
  time: number
}

export function rollTotal(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

/** Each die's value, as "3 + 5 + 1"; null for one die, whose value is the total. */
export function rollBreakdown(values: readonly number[]): string | null {
  return values.length > 1 ? values.join(' + ') : null
}

function isRoll(value: unknown): value is Roll {
  if (typeof value !== 'object' || value === null) return false
  const { values, time } = value as Partial<Roll>
  return Array.isArray(values) && values.length > 0
    && values.every(die => Number.isInteger(die) && die >= 1)
    // A time outside the Date range would make toISOString throw when shown.
    && typeof time === 'number' && Number.isFinite(new Date(time).getTime())
}

/** The rolls in saved JSON, newest first, skipping any that are malformed. */
export function parseHistory(json: string | null): Roll[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter(isRoll).slice(0, MAX_HISTORY) : []
  }
  catch {
    return []
  }
}

/** The history with `values` added as the newest roll, capped at MAX_HISTORY. */
export function addRoll(history: readonly Roll[], values: readonly number[], time: number): Roll[] {
  return [{ values: [...values], time }, ...history].slice(0, MAX_HISTORY)
}

/** The saved rolls, newest first; empty if none were saved or storage is unavailable. */
export function loadHistory(): Roll[] {
  try {
    return parseHistory(localStorage.getItem(STORAGE_KEY))
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return []
  }
}

export function saveHistory(history: readonly Roll[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }
  catch {
    // Not saved; the history still shows until the page is closed.
  }
}
