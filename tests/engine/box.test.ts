import { describe, expect, it } from 'vitest'
import { boxForViewport, toScreen } from '../../app/engine/box'
import { D6_SIZE } from '../../app/engine/dice/d6'

describe('toScreen', () => {
  const box = boxForViewport(390, 844)

  it('draws the middle of the cup in the middle of the viewport', () => {
    const { x, y } = toScreen(box, 390, 844, { x: 0, y: 0, z: 0 })
    expect(x).toBeCloseTo(195)
    expect(y).toBeCloseTo(422)
  })

  it('draws the rim of the glass on the viewport edge, and the floor a little inside it', () => {
    const glass = toScreen(box, 390, 844, { x: box.width / 2, y: box.height / 2, z: box.depth })
    expect(glass.x).toBeCloseTo(390)
    expect(glass.y).toBeCloseTo(0)
    const floor = toScreen(box, 390, 844, { x: box.width / 2, y: box.height / 2, z: 0 })
    expect(floor.x).toBeLessThan(390)
    expect(floor.y).toBeGreaterThan(0)
  })

  it('draws the top of a d6 at rest at 60 px to the centimetre, as boxForViewport sizes the cup', () => {
    expect(toScreen(box, 390, 844, { x: 0, y: 0, z: D6_SIZE }).pxPerCm).toBeCloseTo(60)
  })
})
