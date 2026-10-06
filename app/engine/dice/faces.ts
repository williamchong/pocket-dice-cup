import { dot, rotate, type Quat, type Vec3 } from '../math'
import type { DieShape } from './shapes'

export interface DieFace {
  /** Outward normal of the face in the die's local frame. */
  normal: Vec3
  value: number
}

/** The box's z axis points out of the screen, so the face seen by the viewer faces +z. */
const TOWARDS_VIEWER: Vec3 = { x: 0, y: 0, z: 1 }
export const TOWARDS_FLOOR: Vec3 = { x: 0, y: 0, z: -1 }

/** The face that points most directly along `direction`, and how directly: 1 for a die lying flat. */
export function faceTowards(faces: readonly DieFace[], rotation: Quat, direction: Vec3): { face: DieFace, alignment: number } {
  let face = faces[0]!
  let alignment = -Infinity
  for (const candidate of faces) {
    const candidateAlignment = dot(rotate(candidate.normal, rotation), direction)
    if (candidateAlignment > alignment) {
      alignment = candidateAlignment
      face = candidate
    }
  }
  return { face, alignment }
}

/** The face that counts on a die of `shape`: the top one, or for a d4 the one it lies on. */
export function readFace(shape: DieShape, rotation: Quat): { face: DieFace, alignment: number } {
  return faceTowards(shape.faces, rotation, shape.reads === 'down' ? TOWARDS_FLOOR : TOWARDS_VIEWER)
}
