import { CanvasTexture, SRGBColorSpace } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { D6_EDGE_RADIUS, D6_FACES, D6_SIZE } from '../dice/d6'
import { BODY_COLOUR, dieMaterial, INK_COLOUR, type DieLook } from './dieLook'

const TEXTURE_SIZE = 256
const PIP_RADIUS = TEXTURE_SIZE * 0.085

/** Pip centres per value, on a 3×3 grid addressed as [column, row]. */
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

/** Paints one face: `background` everywhere, then `paintPip` at each pip centre. */
function faceTexture(
  value: number,
  background: string,
  paintPip: (context: CanvasRenderingContext2D, x: number, y: number) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')!
  context.fillStyle = background
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  for (const [column, row] of PIP_LAYOUTS[value]!) {
    paintPip(context, TEXTURE_SIZE * (0.27 + 0.23 * column), TEXTURE_SIZE * (0.27 + 0.23 * row))
  }
  const texture = new CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

function colourTexture(value: number): CanvasTexture {
  const texture = faceTexture(value, BODY_COLOUR, (context, x, y) => {
    context.fillStyle = INK_COLOUR
    context.beginPath()
    context.arc(x, y, PIP_RADIUS, 0, Math.PI * 2)
    context.fill()
  })
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A height map: flat white, dipping to black inside each pip so it catches the light like a drilled hole. */
function bumpTexture(value: number): CanvasTexture {
  return faceTexture(value, '#fff', (context, x, y) => {
    const dip = context.createRadialGradient(x, y, PIP_RADIUS * 0.55, x, y, PIP_RADIUS * 1.1)
    dip.addColorStop(0, '#000')
    dip.addColorStop(1, '#fff')
    context.fillStyle = dip
    context.beginPath()
    context.arc(x, y, PIP_RADIUS * 1.1, 0, Math.PI * 2)
    context.fill()
  })
}

export function createD6Look(): DieLook {
  const geometry = new RoundedBoxGeometry(D6_SIZE, D6_SIZE, D6_SIZE, 4, D6_EDGE_RADIUS)
  // D6_FACES is in BoxGeometry's group order, so face i gets material i.
  const materials = D6_FACES.map(face => dieMaterial(colourTexture(face.value), bumpTexture(face.value)))
  return { geometry, materials }
}
