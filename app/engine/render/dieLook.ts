import { InstancedMesh, MeshPhysicalMaterial, type BufferGeometry, type Texture } from 'three'

/** Ivory rather than pure white, which blows out under the lamp. */
export const BODY_COLOUR = '#e9e2d0'
/** The pips and the numbers. */
export const INK_COLOUR = '#17171b'

/** What every die of a kind is drawn with, made once and shared, so more dice do not mean more textures. */
export interface DieLook {
  geometry: BufferGeometry
  materials: MeshPhysicalMaterial[]
}

/** Glossy resin, with `bumpMap` dark where the markings are cut in. */
export function dieMaterial(map: Texture, bumpMap: Texture): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 3,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  })
}

/**
 * Up to `capacity` dice of one kind drawn as one instanced mesh, so each
 * material is one draw call however many dice there are. None are drawn
 * until `count` is set.
 */
export function createDiceMesh({ geometry, materials }: DieLook, capacity: number): InstancedMesh {
  const mesh = new InstancedMesh(geometry, materials, capacity)
  mesh.count = 0
  mesh.castShadow = true
  // Its bounds are not kept up as the dice move, and the camera sees the whole cup anyway.
  mesh.frustumCulled = false
  return mesh
}
