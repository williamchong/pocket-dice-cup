import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceUnlock, NativeUnlockBackend, WebUnlockBackend } from '../../app/engine/store/unlock'

const native = vi.hoisted(() => ({
  isNative: false,
  // What each plugin call does: resolve with this answer, or reject with this error.
  answer: { owned: true } as { owned: boolean } | null,
  error: null as unknown,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative },
  registerPlugin: () => {
    const call = async () => {
      if (native.error) throw native.error
      return native.answer
    }
    return { ownsPro: call, buyPro: call, restorePro: call }
  },
}))

afterEach(() => {
  native.isNative = false
  native.answer = { owned: true }
  native.error = null
})

describe('WebUnlockBackend', () => {
  it('never owns Pro, nor can buy or restore it', async () => {
    const web = new WebUnlockBackend()
    expect(await web.ownsPro()).toBe(false)
    expect(await web.buyPro()).toBe(false)
    expect(await web.restorePro()).toBe(false)
  })
})

describe('NativeUnlockBackend', () => {
  it('passes on the store plugin\'s answer', async () => {
    const store = new NativeUnlockBackend()
    expect(await store.ownsPro()).toBe(true)
    native.answer = { owned: false }
    expect(await store.buyPro()).toBe(false)
    expect(await store.restorePro()).toBe(false)
  })

  it('owns nothing while the plugin is not in the shell, but cannot buy or restore', async () => {
    native.error = Object.assign(new Error('"CupStore" plugin is not implemented on ios'), { code: 'UNIMPLEMENTED' })
    const store = new NativeUnlockBackend()
    expect(await store.ownsPro()).toBe(false)
    await expect(store.buyPro()).rejects.toThrow('not implemented')
    await expect(store.restorePro()).rejects.toThrow('not implemented')
  })

  it('rejects when the store cannot say, rather than take it for not owned', async () => {
    native.error = new Error('The network is offline')
    await expect(new NativeUnlockBackend().ownsPro()).rejects.toThrow('offline')
  })
})

describe('deviceUnlock', () => {
  it('uses the plugin in the native shells and the web backend in a browser', () => {
    expect(deviceUnlock()).toBeInstanceOf(WebUnlockBackend)
    native.isNative = true
    expect(deviceUnlock()).toBeInstanceOf(NativeUnlockBackend)
  })
})
