import { Color, InstancedMesh, MeshDepthMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three'
import type { DieSkin } from './skins'

/** What every die of a kind is drawn with, made once and shared, so more dice do not mean more textures. */
export interface DieLook {
  geometry: BufferGeometry
  materials: MeshPhysicalMaterial[]
  /** What a translucent die casts its shadow with; an opaque one casts a solid shadow. */
  shadow?: MeshDepthMaterial
}

/**
 * How far light goes through a translucent die, in cm: about the middle of a
 * 1.6 cm d6, so the light seen through a face has crossed most of the die.
 * One value serves every kind, as they are all about that size.
 */
const THICKNESS = 1.2
/**
 * How far light goes through the body before it has deepened to the skin's
 * tint, in cm. three.js already filters the light through the body colour,
 * so the tint only deepens it further where the die is thick. At 1.5 cm the
 * two together darkened the light through a 1.6 cm die so far that the
 * clear dice read as solid; at 6 cm the felt's grain and the battle mat's
 * lines show through.
 */
const TINT_DISTANCE = 6
/**
 * How bright a neon die's markings glow, as a multiple of its glow colour.
 * Over 1, so the tone mapping rolls the glow towards white at its brightest,
 * as a lit tube looks.
 */
const GLOW_INTENSITY = 2.5

/**
 * The skin's finish, with `bumpMap` dark where the markings are cut in. A
 * translucent skin also paints `inkMask`, white on the body and black on the
 * markings, so the light passes through the plastic but not the ink. A
 * glowing skin paints `glowMask`, black on the body and white where it glows.
 */
export function dieMaterial(map: Texture, bumpMap: Texture, { roughness, metalness, clearcoat, transmission, tint, glow }: DieSkin, inkMask: () => Texture, glowMask: () => Texture): MeshPhysicalMaterial {
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
    ...glow && {
      emissive: new Color(glow),
      emissiveMap: glowMask(),
      emissiveIntensity: GLOW_INTENSITY,
    },
  })
}

/**
 * A translucent die's shadow: it leaves out every other texel of the shadow
 * map, in a checkerboard, which the shadow's filtering blurs into a shadow
 * half as dark. A solid shadow lies under the whole die, so the floor seen
 * through it was dark and even, and a clear die read as opaque.
 */
export function translucentShadow(): MeshDepthMaterial {
  const material = new MeshDepthMaterial()
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if ( mod( gl_FragCoord.x + gl_FragCoord.y, 2.0 ) >= 1.0 ) discard;`)
  }
  return material
}

/**
 * Up to `capacity` dice of one kind drawn as one instanced mesh, so each
 * material is one draw call however many dice there are. None are drawn
 * until `count` is set.
 */
export function createDiceMesh({ geometry, materials, shadow }: DieLook, capacity: number): InstancedMesh {
  const mesh = new InstancedMesh(geometry, materials, capacity)
  mesh.count = 0
  mesh.castShadow = true
  mesh.customDepthMaterial = shadow
  // Its bounds are not kept up as the dice move, and the camera sees the whole cup anyway.
  mesh.frustumCulled = false
  return mesh
}

/** Frees a mesh's geometry and materials, and the textures the materials draw with. */
export function disposeLook({ geometry, materials, shadow }: { geometry: BufferGeometry, materials: readonly Material[], shadow?: Material }): void {
  geometry.dispose()
  shadow?.dispose()
  for (const material of new Set(materials)) {
    if (material instanceof MeshStandardMaterial) {
      material.map?.dispose()
      material.bumpMap?.dispose()
      material.emissiveMap?.dispose()
      if (material instanceof MeshPhysicalMaterial) material.transmissionMap?.dispose()
    }
    material.dispose()
  }
}
