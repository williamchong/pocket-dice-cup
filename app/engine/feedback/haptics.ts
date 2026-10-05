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

/**
 * The vibration this browser can play, or null where it has none: every
 * browser on iOS, which is WebKit, and desktops.
 */
export function browserHaptics(): HapticsBackend | null {
  return typeof navigator.vibrate === 'function' ? new VibrateBackend() : null
}
