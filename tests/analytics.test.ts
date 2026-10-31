import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Analytics, GtagAnalyticsBackend, loadAnalyticsEnabled, saveAnalyticsEnabled, type AnalyticsBackend, type Gtag } from '../app/utils/analytics'

vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}) }))

const ROLL = { dice: '3d6', skin: 'ivory', table: 'felt' }

function fakeBackend() {
  return {
    track: vi.fn<(event: string, params: unknown) => void | Promise<void>>(),
    setEnabled: vi.fn<AnalyticsBackend['setEnabled']>(),
  }
}

beforeEach(() => {
  const saved = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the saved choice', () => {
  it('is on until switched off, and stays as last set', () => {
    expect(loadAnalyticsEnabled()).toBe(true)
    saveAnalyticsEnabled(false)
    expect(loadAnalyticsEnabled()).toBe(false)
    saveAnalyticsEnabled(true)
    expect(loadAnalyticsEnabled()).toBe(true)
  })

  it('reads as off when storage is blocked, as a saved "off" could be hidden there', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadAnalyticsEnabled()).toBe(false)
  })
})

describe('Analytics', () => {
  it('does nothing and offers no switch with no backend, as in a debug run', () => {
    const analytics = new Analytics(null, true)
    expect(analytics.available).toBe(false)
    expect(() => analytics.track('roll_completed', ROLL)).not.toThrow()
  })

  it('tells the backend the saved choice at launch', () => {
    const backend = fakeBackend()
    new Analytics(backend, false).start()
    expect(backend.setEnabled).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('sends events only while on, and saves the choice when it changes', () => {
    const backend = fakeBackend()
    const analytics = new Analytics(backend, true)
    analytics.track('roll_completed', ROLL)
    expect(backend.track).toHaveBeenCalledExactlyOnceWith('roll_completed', ROLL)

    analytics.setEnabled(false)
    analytics.track('roll_completed', ROLL)
    expect(backend.track).toHaveBeenCalledOnce()
    expect(backend.setEnabled).toHaveBeenLastCalledWith(false)
    expect(loadAnalyticsEnabled()).toBe(false)
  })

  it('swallows a backend that throws or rejects, as a roll must not fail with it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const backend = fakeBackend()
    backend.track.mockImplementationOnce(() => {
      throw new Error('thrown')
    })
    backend.track.mockRejectedValueOnce(new Error('rejected'))
    const analytics = new Analytics(backend, true)
    expect(() => analytics.track('roll_completed', ROLL)).not.toThrow()
    expect(() => analytics.track('pro_purchase', { outcome: 'failed' })).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2))
  })

  it('stays quiet about a shell built before the plugin was added', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const backend = fakeBackend()
    backend.track.mockRejectedValue({ code: 'UNIMPLEMENTED' })
    new Analytics(backend, true).track('roll_completed', ROLL)
    await Promise.resolve()
    await Promise.resolve()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('GtagAnalyticsBackend', () => {
  const DISABLE = 'ga-disable-G-TEST'
  const flag = () => (globalThis as unknown as Record<string, unknown>)[DISABLE]

  afterEach(() => {
    Reflect.deleteProperty(globalThis, DISABLE)
  })

  it('never fetches the script while off', async () => {
    const load = vi.fn<() => Promise<Gtag>>()
    const backend = new GtagAnalyticsBackend('G-TEST', load)
    await backend.setEnabled(false)
    await backend.track('roll_completed', ROLL)
    expect(load).not.toHaveBeenCalled()
    expect(flag()).toBe(true)
  })

  it('fetches it once however often it is switched, and lifts Google\'s switch when on', async () => {
    const gtag = vi.fn<Gtag>()
    const load = vi.fn(async () => gtag)
    const backend = new GtagAnalyticsBackend('G-TEST', load)
    await backend.setEnabled(true)
    await backend.setEnabled(false)
    await backend.setEnabled(true)
    expect(load).toHaveBeenCalledOnce()
    expect(flag()).toBe(false)

    await backend.track('roll_completed', ROLL)
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'roll_completed', ROLL)
  })

  it('passes on a load that fails, for Analytics to catch, and sets Google\'s switch first', async () => {
    const backend = new GtagAnalyticsBackend('G-TEST', () => Promise.reject(new Error('offline')))
    await expect(backend.setEnabled(true)).rejects.toThrow('offline')
    expect(flag()).toBe(false)
  })
})
