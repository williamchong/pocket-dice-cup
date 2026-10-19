import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeviceMotionSource, REST_ACCELERATION } from '../../app/engine/input/motionSource'
import { deviceMotionSource, fromCoreMotion, NativeMotionSource } from '../../app/engine/input/nativeMotionSource'
import type { Vec3 } from '../../app/engine/math'

const native = vi.hoisted(() => ({
  platform: 'web',
  pluginName: '',
  failStart: false,
  listener: null as ((reading: Vec3) => void) | null,
  remove: vi.fn(),
  stop: vi.fn(async () => {}),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform },
  registerPlugin: (name: string) => {
    native.pluginName = name
    return {
      start: async () => {
        if (native.failStart) throw new Error('Device motion is not available')
      },
      stop: native.stop,
      addListener: async (_event: string, listener: (reading: Vec3) => void) => {
        native.listener = listener
        return { remove: native.remove }
      },
    }
  },
}))

afterEach(() => {
  native.platform = 'web'
  native.failStart = false
  native.listener = null
  native.remove.mockClear()
  native.stop.mockClear()
})

describe('fromCoreMotion', () => {
  // Core Motion reads -1 g on z lying screen-up, as Safari's DeviceMotionEvent does.
  it('reads +9.81 on z lying screen-up, as the engine expects', () => {
    expect(fromCoreMotion({ x: 0, y: 0, z: -1 }).z).toBe(REST_ACCELERATION.z)
  })

  it('flips every axis and scales from g', () => {
    const { x, y, z } = fromCoreMotion({ x: 0.5, y: -1, z: 1 })
    expect(x).toBeCloseTo(-4.903, 3)
    expect(y).toBeCloseTo(9.807, 3)
    expect(z).toBeCloseTo(-9.807, 3)
  })
})

describe('deviceMotionSource', () => {
  it('reads Core Motion in the iOS app', () => {
    native.platform = 'ios'
    expect(deviceMotionSource()).toBeInstanceOf(NativeMotionSource)
  })

  it('reads DeviceMotionEvent in a browser and in the Android app', () => {
    expect(deviceMotionSource()).toBeInstanceOf(DeviceMotionSource)
    native.platform = 'android'
    expect(deviceMotionSource()).toBeInstanceOf(DeviceMotionSource)
  })
})

describe('NativeMotionSource', () => {
  it('talks to the plugin by the jsName the iOS shell registers', () => {
    expect(native.pluginName).toBe('CupMotion')
  })

  it('starts without asking, and takes each reading in the engine terms', async () => {
    const source = new NativeMotionSource()
    const onReading = vi.fn()
    source.onReading = onReading
    expect(await source.start()).toBe('granted')
    expect(source.active).toBe(false)
    native.listener!({ x: 0, y: 0, z: -1 })
    expect(source.active).toBe(true)
    expect(source.acceleration.z).toBeCloseTo(REST_ACCELERATION.z)
    expect(onReading).toHaveBeenCalledOnce()
  })

  it('says the sensor is unsupported where the phone has no device motion', async () => {
    native.failStart = true
    const source = new NativeMotionSource()
    expect(await source.start()).toBe('unsupported')
    await vi.waitFor(() => expect(native.remove).toHaveBeenCalledOnce())
  })

  it('lets go of the plugin when stopped', async () => {
    const source = new NativeMotionSource()
    await source.start()
    source.stop()
    expect(native.stop).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(native.remove).toHaveBeenCalledOnce())
  })
})
