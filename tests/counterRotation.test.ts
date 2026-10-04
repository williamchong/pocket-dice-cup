import { describe, expect, it } from 'vitest'
import { counterRotation, type CounterRotationStyle } from '../app/utils/counterRotation'

/** Where the element's corners land in the viewport once the style is applied. */
function corners(style: CounterRotationStyle) {
  const top = Number.parseFloat(style.top)
  const left = Number.parseFloat(style.left)
  const width = Number.parseFloat(style.width)
  const height = Number.parseFloat(style.height)
  const turn = style.transform === 'rotate(-90deg)' ? -1 : 1
  // rotate(θ) about the top-left corner, y pointing down: (x, y) → (x cos θ − y sin θ, x sin θ + y cos θ).
  const place = (x: number, y: number) => ({ x: left - turn * y, y: top + turn * x })
  return { topLeft: place(0, 0), topRight: place(width, 0), bottomLeft: place(0, height) }
}

describe('counterRotation', () => {
  it('leaves an upright screen alone', () => {
    expect(counterRotation(0, 390, 844)).toBeUndefined()
  })

  it('fills a landscape viewport with the phone\'s top edge on the left at 90°', () => {
    const { topLeft, topRight, bottomLeft } = corners(counterRotation(90, 844, 390)!)
    // The phone's top edge runs up the left of the viewport, its left edge along the bottom.
    expect(topLeft).toEqual({ x: 0, y: 390 })
    expect(topRight).toEqual({ x: 0, y: 0 })
    expect(bottomLeft).toEqual({ x: 844, y: 390 })
  })

  it('fills a landscape viewport with the phone\'s top edge on the right at 270°', () => {
    const { topLeft, topRight, bottomLeft } = corners(counterRotation(270, 844, 390)!)
    expect(topLeft).toEqual({ x: 844, y: 0 })
    expect(topRight).toEqual({ x: 844, y: 390 })
    expect(bottomLeft).toEqual({ x: 0, y: 0 })
  })

  it('turns an upside-down screen half a turn about its centre', () => {
    // rotate(180deg) about the top-left corner, moved to the bottom-right, maps (x, y) to (w − x, h − y).
    expect(counterRotation(180, 390, 844)).toEqual({
      top: '844px', left: '390px', width: '390px', height: '844px', transformOrigin: 'top left', transform: 'rotate(180deg)',
    })
  })
})
