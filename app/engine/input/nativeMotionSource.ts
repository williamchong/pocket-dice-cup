import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { Vec3 } from '../math'
import { DeviceMotionSource, REST_ACCELERATION, type MotionPermission, type MotionSource } from './motionSource'

/** Standard gravity: Core Motion reads in g, the engine in m/s². */
const G = REST_ACCELERATION.z

/**
 * The motion plugin in the iOS app (ios/App/App/CupMotionPlugin.swift). Each
 * reading is Core Motion's gravity plus the hand's acceleration, in g.
 */
interface CupMotionPlugin {
  start(): Promise<void>
  stop(): Promise<void>
  addListener(event: 'reading', listener: (reading: Vec3) => void): Promise<PluginListenerHandle>
}

const CupMotion = registerPlugin<CupMotionPlugin>('CupMotion')

/**
 * Core Motion's reading in the engine's terms: m/s², and the W3C sign, where
 * lying screen-up reads z = +9.81. Core Motion reads -1 g there, as Safari's
 * DeviceMotionEvent does, which DeviceMotionSource flips the same way.
 */
export function fromCoreMotion({ x, y, z }: Vec3): Vec3 {
  return { x: -x * G, y: -y * G, z: -z * G }
}

/**
 * The sensor read natively in the iOS app. WebKit only gives a page motion
 * access from a tap, so through the WebView the app opened on a "tap to
 * begin" screen; Core Motion needs no permission, and the cup senses a shake
 * from launch.
 */
export class NativeMotionSource implements MotionSource {
  acceleration: Vec3 = { ...REST_ACCELERATION }
  active = false
  readonly name = 'CoreMotion'
  onReading: (() => void) | null = null

  private listener: Promise<PluginListenerHandle> | null = null

  async start(): Promise<MotionPermission> {
    this.listener ??= CupMotion.addListener('reading', (reading) => {
      this.acceleration = fromCoreMotion(reading)
      this.active = true
      this.onReading?.()
    })
    try {
      await CupMotion.start()
      return 'granted'
    }
    catch {
      this.stop()
      return 'unsupported'
    }
  }

  stop(): void {
    // Also called after a failed start, where the plugin may not answer at all.
    this.listener?.then(handle => handle.remove()).catch(() => {})
    this.listener = null
    CupMotion.stop().catch(() => {})
  }
}

/** Core Motion in the iOS app; DeviceMotionEvent everywhere else, the Android app included. */
export function deviceMotionSource(): MotionSource {
  return Capacitor.getPlatform() === 'ios' ? new NativeMotionSource() : new DeviceMotionSource()
}
