import { dot, rotate, type Quat, type Vec3 } from '../math'

export interface DieFace {
  /** Outward normal of the face in the die's local frame. */
  normal: Vec3
  value: number
}

/** The box's z axis points out of the screen, so the face seen by the viewer faces +z. */
const TOWARDS_VIEWER: Vec3 = { x: 0, y: 0, z: 1 }

/** The value on the face that points most directly at the viewer. */
export function readTopFace(faces: readonly DieFace[], rotation: Quat): number {
  let best = faces[0]!
  let bestAlignment = -Infinity
  for (const face of faces) {
    const alignment = dot(rotate(face.normal, rotation), TOWARDS_VIEWER)
    if (alignment > bestAlignment) {
      bestAlignment = alignment
      best = face
    }
  }
  return best.value
}
