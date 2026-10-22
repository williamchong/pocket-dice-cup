import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SOUND_TUNING } from '../app/engine/feedback/clackSound'
import { DEFAULT_HAPTIC_TUNING } from '../app/engine/feedback/cupFeedback'
import { DEFAULT_TABLE_ID, TABLES, findTable, type Table } from '../app/engine/tables'
import { loadTable, parseTableSetting, saveTable } from '../app/utils/tableSetting'

describe('tables', () => {
  it('has a distinct id, CSS hex colours and audible voices per table', () => {
    expect(new Set(TABLES.map(table => table.id)).size).toBe(TABLES.length)
    for (const table of TABLES) {
      const { light, panel }: Table = table
      for (const colour of [table.floor.colour, table.wall.colour, table.mark, light?.colour ?? '#000000', panel ?? '#000000']) expect(colour).toMatch(/^#[0-9a-f]{6}$/)
      for (const voice of [table.sound.floor, table.sound.side, table.sound.die]) {
        for (const value of Object.values(voice)) expect(value).toBeGreaterThan(0)
      }
      for (const sharpness of Object.values(table.sharpness)) {
        expect(sharpness).toBeGreaterThanOrEqual(0)
        expect(sharpness).toBeLessThanOrEqual(1)
      }
      expect(findTable(table.id)).toBe(table)
    }
  })

  it('starts on the felt, which sounds and feels as the cup did before there were tables', () => {
    const felt = findTable(DEFAULT_TABLE_ID)
    expect(felt.id).toBe('felt')
    expect(felt.sound).toEqual(DEFAULT_SOUND_TUNING)
    expect(felt.sharpness).toEqual(DEFAULT_HAPTIC_TUNING.sharpness)
  })
})

describe('parseTableSetting', () => {
  it('reads a table id, whatever its case', () => {
    expect(parseTableSetting('battlemat')).toBe('battlemat')
    expect(parseTableSetting(' Felt ')).toBe('felt')
  })

  it('rejects unknown tables and junk', () => {
    expect(parseTableSetting('marble')).toBeNull()
    expect(parseTableSetting('')).toBeNull()
    expect(parseTableSetting(null)).toBeNull()
    expect(parseTableSetting(['felt'])).toBeNull()
  })
})

describe('saved table', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(items = new Map<string, string>()) {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    return items
  }

  it('comes back as saved', () => {
    stubStorage()
    saveTable('battlemat')
    expect(loadTable()).toBe('battlemat')
  })

  it('is the default when nothing is saved or the saved value is not a table', () => {
    const items = stubStorage()
    expect(loadTable()).toBe(DEFAULT_TABLE_ID)
    items.set('pocket-dice-cup:table', 'marble')
    expect(loadTable()).toBe(DEFAULT_TABLE_ID)
  })

  it('is the default when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadTable()).toBe(DEFAULT_TABLE_ID)
    expect(() => saveTable('felt')).not.toThrow()
  })
})
