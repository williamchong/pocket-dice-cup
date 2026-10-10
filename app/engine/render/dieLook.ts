import { InstancedMesh, MeshPhysicalMaterial, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three'
import type { DieSkin } from './skins'

/** What every die of a kind is drawn with, made once and shared, so more dice do not mean more textures. */
export interface DieLook {
  geometry: BufferGeometry
  materials: MeshPhysicalMaterial[]
}

/** The skin's finish, with `bumpMap` dark where the markings are cut in. */
export function dieMaterial(map: Texture, bumpMap: Texture, { roughness, metalness, clearcoat }: DieSkin): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 3,
    roughness,
    metalness,
    clearcoat,
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

/** Frees a mesh's geometry and materials, and the textures the materials draw with. */
export function disposeLook({ geometry, materials }: { geometry: BufferGeometry, materials: readonly Material[] }): void {
  geometry.dispose()
  for (const material of new Set(materials)) {
    if (material instanceof MeshStandardMaterial) {
      material.map?.dispose()
      material.bumpMap?.dispose()
    }
    material.dispose()
  }
}
