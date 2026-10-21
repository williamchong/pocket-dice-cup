/**
 * Pro is one purchase, made in the App Store or Google Play, that unlocks
 * every dice skin and table marked `pro`. Everything that shipped before Pro
 * stays free, so nothing is marked yet. The web sells nothing: it has no
 * store to restore a purchase from, and selling there would need accounts.
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
