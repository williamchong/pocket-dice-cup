import type { Vec3 } from '../../app/engine/math'

/**
 * A vigorous shake on top of the phone being held roughly upright: several g
 * on every axis at different frequencies, with `seed` shifting the phases.
 */
export function shake(t: number, seed: number): Vec3 {
  return {
    x: 30 * Math.sin(2 * Math.PI * 4.1 * t + seed),
    y: 9.8 + 45 * Math.sin(2 * Math.PI * 5.3 * t + 2 * seed),
    z: 25 * Math.sin(2 * Math.PI * 3.7 * t + 3 * seed),
  }
}
