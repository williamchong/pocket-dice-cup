/**
 * Pro is one purchase, made in the App Store or Google Play, that unlocks
 * every dice skin and table marked `pro`. Everything that shipped before Pro
 * stays free. The web sells nothing: it has no store to restore a purchase
 * from, and selling there would need accounts.
 */
interface Unlockable { pro?: boolean }

const STORAGE_KEY = 'pocket-dice-cup:pro'

export function canUse(item: Unlockable, ownsPro: boolean): boolean {
  return !item.pro || ownsPro
}

/** `item` if it can be used, otherwise `fallback`, as for a Pro skin saved before a refund. */
export function usableOr<T extends Unlockable>(item: T, ownsPro: boolean, fallback: T): T {
  return canUse(item, ownsPro) ? item : fallback
}

/**
 * Asks questions in turn and passes each answer to `keep`, unless a later
 * question was asked before it came; every caller still gets its own answer.
 */
export function newestAnswer<T>(keep: (answer: T) => void): (question: () => Promise<T>) => Promise<T> {
  let asked = 0
  return async (question) => {
    const turn = ++asked
    const answer = await question()
    if (turn === asked) keep(answer)
    return answer
  }
}

/**
 * Whether the store said Pro was owned last time. The store answers only
 * after the app starts, so without this a Pro owner's dice would show in the
 * default skin for a moment at each launch.
 */
export function loadOwnsPro(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return false
  }
}

export function saveOwnsPro(owns: boolean): void {
  try {
    if (owns) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  }
  catch {
    // Not saved; the store is asked again at the next launch.
  }
}
