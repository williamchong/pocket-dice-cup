import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HapticsBackend } from './cupFeedback'

/**
 * Pulse lengths (ms) for the softest and the hardest hit. `navigator.vibrate`
 * has no amplitude, so a harder hit buzzes longer instead; shorter than about
 * 8 ms many motors do not spin up at all. The longest stays under the gap
 * CupFeedback leaves between pulses, since a new pulse cuts off the last.
 */
const SHORTEST_PULSE_MS = 8
const LONGEST_PULSE_MS = 30

/**
 * Vibration through `navigator.vibrate`: Chrome, Edge and Samsung Internet on
 * Android. Written from the spec; no Android device has tried it yet.
 */
export class VibrateBackend implements HapticsBackend {
  // No sharpness: navigator.vibrate only turns the motor on and off.
  playTransient(intensity: number): void {
    navigator.vibrate(Math.round(SHORTEST_PULSE_MS + intensity * (LONGEST_PULSE_MS - SHORTEST_PULSE_MS)))
  }
}

/** The custom Core Haptics plugin in the iOS shell (ios/App/App/CoreHapticsPlugin.swift). */
interface CoreHapticsPlugin {
  playTransient(options: { intensity: number, sharpness: number }): Promise<unknown>
}

const CoreHaptics = registerPlugin<CoreHapticsPlugin>('CoreHaptics')

/**
 * Taps from the Taptic Engine through Core Haptics, in the iOS app. The call
 * goes out without waiting for a reply, so the frame is not held up.
 */
export class NativeBackend implements HapticsBackend {
  playTransient(intensity: number, sharpness: number): void {
    void CoreHaptics.playTransient({ intensity, sharpness })
  }
}

/**
 * The vibration this device can play, or null where it has none: every
 * browser on iOS, which is WebKit, and desktops. The iOS app has Core Haptics.
 */
export function deviceHaptics(): HapticsBackend | null {
  if (Capacitor.isNativePlatform()) return new NativeBackend()
  return typeof navigator.vibrate === 'function' ? new VibrateBackend() : null
}
