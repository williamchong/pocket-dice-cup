import { describe, expect, it } from 'vitest'
import { countKinds, formatPool, MAX_DICE, normalisePool, parseNotation, withCount } from '../../app/engine/core/pool'

describe('parseNotation', () => {
  it('reads counts and kinds joined by +, in any case and spacing', () => {
    expect(parseNotation('3d6')).toEqual(['d6', 'd6', 'd6'])
    expect(parseNotation('3d6+1d20')).toEqual(['d6', 'd6', 'd6', 'd20'])
    expect(parseNotation(' 2D8 + d4 ')).toEqual(['d4', 'd8', 'd8'])
    expect(parseNotation('d10')).toEqual(['d10'])
  })

  it('adds up a kind given twice, and lists the dice smallest first', () => {
    expect(parseNotation('d20 + d12 + d20 + d4')).toEqual(['d4', 'd12', 'd20', 'd20'])
  })

  it('takes up to the most dice the cup holds', () => {
    expect(parseNotation(`${MAX_DICE}d6`)).toHaveLength(MAX_DICE)
    expect(parseNotation(`${MAX_DICE - 1}d6 + 1d20`)).toHaveLength(MAX_DICE)
    expect(parseNotation(`${MAX_DICE}d6 + d4`)).toBeNull()
    expect(parseNotation('99999999999d6')).toBeNull()
  })

  it('rejects unknown dice, empty terms and anything else', () => {
    for (const notation of ['', '+', '0d6', 'd7', 'd100', '3', 'd', '3x6', '2d6-1', '2d6+3', 'd6d6']) {
      expect(parseNotation(notation), notation).toBeNull()
    }
  })
})

describe('formatPool', () => {
  it('writes the pool smallest kind first, and reads back the same', () => {
    expect(formatPool(['d6', 'd6', 'd20'])).toBe('2d6 + 1d20')
    for (const notation of ['1d4', '3d6 + 1d8 + 2d10', '1d12 + 11d20']) {
      expect(formatPool(parseNotation(notation)!)).toBe(notation)
    }
  })
})

describe('pools', () => {
  it('sorts the dice, keeps at most MAX_DICE and never leaves the cup empty', () => {
    expect(normalisePool(['d20', 'd4', 'd6'])).toEqual(['d4', 'd6', 'd20'])
    expect(normalisePool(Array.from({ length: 20 }, () => 'd8'))).toHaveLength(MAX_DICE)
    expect(normalisePool([])).toEqual(['d6'])
  })

  it('counts and sets each kind apart from the others', () => {
    const pool = withCount(['d6', 'd6'], 'd20', 2)
    expect(pool).toEqual(['d6', 'd6', 'd20', 'd20'])
    expect(countKinds(pool)).toMatchObject({ d4: 0, d6: 2, d20: 2 })
    expect(withCount(pool, 'd6', 0)).toEqual(['d20', 'd20'])
  })
})
