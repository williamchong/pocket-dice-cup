import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { D6_EDGE_RADIUS, D6_FACES, D6_SIZE } from '../dice/d6'

const TEXTURE_SIZE = 256
const BODY_COLOUR = '#f4efe3'
const PIP_COLOUR = '#1b1b1f'

/** Pip centres per value, on a 3×3 grid addressed as [column, row]. */
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

function pipTexture(value: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')!
  context.fillStyle = BODY_COLOUR
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  context.fillStyle = PIP_COLOUR
  for (const [column, row] of PIP_LAYOUTS[value]!) {
    context.beginPath()
    context.arc(TEXTURE_SIZE * (0.27 + 0.23 * column), TEXTURE_SIZE * (0.27 + 0.23 * row), TEXTURE_SIZE * 0.085, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createD6Mesh(): Mesh {
  const geometry = new RoundedBoxGeometry(D6_SIZE, D6_SIZE, D6_SIZE, 4, D6_EDGE_RADIUS)
  // D6_FACES is in BoxGeometry's group order, so face i gets material i.
  const materials = D6_FACES.map(face => new MeshStandardMaterial({
    map: pipTexture(face.value),
    roughness: 0.35,
  }))
  const mesh = new Mesh(geometry, materials)
  mesh.castShadow = true
  return mesh
}
