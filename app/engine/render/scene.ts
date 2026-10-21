import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CAMERA_DISTANCE, type BoxSize } from '../box'
import type { DicePool } from '../core/pool'
import { DIE_KINDS, POLYHEDRA, type DieKind } from '../dice/shapes'
import type { Quat, Vec3 } from '../math'
import { createD6Look } from './d6Mesh'
import { createDiceMesh, disposeLook, translucentShadow, type DieLook } from './dieLook'
import { createPolyhedronLook } from './polyhedronMesh'
import type { DieSkin } from './skins'
import type { Table } from '../tables'

/** Phones report 3; the extra pixels cost more than they show at this scale. */
const MAX_PIXEL_RATIO = 2

/** A warm lamp, as over a games table. */
export const LAMP_COLOUR = 0xfff1dc
/**
 * How each floor pattern is drawn: a tile of `size` pixels covering `tile`
 * cm, speckled with greys from `darkest` up by `spread`, so the floor reads
 * as cloth or vinyl rather than flat paint; a grid also has lines along the
 * tile's edges.
 */
const FLOOR_PATTERNS: Record<Table['floor']['pattern'], { size: number, tile: number, darkest: number, spread: number, grid: boolean }> = {
  cloth: { size: 128, tile: 1, darkest: 190, spread: 65, grid: false },
  // A battle mat's squares are an inch, the size its figures stand on, and the cup is drawn at true size.
  grid: { size: 256, tile: 2.54, darkest: 235, spread: 20, grid: true },
}
/**
 * Height (cm) of the marks under dice that did not roll over: on the felt,
 * which is at 0, without fighting it for depth.
 */
const MARK_HEIGHT = 0.01
/** How strong a mark is once faded in, and how far out it reaches from a die's centre, in footprint radii. */
const MARK_OPACITY = 0.35
const MARK_REACH = 1.45
/**
 * Radius (cm) of the cove where the felt curves up into the walls, and of the
 * cup's corners seen from above. The colliders keep the corners square, so a
 * die jammed square into one overlaps the drawn wall by 0.4 times the amount
 * this exceeds its own edge radius, about 1.5 mm. Against a single wall, the
 * die hides the part of the cove it sits in.
 */
const ROUNDING = 0.5
/** Segments in each quarter circle: per corner, and up the cove. */
const CORNER_SEGMENTS = 12
const COVE_SEGMENTS = 8

const UNIT_SCALE = new Vector3(1, 1, 1)

/**
 * The inside of the cup with rounded corners, open at the glass: a floor
 * that curves up into the walls (the walls are material group 0, the floor 1). It is built by
 * sweeping the profile of a wall, from the floor up to the glass, around a
 * rounded rectangle, with normals facing into the cup.
 */
function trayGeometry({ width, height, depth }: BoxSize): BufferGeometry {
  // Up the wall: how far in from it, how high, and the inward and upward
  // parts of the normal. The first point is where the floor ends.
  const profile: { inset: number, z: number, inward: number, up: number }[] = []
  for (let i = 0; i <= COVE_SEGMENTS; i++) {
    const angle = i / COVE_SEGMENTS * Math.PI / 2
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    profile.push({ inset: ROUNDING * (1 - sin), z: ROUNDING * (1 - cos), inward: sin, up: cos })
  }
  profile.push({ inset: 0, z: depth, inward: 1, up: 0 })
  // Around the walls, anticlockwise from above: each corner's centre and the
  // outward direction there. Offsets of a rounded rectangle share the centres.
  const ring: { cx: number, cy: number, ox: number, oy: number }[] = []
  for (const [quarter, sx, sy] of [[0, 1, 1], [1, -1, 1], [2, -1, -1], [3, 1, -1]] as const) {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const angle = (quarter + i / CORNER_SEGMENTS) * Math.PI / 2
      ring.push({ cx: sx * (width / 2 - ROUNDING), cy: sy * (height / 2 - ROUNDING), ox: Math.cos(angle), oy: Math.sin(angle) })
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const addVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z)
    normals.push(nx, ny, nz)
    // In centimetres, laid flat from above, so the floor's pattern keeps its size up the cove.
    uvs.push(x, y)
  }
  for (const { cx, cy, ox, oy } of ring) {
    for (const { inset, z, inward, up } of profile) {
      const r = ROUNDING - inset
      addVertex(cx + r * ox, cy + r * oy, z, -inward * ox, -inward * oy, up)
    }
  }
  const centre = positions.length / 3
  addVertex(0, 0, 0, 0, 0, 1)

  const geometry = new BufferGeometry()
  const felt: number[] = []
  const wall: number[] = []
  const rows = profile.length
  for (let j = 0; j < ring.length; j++) {
    const a = j * rows
    const b = (j + 1) % ring.length * rows
    felt.push(centre, a, b)
    for (let i = 0; i < rows - 1; i++) {
      const group = i < COVE_SEGMENTS ? felt : wall
      group.push(a + i, a + i + 1, b + i, b + i, a + i + 1, b + i + 1)
    }
  }
  geometry.setIndex([...wall, ...felt])
  geometry.addGroup(0, wall.length, 0)
  geometry.addGroup(wall.length, felt.length, 1)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geometry
}

/** The floor's pattern, tiled across it, in shades of grey for the floor's colour to tint. */
function floorTexture(pattern: Table['floor']['pattern']): CanvasTexture {
  const { size, tile, darkest, spread, grid } = FLOOR_PATTERNS[pattern]
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = darkest + Math.random() * spread
    image.data[i] = image.data[i + 1] = image.data[i + 2] = shade
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / tile, 1 / tile)
  if (grid) {
    // A square's edge is split between the tile's first and last pixels, so
    // the tiles join into whole lines about a third of a millimetre wide.
    const half = 2
    context.fillStyle = 'rgb(0 0 0 / 25%)'
    for (const at of [0, size - half]) {
      context.fillRect(at, 0, half, size)
      context.fillRect(0, at, size, half)
    }
    // A square centred in the cup, rather than lines crossing under the middle die.
    texture.offset.set(0.5, 0.5)
  }
  return texture
}

/**
 * A soft ring, as if chalked on the cloth: clear in the middle, where the die
 * stands, palest across its band and fading to nothing at both edges. It fills
 * a square two units wide, the ring's outer edge at 1.
 */
function markTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const centre = size / 2
  const gradient = context.createRadialGradient(centre, centre, 0, centre, centre, centre)
  gradient.addColorStop(0, 'rgb(255 255 255 / 0)')
  gradient.addColorStop(0.6, 'rgb(255 255 255 / 0)')
  gradient.addColorStop(0.8, 'rgb(255 255 255 / 1)')
  gradient.addColorStop(1, 'rgb(255 255 255 / 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Glossy surfaces need surroundings to reflect. This room is generated, so
 * there is no image to download. Returns the room's map, for the caller to
 * dispose of.
 */
export function lightByRoom(renderer: WebGLRenderer, scene: Scene): WebGLRenderTarget {
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  try {
    // Half the default resolution, for a quarter of the GPU memory. Raise it
    // if a mirror-like skin ever shows the reflections as blurry.
    const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    scene.environment = environment.texture
    // The room is built y-up, and up here is +z. It is then tipped 0.6 rad
    // (34°) so its ceiling light hangs towards the top of the screen, beside
    // the lamp: straight overhead, a face lying flat mirrors it into the
    // camera and the number that shows the roll washes out.
    scene.environmentRotation.x = Math.PI / 2 - 0.6
    return environment
  }
  finally {
    room.dispose()
    pmrem.dispose()
  }
}

export function createDieLook(kind: DieKind, skin: DieSkin): DieLook {
  return kind === 'd6' ? createD6Look(skin) : createPolyhedronLook(POLYHEDRA[kind], skin)
}

/** Every kind's look, with a lighter shadow for a translucent skin; the icons cast no shadow, so only the cup's looks get one. */
function createDieLooks(skin: DieSkin): Record<DieKind, DieLook> {
  return Object.fromEntries(DIE_KINDS.map((kind) => {
    const look = createDieLook(kind, skin)
    return [kind, skin.transmission ? { ...look, shadow: translucentShadow() } : look]
  })) as Record<DieKind, DieLook>
}

/**
 * Draws the cup from straight above, so the screen is a window into it. Scene
 * coordinates are the physics world's, which are the device's.
 */
export class DiceScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera()
  private readonly tray: Mesh
  /** The tray's two materials, given their looks by setTable. */
  private readonly wall = new MeshStandardMaterial()
  private readonly floor = new MeshStandardMaterial()
  /** A warm lamp hung over the table: bright in the middle, falling off towards the rail. */
  private readonly lamp = new SpotLight(LAMP_COLOUR, 5)
  private readonly environment: WebGLRenderTarget
  private looks: Record<DieKind, DieLook>

  /** One instanced mesh per kind of die. */
  private readonly meshes: Record<DieKind, InstancedMesh>
  /** Each die's mesh, and its instance in that mesh. */
  private slots: { mesh: InstancedMesh, instance: number }[] = []
  /** Rings on the felt under the dice that did not roll over; see setMarks. */
  private readonly marks: InstancedMesh
  private readonly markMaterial: MeshStandardMaterial
  /** Reused for every die's transform, rather than made anew each frame. */
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()

  /** `capacity` is the most dice of one kind it will ever be asked to draw. */
  constructor(canvas: HTMLCanvasElement, capacity: number, skin: DieSkin, table: Table) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    this.renderer.shadowMap.enabled = true
    // Rolls bright highlights off instead of clipping them, without shifting
    // the hue of the felt the way the filmic curves do.
    this.renderer.toneMapping = NeutralToneMapping

    this.environment = lightByRoom(this.renderer, this.scene)
    // The room is there for reflections and a little fill. The lamp does the
    // lighting, so the table stays dark outside its pool.
    this.scene.environmentIntensity = 0.3

    // The geometry is built for each box size, in setBox, and the materials' looks in setTable.
    this.tray = new Mesh(new BufferGeometry(), [this.wall, this.floor])
    this.tray.receiveShadow = true
    this.looks = createDieLooks(skin)
    this.meshes = Object.fromEntries(DIE_KINDS.map(kind => [kind, createDiceMesh(this.looks[kind], capacity)])) as Record<DieKind, InstancedMesh>
    // Lit and shaded like the floor, so it reads as a mark on it rather than
    // a light over it, and drawn after the dice, which hide its middle.
    this.markMaterial = new MeshStandardMaterial({ map: markTexture(), roughness: 1, transparent: true, depthWrite: false })
    this.marks = new InstancedMesh(new PlaneGeometry(2, 2), this.markMaterial, capacity)
    this.marks.count = 0
    this.marks.visible = false
    this.marks.receiveShadow = true
    this.marks.frustumCulled = false
    this.scene.add(this.tray, ...Object.values(this.meshes), this.marks)

    // The pool of light comes from the soft edge of the cone, not from
    // distance, so the brightness does not change with the size of the table.
    this.lamp.penumbra = 0.9
    this.lamp.decay = 0
    this.lamp.castShadow = true
    this.lamp.shadow.mapSize.set(1024, 1024)
    this.lamp.shadow.normalBias = 0.03
    this.scene.add(this.lamp, this.lamp.target)
    this.setTable(table)
  }

  /** Draws the dice of `pool`, die i of the pool being index i of setDieTransform. */
  setPool(pool: DicePool): void {
    for (const mesh of Object.values(this.meshes)) mesh.count = 0
    this.slots = pool.map((kind) => {
      const mesh = this.meshes[kind]
      return { mesh, instance: mesh.count++ }
    })
    // An empty instanced mesh still sets up its shader and textures every
    // frame, in both passes; a hidden one is skipped, and uploads its
    // textures the first time it is shown.
    for (const mesh of Object.values(this.meshes)) mesh.visible = mesh.count > 0
  }

  /** Recasts every die in `skin`, where it lies; the old looks are freed. */
  setSkin(skin: DieSkin): void {
    const old = this.looks
    this.looks = createDieLooks(skin)
    for (const kind of DIE_KINDS) {
      const { geometry, materials, shadow } = this.looks[kind]
      this.meshes[kind].geometry = geometry
      this.meshes[kind].material = materials
      this.meshes[kind].customDepthMaterial = shadow
      disposeLook(old[kind])
    }
  }

  /** Lines the cup as `table`, where the dice lie; the old floor pattern is freed. */
  setTable({ floor, wall, mark }: Table): void {
    this.wall.color.set(wall.colour)
    this.wall.roughness = wall.roughness
    this.floor.map?.dispose()
    this.floor.map = floorTexture(floor.pattern)
    this.floor.color.set(floor.colour)
    this.floor.roughness = floor.roughness
    this.markMaterial.color.set(mark)
  }

  /** Fits the cup's opening to a viewport of the given size in CSS pixels. */
  setBox(box: BoxSize, widthPx: number, heightPx: number): void {
    this.renderer.setSize(widthPx, heightPx, false)

    this.tray.geometry.dispose()
    this.tray.geometry = trayGeometry(box)

    const distance = box.height * CAMERA_DISTANCE
    this.camera.fov = 2 * Math.atan(box.height / 2 / distance) * 180 / Math.PI
    this.camera.aspect = box.width / box.height
    this.camera.near = distance / 2
    this.camera.far = distance + box.depth + 1
    this.camera.position.set(0, 0, box.depth + distance)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()

    // Hung up and to the left of centre, so shadows fall down and right. About
    // 30° off the camera's line, so a face lying flat does not glare with it.
    // The cone reaches just past the far ends of the table, and its wide
    // penumbra is what dims them.
    const reach = Math.max(box.width, box.height)
    const height = reach * 1.1
    this.lamp.position.set(-reach * 0.45, reach * 0.45, height)
    this.lamp.target.position.set(0, 0, 0)
    this.lamp.angle = Math.atan(reach * 0.6 / height)
    this.lamp.shadow.camera.near = height * 0.5
    // Off-centre, the lamp sees the far corner of a square table at about 1.63 heights.
    this.lamp.shadow.camera.far = height * 1.7
    // three.js only rebuilds the shadow projection when the cone angle
    // changes, and the angle is the same for every table size.
    this.lamp.shadow.camera.updateProjectionMatrix()
  }

  setDieTransform(index: number, position: Vec3, rotation: Quat): void {
    this.position.set(position.x, position.y, position.z)
    this.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    const { mesh, instance } = this.slots[index]!
    mesh.setMatrixAt(instance, this.matrix.compose(this.position, this.quaternion, UNIT_SCALE))
    mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Rings the felt round each of `marks`, a die's centre and footprint radius
   * (cm), `shown` of the way faded in, from 0 to 1; none hides them. A die
   * resting against a wall has part of its ring hidden where the felt curves
   * up into it.
   */
  setMarks(marks: readonly { x: number, y: number, footprintRadius: number }[], shown: number): void {
    if (marks.length === 0 && !this.marks.visible) return
    this.marks.count = marks.length
    this.marks.visible = marks.length > 0
    this.quaternion.identity()
    marks.forEach(({ x, y, footprintRadius }, index) => {
      const radius = footprintRadius * MARK_REACH
      this.position.set(x, y, MARK_HEIGHT)
      this.scale.set(radius, radius, 1)
      this.marks.setMatrixAt(index, this.matrix.compose(this.position, this.quaternion, this.scale))
    })
    this.marks.instanceMatrix.needsUpdate = true
    this.markMaterial.opacity = MARK_OPACITY * shown
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    for (const look of [{ geometry: this.tray.geometry, materials: [this.wall, this.floor] }, ...Object.values(this.looks)]) disposeLook(look)
    for (const mesh of Object.values(this.meshes)) mesh.dispose()
    disposeLook({ geometry: this.marks.geometry, materials: [this.markMaterial] })
    this.marks.dispose()
    this.lamp.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts, and a remount would otherwise leave this one behind.
    this.renderer.forceContextLoss()
  }
}
