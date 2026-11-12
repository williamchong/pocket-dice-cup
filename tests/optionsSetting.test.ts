import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadIslandOn, loadSoundOn, saveIslandOn, saveSoundOn } from '../app/utils/optionsSetting'

describe('saved options', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('are on until turned off, each on its own', () => {
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    expect(loadSoundOn()).toBe(true)
    expect(loadIslandOn()).toBe(true)
    saveSoundOn(false)
    expect(loadSoundOn()).toBe(false)
    expect(loadIslandOn()).toBe(true)
    saveIslandOn(false)
    saveSoundOn(true)
    expect(loadSoundOn()).toBe(true)
    expect(loadIslandOn()).toBe(false)
  })

  it('are on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadSoundOn()).toBe(true)
    expect(() => saveIslandOn(false)).not.toThrow()
  })
})
