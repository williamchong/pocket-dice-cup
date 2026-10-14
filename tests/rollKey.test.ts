import { describe, expect, it } from 'vitest'
import { isRollKey, type RollKeyEvent } from '../app/utils/rollKey'

/** A stand-in for an element, inside a control or not. */
function element(inControl: boolean): EventTarget {
  return { closest: () => inControl ? {} : null } as unknown as EventTarget
}

function press(overrides: Partial<RollKeyEvent> = {}): RollKeyEvent {
  return { key: ' ', repeat: false, ctrlKey: false, altKey: false, metaKey: false, target: element(false), ...overrides }
}

describe('isRollKey', () => {
  it('rolls on the space bar outside a control, or from the window', () => {
    expect(isRollKey(press())).toBe(true)
    expect(isRollKey(press({ target: null }))).toBe(true)
    expect(isRollKey(press({ target: {} as EventTarget }))).toBe(true)
  })

  it('does not roll again while the key is held', () => {
    expect(isRollKey(press({ repeat: true }))).toBe(false)
  })

  it('leaves the space bar to a focused button or field', () => {
    expect(isRollKey(press({ target: element(true) }))).toBe(false)
  })

  it('ignores the space bar with a modifier, and other keys', () => {
    expect(isRollKey(press({ ctrlKey: true }))).toBe(false)
    expect(isRollKey(press({ altKey: true }))).toBe(false)
    expect(isRollKey(press({ metaKey: true }))).toBe(false)
    expect(isRollKey(press({ key: 'Enter' }))).toBe(false)
    expect(isRollKey(press({ key: 'Spacebar' }))).toBe(false)
  })
})
