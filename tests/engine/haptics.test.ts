import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceHaptics, NativeBackend, VibrateBackend } from '../../app/engine/feedback/haptics'

const native = vi.hoisted(() => ({ isNative: false, pluginName: '', playTransient: vi.fn() }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative },
  registerPlugin: (name: string) => {
    native.pluginName = name
    return { playTransient: native.playTransient }
  },
}))

afterEach(() => {
  native.isNative = false
  native.playTransient.mockClear()
  vi.unstubAllGlobals()
})

describe('deviceHaptics', () => {
  it('uses Core Haptics in the iOS app, even where the WebView has navigator.vibrate', () => {
    native.isNative = true
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
    expect(deviceHaptics()).toBeInstanceOf(NativeBackend)
  })

  it('uses navigator.vibrate in a browser that has it', () => {
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
    expect(deviceHaptics()).toBeInstanceOf(VibrateBackend)
  })

  it('has nothing in a browser without vibration, as on iOS', () => {
    vi.stubGlobal('navigator', {})
    expect(deviceHaptics()).toBeNull()
  })
})

describe('NativeBackend', () => {
  it('talks to the plugin by the jsName the Swift side registers', () => {
    expect(native.pluginName).toBe('CoreHaptics')
  })

  it('passes the intensity and the sharpness to the plugin', () => {
    new NativeBackend().playTransient(0.5, 0.8)
    expect(native.playTransient).toHaveBeenCalledWith({ intensity: 0.5, sharpness: 0.8 })
  })
})
