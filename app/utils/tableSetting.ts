import { DEFAULT_TABLE_ID, isTableId, type TableId } from '../engine/tables'

const STORAGE_KEY = 'pocket-dice-cup:table'

/** A table's id, as `?table=battlemat` and the saved setting give; null for anything else. */
export function parseTableSetting(value: unknown): TableId | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return isTableId(id) ? id : null
}

/** The table chosen last time, or the default if none was saved or storage is unavailable. */
export function loadTable(): TableId {
  try {
    return parseTableSetting(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_TABLE_ID
  }
  catch {
    // Storage can throw when blocked, as in some private windows.
    return DEFAULT_TABLE_ID
  }
}

export function saveTable(id: TableId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  }
  catch {
    // Not saved; the table still applies until the page is closed.
  }
}
