import { centroid, cross, dot, length, normalise, scale, subtract, type Vec3 } from '../math'
import { D6_EDGE_RADIUS, D6_FACES, D6_SIZE } from './d6'
import type { DieFace } from './faces'

/** Every kind of die, smallest first, which is also the order a pool lists them in. */
export const DIE_KINDS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const
export type DieKind = typeof DIE_KINDS[number]

export function isDieKind(value: unknown): value is DieKind {
  return (DIE_KINDS as readonly unknown[]).includes(value)
}

/** Orders kinds smallest first, for sort. */
export function compareKinds(a: DieKind, b: DieKind): number {
  return DIE_KINDS.indexOf(a) - DIE_KINDS.indexOf(b)
}

/** The die's collider, as data, so this module stays free of Rapier. */
export type DieCollider =
  | { type: 'roundCuboid', halfExtent: number, radius: number }
  /** `points` are pulled in by `radius`, so the rounded hull is the die's true size. */
  | { type: 'roundConvexHull', points: readonly Vec3[], radius: number }

/** Which way the face that counts points at rest: up at the viewer, or down at the floor, as on a d4. */
export type ReadDirection = 'up' | 'down'

export interface DieShape {
  kind: DieKind
  faces: readonly DieFace[]
  reads: ReadDirection
  /** From the centre to a face, so the height of the centre of a die lying on one. */
  inradius: number
  /** Radius of the circle on the floor that a die lying on a face fits in, at any turn. */
  footprintRadius: number
  /** How tall it stands lying on a face. */
  height: number
  collider: DieCollider
}

export interface PolyhedronFace extends DieFace {
  /** Indices into the shape's vertices, anticlockwise seen from outside. */
  corners: readonly number[]
}

/** Any die but the d6, which is a rounded box: flat faces and sharp edges, read from its vertices. */
export interface PolyhedronShape extends DieShape {
  vertices: readonly Vec3[]
  faces: readonly PolyhedronFace[]
}

/** Radius (cm) of the collider's rounded edges, which lets a die roll off an edge rather than catch on it. */
const POLYHEDRON_EDGE_RADIUS = 0.05
const EPSILON = 1e-6
const PHI = (1 + Math.sqrt(5)) / 2

const D6: DieShape = {
  kind: 'd6',
  faces: D6_FACES,
  reads: 'up',
  inradius: D6_SIZE / 2,
  // Half the diagonal of a face, less what the rounding takes off the corner.
  footprintRadius: (D6_SIZE / 2 - D6_EDGE_RADIUS) * Math.SQRT2 + D6_EDGE_RADIUS,
  height: D6_SIZE,
  collider: { type: 'roundCuboid', halfExtent: D6_SIZE / 2 - D6_EDGE_RADIUS, radius: D6_EDGE_RADIUS },
}

/** Every combination of signs of `v`'s non-zero parts. */
function signs({ x, y, z }: Vec3): Vec3[] {
  const points: Vec3[] = []
  for (const sx of x ? [1, -1] : [1]) {
    for (const sy of y ? [1, -1] : [1]) {
      for (const sz of z ? [1, -1] : [1]) points.push({ x: sx * x, y: sy * y, z: sz * z })
    }
  }
  return points
}

/** `v` and its two cyclic shifts, with every combination of signs. */
function cyclic(v: Vec3): Vec3[] {
  return [v, { x: v.z, y: v.x, z: v.y }, { x: v.y, y: v.z, z: v.x }].flatMap(signs)
}

/**
 * The pentagonal trapezohedron: two poles, and a ring of ten corners each a
 * little above or below the equator in turn. Its kites are flat only with the
 * poles at δ(1 + cos 36°)/(1 − cos 36°), from the middle of a kite seen edge on.
 */
function trapezohedron(): Vec3[] {
  const offset = 0.1
  const cosine = Math.cos(Math.PI / 5)
  const pole = offset * (1 + cosine) / (1 - cosine)
  const ring = Array.from({ length: 10 }, (_, k) => ({
    x: Math.cos(k * Math.PI / 5),
    y: Math.sin(k * Math.PI / 5),
    z: k % 2 ? -offset : offset,
  }))
  return [{ x: 0, y: 0, z: pole }, { x: 0, y: 0, z: -pole }, ...ring]
}

/**
 * The faces of the convex hull of `points`: each plane through three of them
 * with all the rest on one side, its outward normal and its corners. Slow,
 * but only run once per kind of die on 20 points at most.
 */
export function hullFaces(points: readonly Vec3[]): { normal: Vec3, corners: number[] }[] {
  const faces: { normal: Vec3, corners: number[] }[] = []
  points.forEach((a, i) => points.forEach((b, j) => points.forEach((c, k) => {
    if (!(i < j && j < k)) return
    const perpendicular = cross(subtract(b, a), subtract(c, a))
    if (length(perpendicular) < EPSILON) return
    let normal = normalise(perpendicular)
    const offsets = points.map(p => dot(normal, subtract(p, a)))
    if (offsets.some(offset => offset > EPSILON)) {
      if (offsets.some(offset => offset < -EPSILON)) return
      normal = scale(normal, -1)
    }
    if (faces.some(face => dot(face.normal, normal) > 1 - EPSILON)) return
    const distance = dot(normal, a)
    const corners = points.flatMap((p, index) => Math.abs(dot(normal, p) - distance) < EPSILON ? [index] : [])
    // Anticlockwise about the normal, from the first corner.
    const centre = centroid(corners.map(index => points[index]!))
    const u = normalise(subtract(points[corners[0]!]!, centre))
    const w = cross(normal, u)
    const angle = (index: number) => {
      const offset = subtract(points[index]!, centre)
      return (Math.atan2(dot(offset, w), dot(offset, u)) + 2 * Math.PI) % (2 * Math.PI)
    }
    corners.sort((p, q) => angle(p) - angle(q))
    faces.push({ normal, corners })
  })))
  // A fixed order, from the top down and round, so the numbering is the same every load.
  return faces.sort((p, q) => q.normal.z - p.normal.z || Math.atan2(p.normal.y, p.normal.x) - Math.atan2(q.normal.y, q.normal.x))
}

/**
 * Numbers the faces so that each of `pairs` sits on opposite faces, as on
 * real dice, going from the top face down. Without pairs (a d4, which has no
 * opposite faces), it numbers them 1 up.
 */
function numberFaces(normals: readonly Vec3[], pairs: readonly [number, number][]): number[] {
  if (pairs.length === 0) return normals.map((_, index) => index + 1)
  const values: number[] = Array.from({ length: normals.length }, () => 0)
  let next = 0
  normals.forEach((normal, index) => {
    if (values[index]) return
    const opposite = normals.findIndex(other => dot(other, normal) < -1 + EPSILON)
    const [value, oppositeValue] = pairs[next++]!
    values[index] = value
    values[opposite] = oppositeValue
  })
  return values
}

/** The pairs (1, n), (2, n − 1) and so on, that put n + 1 on every two opposite faces. */
function sumPairs(sides: number): [number, number][] {
  return Array.from({ length: sides / 2 }, (_, k) => [k + 1, sides - k])
}

/**
 * A die with flat faces: the hull of `points`, scaled to stand `height` tall
 * lying on a face, and numbered by `pairs` (see numberFaces).
 */
function polyhedron(kind: DieKind, points: readonly Vec3[], height: number, pairs: readonly [number, number][], reads: ReadDirection = 'up'): PolyhedronShape {
  const hull = hullFaces(points)
  // Every face is the same distance from the centre on these dice, so any one measures them.
  const { normal, corners } = hull[0]!
  const rawInradius = dot(normal, points[corners[0]!]!)
  const rawHeight = rawInradius + Math.max(...points.map(p => -dot(normal, p)))
  const vertices = points.map(p => scale(p, height / rawHeight))
  const inradius = rawInradius * height / rawHeight
  const values = numberFaces(hull.map(face => face.normal), pairs)
  return {
    kind,
    vertices,
    faces: hull.map((face, index) => ({ normal: face.normal, corners: face.corners, value: values[index]! })),
    reads,
    inradius,
    // How far any corner reaches out across the face it lies on.
    footprintRadius: Math.max(...vertices.map(p => length(subtract(p, scale(normal, dot(normal, p)))))),
    height,
    collider: {
      type: 'roundConvexHull',
      points: vertices.map(p => scale(p, 1 - POLYHEDRON_EDGE_RADIUS / inradius)),
      radius: POLYHEDRON_EDGE_RADIUS,
    },
  }
}

/**
 * Sizes (cm) are a standard 16 mm set's scaled to the 12 mm d6, measured as
 * the die lies: a d20 15 mm across its faces, a d4 12 mm tall.
 */
export const POLYHEDRA = {
  // A d4 reads the face it lies on, printed at the corner opposite it, on top.
  d4: polyhedron('d4', signs({ x: 1, y: 1, z: 1 }).filter(({ x, y, z }) => x * y * z > 0), 1.2, [], 'down'),
  d8: polyhedron('d8', cyclic({ x: 1, y: 0, z: 0 }), 1.15, sumPairs(8)),
  // Printed 0 to 9, opposite faces adding to 9, with the 0 read as 10.
  d10: polyhedron('d10', trapezohedron(), 1.2, [[10, 9], [1, 8], [2, 7], [3, 6], [4, 5]]),
  d12: polyhedron('d12', [...signs({ x: 1, y: 1, z: 1 }), ...cyclic({ x: 0, y: 1 / PHI, z: PHI })], 1.35, sumPairs(12)),
  d20: polyhedron('d20', cyclic({ x: 0, y: 1, z: PHI }), 1.5, sumPairs(20)),
} satisfies Record<Exclude<DieKind, 'd6'>, PolyhedronShape>

export const DIE_SHAPES: Readonly<Record<DieKind, DieShape>> = { d6: D6, ...POLYHEDRA }

/**
 * A face's middle, and its furthest corner, which its number stands upright
 * towards: a d10's pole, or any corner of a regular face.
 */
export function faceTop(shape: PolyhedronShape, face: PolyhedronFace): { centre: Vec3, far: Vec3 } {
  const corners = face.corners.map(corner => shape.vertices[corner]!)
  const centre = centroid(corners)
  const far = corners.reduce((best, corner) => length(subtract(corner, centre)) > length(subtract(best, centre)) + 1e-9 ? corner : best)
  return { centre, far }
}

/** What is printed for `value`: a d10's 10 is printed 0. */
export function faceLabel(kind: DieKind, value: number): string {
  return kind === 'd10' ? String(value % 10) : String(value)
}
