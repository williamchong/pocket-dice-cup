import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SKIN_ID, DIE_SKINS, findSkin } from '../app/engine/render/skins'
import { loadSkin, parseSkinSetting, saveSkin } from '../app/utils/skinSetting'

describe('skins', () => {
  it('has a distinct id and CSS hex colours per skin', () => {
    expect(new Set(DIE_SKINS.map(skin => skin.id)).size).toBe(DIE_SKINS.length)
    for (const skin of DIE_SKINS) {
      expect(skin.body).toMatch(/^#[0-9a-f]{6}$/)
      expect(skin.ink).toMatch(/^#[0-9a-f]{6}$/)
      expect(findSkin(skin.id)).toBe(skin)
    }
  })
})

describe('parseSkinSetting', () => {
  it('reads a skin id, whatever its case', () => {
    expect(parseSkinSetting('ebony')).toBe('ebony')
    expect(parseSkinSetting(' Casino ')).toBe('casino')
  })

  it('rejects unknown skins and junk', () => {
    expect(parseSkinSetting('marble')).toBeNull()
    expect(parseSkinSetting('')).toBeNull()
    expect(parseSkinSetting(null)).toBeNull()
    expect(parseSkinSetting(undefined)).toBeNull()
    expect(parseSkinSetting(['ebony'])).toBeNull()
  })
})

describe('saved skin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(items = new Map<string, string>()) {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    })
    return items
  }

  it('comes back as saved', () => {
    stubStorage()
    saveSkin('sapphire')
    expect(loadSkin()).toBe('sapphire')
  })

  it('is the default when nothing is saved or the saved value is not a skin', () => {
    const items = stubStorage()
    expect(loadSkin()).toBe(DEFAULT_SKIN_ID)
    items.set('pocket-dice-cup:skin', 'marble')
    expect(loadSkin()).toBe(DEFAULT_SKIN_ID)
  })

  it('is the default when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadSkin()).toBe(DEFAULT_SKIN_ID)
    expect(() => saveSkin('ebony')).not.toThrow()
  })
})
