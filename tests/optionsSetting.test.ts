import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadIslandOn, loadSoundOn, loadTotalOn, loadVibrationOn, saveIslandOn, saveSoundOn, saveTotalOn, saveVibrationOn } from '../app/utils/optionsSetting'

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
    expect(loadVibrationOn()).toBe(true)
    expect(loadTotalOn()).toBe(true)
    saveVibrationOn(false)
    saveTotalOn(false)
    expect(loadVibrationOn()).toBe(false)
    expect(loadTotalOn()).toBe(false)
    expect(loadSoundOn()).toBe(true)
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
