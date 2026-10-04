import type { Vec3 } from '../math'
import type { MotionPermission, MotionSource } from './motionSource'

/** Long enough for the dice to tumble, short enough to feel like a flick. */
export const BURST_SECONDS = 0.9

/** Sideways acceleration of the swirl. Much more and the dice cross a desktop-sized table. */
const SWIRL_ACCELERATION = 3
const SWIRL_HZ = 2
/**
 * Upward acceleration at the top of each hop: enough to lift the dice off the
 * floor, and to read as a shake to the motion analysis.
 */
const HOP_ACCELERATION = 22
const HOPS = 3

/**
 * What a gentle toss adds to the reading `t` seconds into a burst: the cup
 * swirls sideways while it hops a few times, rattling the dice without sending
 * them across the table. Unlike a phone, a desktop shows the dice the whole
 * time, so the motion has to be one a hand could make while watching. `seed`
 * sets the swirl's starting direction.
 */
export function tossBurst(t: number, seed: number): Vec3 {
  // So the toss starts and ends at rest rather than with a jolt.
  const envelope = Math.sin(Math.PI * t / BURST_SECONDS) ** 2
  const swirl = 2 * Math.PI * SWIRL_HZ * t + seed
  const hop = Math.max(0, Math.sin(Math.PI * HOPS * t / BURST_SECONDS)) ** 2
  return {
    x: SWIRL_ACCELERATION * envelope * Math.cos(swirl),
    y: SWIRL_ACCELERATION * envelope * Math.sin(swirl),
    // A lower z is the cup dropping away under the dice: past 1 g they lift
    // off the floor towards the glass.
    z: -HOP_ACCELERATION * hop,
  }
}

/**
 * Adds a synthetic shake to another source's readings for a moment after a
 * click or tap, so the cup can be rolled on a desktop with no motion sensor.
 * The burst goes through the same motion analysis and physics as a real shake.
 */
export class PointerSource implements MotionSource {
  private burstStartMs = -Infinity
  private seed = 0

  /** `now` must share a clock with the frame times the simulation is ticked with. */
  constructor(
    private readonly inner: MotionSource,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get acceleration(): Vec3 {
    const base = this.inner.acceleration
    const t = (this.now() - this.burstStartMs) / 1000
    if (t >= BURST_SECONDS) return base
    const burst = tossBurst(t, this.seed)
    return { x: base.x + burst.x, y: base.y + burst.y, z: base.z + burst.z }
  }

  get active(): boolean {
    return this.inner.active
  }

  start(): Promise<MotionPermission> {
    return this.inner.start()
  }

  stop(): void {
    this.inner.stop()
  }

  /** `seed` picks the toss; tests pass one to make it repeatable. */
  shake(seed = Math.random() * 2 * Math.PI): void {
    this.burstStartMs = this.now()
    this.seed = seed
  }
}
