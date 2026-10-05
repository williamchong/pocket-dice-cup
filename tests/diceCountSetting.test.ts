import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDiceCount, parseDiceCount, saveDiceCount } from '../app/utils/diceCountSetting'

describe('parseDiceCount', () => {
  it('accepts a whole number of dice from 1 to 12', () => {
    expect(parseDiceCount('1')).toBe(1)
    expect(parseDiceCount('3')).toBe(3)
    expect(parseDiceCount('12')).toBe(12)
    expect(parseDiceCount(5)).toBe(5)
  })

  it('rejects counts out of range, fractions and junk', () => {
    expect(parseDiceCount('0')).toBeNull()
    expect(parseDiceCount('13')).toBeNull()
    expect(parseDiceCount('2.5')).toBeNull()
    expect(parseDiceCount('abc')).toBeNull()
    expect(parseDiceCount('')).toBeNull()
    expect(parseDiceCount(null)).toBeNull()
    expect(parseDiceCount(undefined)).toBeNull()
  })
})

describe('saved dice count', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads back the count it saved', () => {
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    expect(loadDiceCount()).toBeNull()
    saveDiceCount(4)
    expect(loadDiceCount()).toBe(4)
  })

  it('carries on without a count when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(() => saveDiceCount(4)).not.toThrow()
    expect(loadDiceCount()).toBeNull()
  })
})
