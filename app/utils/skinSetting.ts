import { DEFAULT_SKIN_ID, isDieSkinId, type DieSkinId } from '../engine/render/skins'

const STORAGE_KEY = 'pocket-dice-cup:skin'

/** A skin's id, as `?skin=ebony` and the saved setting give; null for anything else. */
export function parseSkinSetting(value: unknown): DieSkinId | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return isDieSkinId(id) ? id : null
}

/** The skin chosen last time, or the default if none was saved or storage is unavailable. */
export function loadSkin(): DieSkinId {
  try {
    return parseSkinSetting(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_SKIN_ID
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return DEFAULT_SKIN_ID
  }
}

export function saveSkin(id: DieSkinId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  }
  catch {
    // Not saved; the skin still applies until the page is closed.
  }
}
