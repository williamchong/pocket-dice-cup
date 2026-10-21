import { Color, InstancedMesh, MeshPhysicalMaterial, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three'
import type { DieSkin } from './skins'

/** What every die of a kind is drawn with, made once and shared, so more dice do not mean more textures. */
export interface DieLook {
  geometry: BufferGeometry
  materials: MeshPhysicalMaterial[]
}

/**
 * How far light goes through a translucent die, in cm: about the middle of a
 * 1.6 cm d6, so the light seen through a face has crossed most of the die.
 * One value serves every kind, as they are all about that size.
 */
const THICKNESS = 1.2
/** How far light goes through the body before it has deepened to the skin's tint, in cm. */
const TINT_DISTANCE = 1.5

/**
 * The skin's finish, with `bumpMap` dark where the markings are cut in. A
 * translucent skin also paints `inkMask`, white on the body and black on the
 * markings, so the light passes through the plastic but not the ink.
 */
export function dieMaterial(map: Texture, bumpMap: Texture, { roughness, metalness, clearcoat, transmission, tint }: DieSkin, inkMask: () => Texture): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 3,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: 0.08,
    ...transmission && {
      transmission,
      transmissionMap: inkMask(),
      thickness: THICKNESS,
      attenuationColor: new Color(tint),
      attenuationDistance: TINT_DISTANCE,
    },
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

/** Frees a mesh's geometry and materials, and the textures the materials draw with. */
export function disposeLook({ geometry, materials }: { geometry: BufferGeometry, materials: readonly Material[] }): void {
  geometry.dispose()
  for (const material of new Set(materials)) {
    if (material instanceof MeshStandardMaterial) {
      material.map?.dispose()
      material.bumpMap?.dispose()
      if (material instanceof MeshPhysicalMaterial) material.transmissionMap?.dispose()
    }
    material.dispose()
  }
}
