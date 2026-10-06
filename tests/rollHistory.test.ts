import { afterEach, describe, expect, it, vi } from 'vitest'
import { addRoll, loadHistory, MAX_HISTORY, parseHistory, rollBreakdown, rollTotal, saveHistory } from '../app/utils/rollHistory'

describe('rollTotal', () => {
  it('adds up the dice', () => {
    expect(rollTotal([4])).toBe(4)
    expect(rollTotal([3, 5, 1])).toBe(9)
  })
})

describe('rollBreakdown', () => {
  it('lists each die, but not a single one', () => {
    expect(rollBreakdown([3, 5, 1])).toBe('3 + 5 + 1')
    expect(rollBreakdown([4])).toBeNull()
    expect(rollBreakdown([3, 5], ['d6', 'd6'])).toBe('3 + 5')
  })

  it('lists the dice by kind when any is not a d6, even alone', () => {
    expect(rollBreakdown([3, 5, 17], ['d6', 'd6', 'd20'])).toBe('d6:\u00A03 + 5 · d20:\u00A017')
    expect(rollBreakdown([10], ['d10'])).toBe('d10:\u00A010')
  })
})

describe('addRoll', () => {
  it('puts the new roll first', () => {
    const history = addRoll(addRoll([], [1], ['d6'], 1000), [6, 2], ['d6', 'd6'], 2000)
    expect(history).toEqual([{ values: [6, 2], kinds: ['d6', 'd6'], time: 2000 }, { values: [1], kinds: ['d6'], time: 1000 }])
  })

  it(`keeps only the last ${MAX_HISTORY} rolls`, () => {
    let history = addRoll([], [1], ['d6'], 0)
    for (let time = 1; time <= MAX_HISTORY; time++) history = addRoll(history, [2], ['d6'], time)
    expect(history).toHaveLength(MAX_HISTORY)
    expect(history[0]!.time).toBe(MAX_HISTORY)
    expect(history.at(-1)!.time).toBe(1)
  })

  it('copies the values, so the cup reusing its array cannot change a saved roll', () => {
    const values = [3, 3]
    const [roll] = addRoll([], values, ['d6', 'd6'], 0)
    values[0] = 6
    expect(roll!.values).toEqual([3, 3])
  })
})

describe('parseHistory', () => {
  it('reads nothing from missing or broken JSON', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory('')).toEqual([])
    expect(parseHistory('{not json')).toEqual([])
    expect(parseHistory('{"values":[1],"time":0}')).toEqual([])
  })

  it('skips malformed rolls and keeps the rest', () => {
    const json = JSON.stringify([
      { values: [2, 5], time: 10 },
      { values: [], time: 9 },
      { values: [0], time: 8 },
      { values: [1.5], time: 7 },
      { values: [3], time: 'yesterday' },
      { values: [3], time: 1e20 },
      null,
      { values: [4], time: 6 },
      { values: [4, 7], kinds: ['d6', 'd8'], time: 5 },
      { values: [4, 7], kinds: ['d6'], time: 4 },
      { values: [4], kinds: ['d7'], time: 3 },
    ])
    expect(parseHistory(json)).toEqual([{ values: [2, 5], time: 10 }, { values: [4], time: 6 }, { values: [4, 7], kinds: ['d6', 'd8'], time: 5 }])
  })
})

describe('saved history', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads back the history it saved', () => {
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    expect(loadHistory()).toEqual([])
    const history = addRoll(addRoll([], [1, 2], ['d6', 'd20'], 1000), [6], ['d6'], 2000)
    saveHistory(history)
    expect(loadHistory()).toEqual(history)
  })

  it('carries on without a history when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(() => saveHistory(addRoll([], [1], ['d6'], 0))).not.toThrow()
    expect(loadHistory()).toEqual([])
  })
})
