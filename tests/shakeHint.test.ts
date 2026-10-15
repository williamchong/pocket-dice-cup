import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadShaken, saveShaken } from '../app/utils/shakeHint'

describe('saved shake', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is false until saved, then true', () => {
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    expect(loadShaken()).toBe(false)
    saveShaken()
    expect(loadShaken()).toBe(true)
  })

  it('is false when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadShaken()).toBe(false)
    expect(() => saveShaken()).not.toThrow()
  })
})
