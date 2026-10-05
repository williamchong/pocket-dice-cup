import type { DieFace } from './faces'

/**
 * Edge length in world units (centimetres): a 12 mm die, the size of most
 * game dice. At 16 mm a dozen of them covered 40% of a phone's floor and
 * jammed against the walls: on recorded iPhone shakes they moved at half the
 * speed of a lone die and mostly kept their faces.
 */
export const D6_SIZE = 1.2
/** Radius of the rounded edges, shared by the collider and the mesh. */
export const D6_EDGE_RADIUS = D6_SIZE / 10

/**
 * Opposite faces sum to 7. The order is three.js's BoxGeometry face order
 * (+x, -x, +y, -y, +z, -z), so index i here is material group i on the mesh.
 */
export const D6_FACES: readonly DieFace[] = [
  { normal: { x: 1, y: 0, z: 0 }, value: 1 },
  { normal: { x: -1, y: 0, z: 0 }, value: 6 },
  { normal: { x: 0, y: 1, z: 0 }, value: 2 },
  { normal: { x: 0, y: -1, z: 0 }, value: 5 },
  { normal: { x: 0, y: 0, z: 1 }, value: 3 },
  { normal: { x: 0, y: 0, z: -1 }, value: 4 },
]
