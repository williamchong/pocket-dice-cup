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

/** The unit quaternion for a turn of `angle` radians about the unit vector `axis`. */
export function axisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2)
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) }
}

/** The rotation `b` followed by the rotation `a`. */
export function multiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor }
}

/** The average of `points`: the middle of a regular polygon's corners. */
export function centroid(points: readonly Vec3[]): Vec3 {
  return scale(points.reduce(add), 1 / points.length)
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

export function normalise(v: Vec3): Vec3 {
  return scale(v, 1 / length(v))
}

/** The shortest rotation that turns the unit vector `from` onto the unit vector `to`. */
export function rotationBetween(from: Vec3, to: Vec3): Quat {
  const cosine = dot(from, to)
  if (cosine < -1 + 1e-9) {
    // Opposite: half a turn about any axis square to `from`.
    const axis = cross(from, Math.abs(from.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 })
    return axisAngle(normalise(axis), Math.PI)
  }
  // Half the angle, from the sum of the identity and the full rotation.
  const { x, y, z } = cross(from, to)
  const w = 1 + cosine
  const norm = Math.hypot(x, y, z, w)
  return { x: x / norm, y: y / norm, z: z / norm, w: w / norm }
}
