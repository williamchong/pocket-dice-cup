import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPool, parsePoolSetting, savePool } from '../app/utils/dicePoolSetting'

describe('parsePoolSetting', () => {
  it('reads a bare number as that many d6, from 1 to 12', () => {
    expect(parsePoolSetting('1')).toEqual(['d6'])
    expect(parsePoolSetting('3')).toEqual(['d6', 'd6', 'd6'])
    expect(parsePoolSetting(12)).toHaveLength(12)
  })

  it('reads dice notation, including a + that arrived in a link as a space', () => {
    expect(parsePoolSetting('2d6+d20')).toEqual(['d6', 'd6', 'd20'])
    expect(parsePoolSetting('2d6 d20')).toEqual(['d6', 'd6', 'd20'])
  })

  it('rejects counts out of range, fractions and junk', () => {
    expect(parsePoolSetting('0')).toBeNull()
    expect(parsePoolSetting('13')).toBeNull()
    expect(parsePoolSetting('2.5')).toBeNull()
    expect(parsePoolSetting('abc')).toBeNull()
    expect(parsePoolSetting('')).toBeNull()
    expect(parsePoolSetting(null)).toBeNull()
    expect(parsePoolSetting(undefined)).toBeNull()
    expect(parsePoolSetting(['3'])).toBeNull()
  })
})

describe('saved dice', () => {
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

  it('reads back the dice it saved', () => {
    stubStorage()
    expect(loadPool()).toBeNull()
    savePool(['d4', 'd20', 'd20'])
    expect(loadPool()).toEqual(['d4', 'd20', 'd20'])
  })

  it('reads a number of d6 saved before the kinds could be chosen', () => {
    stubStorage(new Map([['pocket-dice-cup:dice', '4']]))
    expect(loadPool()).toEqual(['d6', 'd6', 'd6', 'd6'])
    savePool(['d8'])
    expect(loadPool()).toEqual(['d8'])
  })

  it('carries on without dice when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(() => savePool(['d6'])).not.toThrow()
    expect(loadPool()).toBeNull()
  })
})
