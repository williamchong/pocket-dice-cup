import { dot, length, type Vec3 } from '../math'

/**
 * Agitation above this (m/s²) counts as shaking. On an iPhone, a hard shake
 * goes past 30, while picking the phone up and a gentle shake both peak near
 * 12, so those two are told apart by swings instead.
 */
const SHAKE_THRESHOLD = 15
/**
 * A swing is a burst of motion stronger than this (m/s²). Its direction is the
 * motion at the burst's peak.
 */
const SWING_MIN = 7
/**
 * This many reversals (swings against the previous one) within the window count
 * as shaking. A gentle shake reverses 4-7 times a second, a pickup once: a
 * lift, then a stop.
 */
const REVERSALS_TO_SHAKE = 3
/** How far back reversals count towards a shake. */
const REVERSAL_WINDOW_MS = 1000
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
  private swingPeak: Vec3 | null = null
  /** Only the direction of the last swing matters: a reversal is a swing against it. */
  private lastSwing: Vec3 | null = null
  /** Oldest first, so expired entries come off the front. */
  private reversalTimesMs: number[] = []

  update(sample: Vec3, timeMs: number): void {
    if (!this.gravity) {
      this.gravity = { ...sample }
      this.lastTimeMs = timeMs
      return
    }
    const dt = Math.max(0, timeMs - this.lastTimeMs) / 1000
    this.lastTimeMs = timeMs

    const motion = {
      x: sample.x - this.gravity.x,
      y: sample.y - this.gravity.y,
      z: sample.z - this.gravity.z,
    }
    const deviation = length(motion)
    this.trackSwings(motion, deviation, timeMs)
    this.agitation = Math.max(deviation, this.agitation * Math.exp(-dt / AGITATION_TAU_S))

    const blend = 1 - Math.exp(-dt / GRAVITY_TAU_S)
    this.gravity.x += (sample.x - this.gravity.x) * blend
    this.gravity.y += (sample.y - this.gravity.y) * blend
    this.gravity.z += (sample.z - this.gravity.z) * blend

    if (this.agitation >= STILL_THRESHOLD) this.stillSinceMs = null
    else this.stillSinceMs ??= timeMs
  }

  private trackSwings(motion: Vec3, deviation: number, timeMs: number): void {
    if (deviation > SWING_MIN) {
      if (!this.swingPeak || deviation > length(this.swingPeak)) this.swingPeak = motion
    }
    else if (this.swingPeak) {
      const reversed = this.lastSwing && dot(this.swingPeak, this.lastSwing) < 0
      if (reversed) this.reversalTimesMs.push(timeMs)
      this.lastSwing = this.swingPeak
      this.swingPeak = null
    }
    while (this.reversalTimesMs[0] !== undefined && this.reversalTimesMs[0] <= timeMs - REVERSAL_WINDOW_MS) {
      this.reversalTimesMs.shift()
    }
  }

  get shaking(): boolean {
    return this.agitation > SHAKE_THRESHOLD || this.reversalTimesMs.length >= REVERSALS_TO_SHAKE
  }

  get restingFaceUp(): boolean {
    return this.gravity !== null
      && this.stillSinceMs !== null
      && this.lastTimeMs - this.stillSinceMs >= STILL_DURATION_MS
      && this.gravity.z > FACE_UP_MIN_Z
  }
}
