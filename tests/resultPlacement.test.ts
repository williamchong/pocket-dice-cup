import { describe, expect, it } from 'vitest'
import { placeCard } from '../app/utils/resultPlacement'

describe('placeCard', () => {
  const top = { left: 100, top: 40, width: 200, height: 80 }
  const low = { left: 100, top: 700, width: 200, height: 80 }

  it('keeps the card at the top when nothing is under it', () => {
    expect(placeCard([{ x: 200, y: 400, r: 40 }], [top, low])).toBe(0)
    expect(placeCard([], [top, low])).toBe(0)
  })

  it('moves the card when a die is under it, or half under an edge', () => {
    expect(placeCard([{ x: 200, y: 80, r: 40 }], [top, low])).toBe(1)
    expect(placeCard([{ x: 315, y: 80, r: 40 }], [top, low])).toBe(1)
  })

  it('keeps the top when the card only clips the corner of a die', () => {
    expect(placeCard([{ x: 325, y: 140, r: 40 }], [top, low])).toBe(0)
  })

  it('picks the place that hides fewer dice, and the top on a tie', () => {
    const atTop = { x: 200, y: 80, r: 40 }
    const atBottom = { x: 200, y: 740, r: 40 }
    expect(placeCard([atTop, atTop, atBottom], [top, low])).toBe(1)
    expect(placeCard([atTop, atBottom], [top, low])).toBe(0)
  })
})
