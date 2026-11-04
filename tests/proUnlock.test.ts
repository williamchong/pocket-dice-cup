import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIE_SKINS, type DieSkin } from '../app/engine/render/skins'
import { TABLES, type Table } from '../app/engine/tables'
import { PRO_SKINS } from '../app/engine/pro/skins'
import { PRO_TABLES } from '../app/engine/pro/tables'
import { canUse, loadOwnsPro, newestAnswer, saveOwnsPro, usableOr } from '../app/utils/proUnlock'

const free = { id: 'free' }
const pro = { id: 'pro', pro: true }

describe('Pro', () => {
  it('leaves every skin and table that shipped before it free, and comes with every one added since', () => {
    const shippedFree = ['ivory', 'ebony', 'casino', 'sapphire', 'emerald', 'amethyst', 'dragon', 'cherry', 'smoke', 'ice', 'gold', 'silver', 'copper', 'felt', 'battlemat']
    const items: readonly (DieSkin | Table)[] = [...DIE_SKINS, ...TABLES]
    for (const item of items) expect(Boolean(item.pro), item.id).toBe(!shippedFree.includes(item.id))
  })

  it('keeps every Pro look in app/engine/pro, the only folder under the Pro licence rather than the GPL', () => {
    const items: readonly (DieSkin | Table)[] = [...DIE_SKINS, ...TABLES]
    const proIds = items.filter(item => item.pro).map(item => item.id)
    expect(proIds).toEqual([...PRO_SKINS, ...PRO_TABLES].map(item => item.id))
  })

  it('lets a free item be used always and a Pro one only while Pro is owned', () => {
    expect(canUse(free, false)).toBe(true)
    expect(canUse(free, true)).toBe(true)
    expect(canUse(pro, false)).toBe(false)
    expect(canUse(pro, true)).toBe(true)
  })

  it('keeps only the newest answer when an older question answers last', async () => {
    const kept: boolean[] = []
    const ask = newestAnswer((owned: boolean) => kept.push(owned))
    let answerLaunch!: (owned: boolean) => void
    const launch = ask(() => new Promise(resolve => answerLaunch = resolve))
    // A purchase completes while the launch check is still waiting.
    expect(await ask(async () => true)).toBe(true)
    answerLaunch(false)
    expect(await launch).toBe(false)
    expect(kept).toEqual([true])
  })

  it('falls back from a Pro item that cannot be used', () => {
    expect(usableOr(pro, false, free)).toBe(free)
    expect(usableOr(pro, true, free)).toBe(pro)
    expect(usableOr(free, false, pro)).toBe(free)
  })
})

describe('saved Pro', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(items = new Map<string, string>()) {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    })
    return items
  }

  it('comes back as saved, and is gone once Pro is not owned', () => {
    const items = stubStorage()
    expect(loadOwnsPro()).toBe(false)
    saveOwnsPro(true)
    expect(loadOwnsPro()).toBe(true)
    saveOwnsPro(false)
    expect(loadOwnsPro()).toBe(false)
    expect(items.size).toBe(0)
  })

  it('is not owned when the saved value is junk', () => {
    stubStorage(new Map([['pocket-dice-cup:pro', 'yes']]))
    expect(loadOwnsPro()).toBe(false)
  })

  it('is not owned when storage throws', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
    expect(loadOwnsPro()).toBe(false)
    expect(() => saveOwnsPro(true)).not.toThrow()
  })
})
