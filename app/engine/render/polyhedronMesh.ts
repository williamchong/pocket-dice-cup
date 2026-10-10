import { BufferGeometry, CanvasTexture, Float32BufferAttribute, SRGBColorSpace } from 'three'
import { faceLabel, faceTop, type PolyhedronShape } from '../dice/shapes'
import { cross, dot, length, normalise, subtract, type Vec3 } from '../math'
import { dieMaterial, type DieLook } from './dieLook'
import type { DieSkin } from './skins'

/** Pixels per face in the texture atlas. */
const CELL = 128
/** How much of its cell a face's corners reach, so no face picks up its neighbour's ink. */
const FILL = 0.94
/** A number's font size as a multiple of the radius of the circle that fits in its face. */
const FONT_SCALE = 1.5
/** A d4's corner numbers, smaller, and how far out towards their corner they sit. */
const CORNER_FONT_SCALE = 1.25
const CORNER_REACH = 0.5

/** Where a face sits in the atlas, in the face's plane: its middle, its axes, and its size. */
interface FaceLayout {
  centre: Vec3
  right: Vec3
  up: Vec3
  /** The furthest corner from the middle, which reaches the edge of the cell. */
  radius: number
  column: number
  row: number
}

function layoutFaces(shape: PolyhedronShape): { layouts: FaceLayout[], columns: number, rows: number } {
  const columns = Math.ceil(Math.sqrt(shape.faces.length))
  const rows = Math.ceil(shape.faces.length / columns)
  const layouts = shape.faces.map((face, index) => {
    const { centre, far } = faceTop(shape, face)
    const up = normalise(subtract(far, centre))
    return {
      centre,
      right: cross(up, face.normal),
      up,
      radius: length(subtract(far, centre)),
      column: index % columns,
      row: Math.floor(index / columns),
    }
  })
  return { layouts, columns, rows }
}

/** A point of a face in its cell, in canvas pixels. */
function toCanvas(layout: FaceLayout, point: Vec3): { x: number, y: number } {
  const offset = subtract(point, layout.centre)
  const reach = CELL / 2 * FILL / layout.radius
  return {
    x: (layout.column + 0.5) * CELL + dot(offset, layout.right) * reach,
    y: (layout.row + 0.5) * CELL - dot(offset, layout.up) * reach,
  }
}

/**
 * The faces as flat triangles, each face fanned out from its first corner,
 * with its own normal so the edges stay sharp, and mapped onto its atlas cell.
 */
function polyhedronGeometry(shape: PolyhedronShape, layouts: readonly FaceLayout[], columns: number, rows: number): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  shape.faces.forEach((face, index) => {
    const layout = layouts[index]!
    const corner = (i: number) => {
      const point = shape.vertices[face.corners[i]!]!
      const { x, y } = toCanvas(layout, point)
      positions.push(point.x, point.y, point.z)
      normals.push(face.normal.x, face.normal.y, face.normal.z)
      // The canvas is flipped as it is uploaded, so its top row is v = 1.
      uvs.push(x / (columns * CELL), 1 - y / (rows * CELL))
    }
    for (let i = 1; i < face.corners.length - 1; i++) {
      corner(0)
      corner(i)
      corner(i + 1)
    }
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  // A mesh given a list of materials draws only the groups of its geometry.
  geometry.addGroup(0, positions.length / 3, 0)
  return geometry
}

/** Each face's markings: its number in the middle, or for a d4 a number at each corner. */
function paintAtlas(shape: PolyhedronShape, layouts: readonly FaceLayout[], columns: number, rows: number, background: string, ink: string, blur: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = columns * CELL
  canvas.height = rows * CELL
  const context = canvas.getContext('2d')!
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = context.strokeStyle = ink
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  if (blur) context.filter = `blur(${blur}px)`
  // A 6 and a 9 are told apart by a line under them, on dice that have both.
  const underline = shape.faces.length >= 10

  /** Writes `text` at `at`, `size` px tall, turned so its top points along `towards` on the canvas. */
  const write = (text: string, at: { x: number, y: number }, size: number, towards = { x: 0, y: -1 }) => {
    context.save()
    context.translate(at.x, at.y)
    context.rotate(Math.atan2(towards.x, -towards.y))
    context.font = `600 ${size}px Georgia, 'Times New Roman', serif`
    // Two digits are squeezed to the width one would take.
    const width = context.measureText(text).width
    if (width > size * 0.8) context.scale(size * 0.8 / width, 1)
    context.fillText(text, 0, size * 0.04)
    if (underline && (text === '6' || text === '9')) {
      context.lineWidth = size * 0.07
      context.beginPath()
      context.moveTo(-size * 0.22, size * 0.42)
      context.lineTo(size * 0.22, size * 0.42)
      context.stroke()
    }
    context.restore()
  }

  shape.faces.forEach((face, index) => {
    const layout = layouts[index]!
    const middle = toCanvas(layout, layout.centre)
    const corners = face.corners.map(corner => toCanvas(layout, shape.vertices[corner]!))
    // The radius of the circle that fits in the face: the nearest edge to the middle.
    const inner = Math.min(...corners.map((a, i) => {
      const b = corners[(i + 1) % corners.length]!
      return Math.abs((b.x - a.x) * (a.y - middle.y) - (a.x - middle.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y)
    }))
    if (shape.reads === 'up') {
      write(faceLabel(shape.kind, face.value), middle, inner * FONT_SCALE)
      return
    }
    // A d4 lying on a face shows its value at the top corner, so each corner
    // carries the value of the face opposite it, the one without that corner.
    face.corners.forEach((vertex, i) => {
      const opposite = shape.faces.find(other => !other.corners.includes(vertex))!
      const corner = corners[i]!
      const towards = { x: corner.x - middle.x, y: corner.y - middle.y }
      const at = { x: middle.x + towards.x * CORNER_REACH, y: middle.y + towards.y * CORNER_REACH }
      write(faceLabel(shape.kind, opposite.value), at, inner * CORNER_FONT_SCALE, towards)
    })
  })
  const texture = new CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

/** Every die of one flat-faced kind: one geometry, and one material over an atlas of all its faces. */
export function createPolyhedronLook(shape: PolyhedronShape, skin: DieSkin): DieLook {
  const { layouts, columns, rows } = layoutFaces(shape)
  const colour = paintAtlas(shape, layouts, columns, rows, skin.body, skin.ink, 0)
  colour.colorSpace = SRGBColorSpace
  // A height map: white, dipping to black where the numbers are cut in, softened so they catch the light.
  const bump = paintAtlas(shape, layouts, columns, rows, '#fff', '#000', 1.5)
  return { geometry: polyhedronGeometry(shape, layouts, columns, rows), materials: [dieMaterial(colour, bump, skin)] }
}
