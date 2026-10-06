import { DIE_KINDS, isDieKind, type DieKind } from '../engine/dice/shapes'

const STORAGE_KEY = 'pocket-dice-cup:history'

/** How many rolls are kept; older ones drop off the end. */
export const MAX_HISTORY = 50

export interface Roll {
  /** One value per die, in the cup's order. */
  values: number[]
  /** The kind of each die; missing from rolls saved before there were other kinds than the d6. */
  kinds?: DieKind[]
  /** When the dice settled, in milliseconds since the epoch. */
  time: number
}

export function rollTotal(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

/**
 * Each die's value: "3 + 5 + 1" for d6s, and by kind for any others, as
 * "d6: 3 + 5 · d20: 17" or "d20: 17". Null for a lone d6, whose value is the
 * total.
 */
export function rollBreakdown(values: readonly number[], kinds?: readonly DieKind[]): string | null {
  const kindOf = values.map((_, index) => kinds?.[index] ?? 'd6')
  if (kindOf.every(kind => kind === 'd6')) return values.length > 1 ? values.join(' + ') : null
  return DIE_KINDS.flatMap((kind) => {
    const shown = values.filter((_, index) => kindOf[index] === kind)
    // A no-break space keeps the kind on the line of its first value.
    return shown.length > 0 ? [`${kind}:\u00A0${shown.join(' + ')}`] : []
  }).join(' · ')
}

function isRoll(value: unknown): value is Roll {
  if (typeof value !== 'object' || value === null) return false
  const { values, time, kinds } = value as Partial<Roll>
  return Array.isArray(values) && values.length > 0
    && values.every(die => Number.isInteger(die) && die >= 1)
    && (kinds === undefined || (Array.isArray(kinds) && kinds.length === values.length && kinds.every(isDieKind)))
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

/** The history with `values`, of dice of `kinds`, added as the newest roll, capped at MAX_HISTORY. */
export function addRoll(history: readonly Roll[], values: readonly number[], kinds: readonly DieKind[], time: number): Roll[] {
  return [{ values: [...values], kinds: [...kinds], time }, ...history].slice(0, MAX_HISTORY)
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
