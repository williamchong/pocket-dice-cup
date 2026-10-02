import { distance, type Vec3 } from '../math'

/** Agitation above this (m/s²) counts as shaking. Picking the phone up stays well below it. */
const SHAKE_THRESHOLD = 8
/** Agitation below this (m/s²) counts as still. Sensor noise and a steady hand stay below it. */
const STILL_THRESHOLD = 1
/** How long the device has to stay still before it counts as put down. */
const STILL_DURATION_MS = 300
/** Screen-up means the screen normal is within about 45° of straight up (9.81 × cos 45°). */
const FACE_UP_MIN_Z = 7

/** Time constant of the low-pass filter that estimates steady gravity. */
const GRAVITY_TAU_S = 0.3
/** How fast agitation decays after the last jolt, so gaps between shakes do not read as still. */
const AGITATION_TAU_S = 0.15

/**
 * Turns raw accelerometer samples into the two facts the state machine needs:
 * "is it being shaken" and "has it been put down screen-up".
 *
 * Samples are `accelerationIncludingGravity` in the W3C sign convention, where
 * a device lying screen-up reads z = +9.81.
 */
export class MotionAnalyser {
  /** Peak-hold envelope of how far samples stray from steady gravity, in m/s². */
  agitation = 0

  private gravity: Vec3 | null = null
  private lastTimeMs = 0
  private stillSinceMs: number | null = null

  update(sample: Vec3, timeMs: number): void {
    if (!this.gravity) {
      this.gravity = { ...sample }
      this.lastTimeMs = timeMs
      return
    }
    const dt = Math.max(0, timeMs - this.lastTimeMs) / 1000
    this.lastTimeMs = timeMs

    const deviation = distance(sample, this.gravity)
    this.agitation = Math.max(deviation, this.agitation * Math.exp(-dt / AGITATION_TAU_S))

    const blend = 1 - Math.exp(-dt / GRAVITY_TAU_S)
    this.gravity.x += (sample.x - this.gravity.x) * blend
    this.gravity.y += (sample.y - this.gravity.y) * blend
    this.gravity.z += (sample.z - this.gravity.z) * blend

    if (this.agitation >= STILL_THRESHOLD) this.stillSinceMs = null
    else this.stillSinceMs ??= timeMs
  }

  get shaking(): boolean {
    return this.agitation > SHAKE_THRESHOLD
  }

  get restingFaceUp(): boolean {
    return this.gravity !== null
      && this.stillSinceMs !== null
      && this.lastTimeMs - this.stillSinceMs >= STILL_DURATION_MS
      && this.gravity.z > FACE_UP_MIN_Z
  }
}
