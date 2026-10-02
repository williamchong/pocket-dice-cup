export interface Vec3 { x: number, y: number, z: number }
export interface Quat { x: number, y: number, z: number, w: number }

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Rotates `v` by the unit quaternion `q`. */
export function rotate(v: Vec3, q: Quat): Vec3 {
  // v + 2w(u × v) + 2u × (u × v), with u the vector part of q.
  const cx = q.y * v.z - q.z * v.y
  const cy = q.z * v.x - q.x * v.z
  const cz = q.x * v.y - q.y * v.x
  return {
    x: v.x + 2 * (q.w * cx + q.y * cz - q.z * cy),
    y: v.y + 2 * (q.w * cy + q.z * cx - q.x * cz),
    z: v.z + 2 * (q.w * cz + q.x * cy - q.y * cx),
  }
}
