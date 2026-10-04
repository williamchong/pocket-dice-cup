import type { Vec3 } from '../math'
import type { MotionPermission, MotionSource } from './motionSource'

/** Long enough for the dice to tumble, short enough to feel like a flick. */
export const BURST_SECONDS = 0.8

/**
 * What a hard shake adds to the reading `t` seconds into a burst: several g on
 * every axis at different frequencies. `seed` shifts the phases so each burst
 * tumbles the dice differently.
 */
export function shakeBurst(t: number, seed: number): Vec3 {
  return {
    x: 30 * Math.sin(2 * Math.PI * 4.1 * t + seed),
    y: 45 * Math.sin(2 * Math.PI * 5.3 * t + 2 * seed),
    z: 25 * Math.sin(2 * Math.PI * 3.7 * t + 3 * seed),
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
    const burst = shakeBurst(t, this.seed)
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

  shake(): void {
    this.burstStartMs = this.now()
    this.seed = Math.random() * 2 * Math.PI
  }
}
