import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
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
import { DIE_KINDS, DIE_SHAPES, POLYHEDRA, type DieKind } from '../dice/shapes'
import { seededRandom, type Quat, type Vec3 } from '../math'
import { createD6Look } from './d6Mesh'
import { createDiceMesh, disposeLook, translucentShadow, type DieLook } from './dieLook'
import { createPolyhedronLook } from './polyhedronMesh'
import type { DieSkin } from './skins'
import type { Table } from '../tables'

/** Phones report 3; the extra pixels cost more than they show at this scale. */
const MAX_PIXEL_RATIO = 2

/** A warm lamp, as over a games table. */
export const LAMP_COLOUR = '#fff1dc'
/**
 * The light of a table that does not set its own: the warm lamp, with the
 * room there for reflections and a little fill. The lamp does the lighting,
 * so the table stays dark outside its pool.
 */
const DEFAULT_LIGHT: NonNullable<Table['light']> = { colour: LAMP_COLOUR, environment: 0.3 }
/** The floor patterns tiled by the centimetre; a starfield is painted once over the whole floor. */
type TiledPattern = Exclude<Table['floor']['pattern'], 'starfield'>
/**
 * How each floor pattern is drawn: a tile of `size` pixels covering `tile`
 * cm, speckled with greys from `darkest` up by `spread`, so the floor reads
 * as cloth or vinyl rather than flat paint; a grid also has lines along the
 * tile's edges.
 */
const FLOOR_PATTERNS: Record<TiledPattern, { size: number, tile: number, darkest: number, spread: number, grid: boolean }> = {
  cloth: { size: 128, tile: 1, darkest: 190, spread: 65, grid: false },
  // A battle mat's squares are an inch, the size its figures stand on, and the cup is drawn at true size.
  grid: { size: 256, tile: 2.54, darkest: 235, spread: 20, grid: true },
}
/**
 * Pixels across the starfield, which covers the whole floor once rather than
 * tiling, as a tiled nebula shows its seams. A phone's long side is about
 * 1,860 px at the pixel ratio of 2 the cup is drawn at, so a star a pixel or
 * two across stays sharp. The floor is seen face-on at about a texel a pixel,
 * so it has no mipmaps, which would add a third to its 16 MB of GPU memory;
 * it takes that only while the table is in use.
 */
const STARFIELD_SIZE = 2048
/**
 * How much of the lamp a starfield floor reflects, as a grey its colour is
 * multiplied by. The stars light themselves, so a mid grey is enough for
 * the dice's shadows to show on them, without the lamp's pool washing out the
 * middle of the sky; at #2a2a2a the shadows could not be seen and the dice
 * looked to float.
 */
const STARFIELD_REFLECTANCE = '#4a4a4a'
/**
 * Height (cm) of the marks under dice that did not roll over: on the felt,
 * which is at 0, without fighting it for depth.
 */
const MARK_HEIGHT = 0.01
/** How strong a mark is once faded in, and how far out it reaches from a die's centre, in footprint radii. */
const MARK_OPACITY = 0.35
const MARK_REACH = 1.45
/**
 * A glowing die lights the floor under it: how far the light reaches, in
 * footprint radii, how bright it is at its middle, and how high (cm) above
 * the floor it is drawn, over the marks. At 0.02 cm the floor hid it in
 * Chromium; at 0.1 it shows, and the die still hides its middle. At 0.45 it
 * was barely seen on the starfield.
 */
const GLOW_REACH = 2.5
const GLOW_OPACITY = 0.7
const GLOW_HEIGHT = 0.1
/**
 * The light on the floor is full while a die's centre is lower than
 * GLOW_FULL (cm), as every die is at rest, and fades out over the next
 * GLOW_FADE, so a die tossed up off the floor lights it less.
 */
const GLOW_FULL = 1
const GLOW_FADE = 3
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
function floorTexture(pattern: TiledPattern): CanvasTexture {
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
 * Deep space seen through the floor: a band of nebula from corner to corner,
 * as the Milky Way crosses the sky, in the floor's colour, with stars thicker
 * along it and a few bright ones with a cross of glare. It is drawn from a
 * fixed seed, so it is the same sky at every launch.
 */
function starfieldTexture(colour: string): CanvasTexture {
  const size = STARFIELD_SIZE
  const random = seededRandom(1977)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = colour
  context.fillRect(0, 0, size, size)
  /** A point near the band, `spread` of the size off it at most. */
  const nearBand = (spread: number) => {
    const along = random()
    const off = (random() - 0.5) * spread * size
    return { x: along * size + off * 0.7, y: (1 - along) * size + off * 0.7 }
  }
  // The nebula: soft clouds that add up where they overlap, as glowing gas does.
  context.globalCompositeOperation = 'lighter'
  const clouds = ['#5b2a86', '#1f6f8b', '#a3307a', '#2a3fa0', '#14807a']
  for (let i = 0; i < 28; i++) {
    const { x, y } = nearBand(0.5)
    const radius = size * (0.08 + random() * 0.18)
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius)
    cloud.addColorStop(0, `${clouds[i % clouds.length]}50`)
    cloud.addColorStop(1, `${clouds[i % clouds.length]}00`)
    context.fillStyle = cloud
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  const tints = ['255 255 255', '200 220 255', '255 236 210', '180 240 255']
  const star = (x: number, y: number, radius: number, alpha: number) => {
    context.fillStyle = `rgb(${tints[Math.floor(random() * tints.length)]} / ${alpha})`
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  for (let i = 0; i < 2600; i++) {
    const { x, y } = i % 2 ? nearBand(0.35) : { x: random() * size, y: random() * size }
    star(x, y, 0.6 + random() ** 3 * 1.6, 0.35 + random() * 0.65)
  }
  for (let i = 0; i < 24; i++) {
    const x = random() * size
    const y = random() * size
    const reach = 10 + random() * 18
    const halo = context.createRadialGradient(x, y, 0, x, y, reach)
    halo.addColorStop(0, 'rgb(220 235 255 / 0.9)')
    halo.addColorStop(0.15, 'rgb(170 210 255 / 0.25)')
    halo.addColorStop(1, 'rgb(170 210 255 / 0)')
    context.fillStyle = halo
    context.fillRect(x - reach, y - reach, reach * 2, reach * 2)
    context.fillRect(x - reach * 2, y - 0.75, reach * 4, 1.5)
    context.fillRect(x - 0.75, y - reach * 2, 1.5, reach * 4)
    star(x, y, 2, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  // Centred in the cup; setBox scales it to cover the floor.
  texture.offset.set(0.5, 0.5)
  return texture
}

/** A square texture filled with a radial gradient from its middle to its edges, through `stops` of white at the given alphas. */
function radialTexture(stops: readonly [offset: number, alpha: number][]): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const centre = size / 2
  const gradient = context.createRadialGradient(centre, centre, 0, centre, centre, centre)
  for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgb(255 255 255 / ${alpha})`)
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A round pool of light, brightest in the middle, for a glowing die to cast on the floor under it. */
const glowTexture = () => radialTexture([[0, 1], [0.35, 0.45], [1, 0]])

/**
 * A soft ring, as if chalked on the cloth: clear in the middle, where the die
 * stands, palest across its band and fading to nothing at both edges. It fills
 * a square two units wide, the ring's outer edge at 1.
 */
const markTexture = () => radialTexture([[0, 0], [0.6, 0], [0.8, 1], [1, 0]])

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
  /** A lamp hung over the table, in the table's colour: bright in the middle, falling off towards the rail. */
  private readonly lamp = new SpotLight(LAMP_COLOUR, 5)
  private readonly environment: WebGLRenderTarget
  private looks: Record<DieKind, DieLook>
  /** The floor's size, for a starfield, which is fitted to it rather than tiled. */
  private box: BoxSize | null = null
  private starfield = false

  /** One instanced mesh per kind of die. */
  private readonly meshes: Record<DieKind, InstancedMesh>
  /** Each die's mesh, its instance in that mesh, and the radius of its glow on the floor (cm). */
  private slots: { mesh: InstancedMesh, instance: number, glowRadius: number }[] = []
  /** Rings on the felt under the dice that did not roll over; see setMarks. */
  private readonly marks: InstancedMesh
  private readonly markMaterial: MeshStandardMaterial
  /** The light a glowing skin casts on the floor under each die, instance i under die i; hidden for other skins. */
  private readonly glows: InstancedMesh
  private readonly glowMaterial: MeshBasicMaterial
  private readonly glowShade = new Color()
  /** Whether the skin glows, and whether the floor is dark enough for its light to be seen on. */
  private glowing = false
  private darkFloor = true
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

    // How much the room lights the table is the table's, set in setTable.
    this.environment = lightByRoom(this.renderer, this.scene)

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
    // Unlit and added on, as light is, and faded per die by its instance colour.
    this.glowMaterial = new MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: GLOW_OPACITY, blending: AdditiveBlending, depthWrite: false })
    this.glows = new InstancedMesh(new PlaneGeometry(2, 2), this.glowMaterial, capacity)
    this.glows.count = 0
    this.glows.frustumCulled = false
    // Every instance has a colour from the start, so the shader is built with them once.
    for (let index = 0; index < capacity; index++) this.glows.setColorAt(index, this.glowShade.setScalar(1))
    this.setGlow(skin)
    this.scene.add(this.tray, ...Object.values(this.meshes), this.marks, this.glows)

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
      return { mesh, instance: mesh.count++, glowRadius: DIE_SHAPES[kind].footprintRadius * GLOW_REACH }
    })
    this.glows.count = pool.length
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
    this.setGlow(skin)
  }

  private setGlow({ glow }: DieSkin): void {
    this.glowing = Boolean(glow)
    if (glow) this.glowMaterial.color.set(glow)
    this.showGlows()
  }

  /** Added to a light floor, as the battle mat's, the glow only washed it out to white, as a real one would not show there. */
  private showGlows(): void {
    this.glows.visible = this.glowing && this.darkFloor
  }

  /** Lines and lights the cup as `table`, where the dice lie; the old floor pattern is freed. */
  setTable({ floor, wall, mark, light = DEFAULT_LIGHT }: Table): void {
    this.wall.color.set(wall.colour)
    this.wall.roughness = wall.roughness
    this.wall.metalness = wall.metalness ?? 0
    this.floor.map?.dispose()
    // A starfield lights itself, so it is also the floor's emissive map.
    this.starfield = floor.pattern === 'starfield'
    this.floor.map = floor.pattern === 'starfield' ? starfieldTexture(floor.colour) : floorTexture(floor.pattern)
    this.floor.emissiveMap = this.starfield ? this.floor.map : null
    this.floor.emissive.set(this.starfield ? 0xffffff : 0x000000)
    this.floor.color.set(this.starfield ? STARFIELD_REFLECTANCE : floor.colour)
    this.floor.roughness = floor.roughness
    // An emissive map in or out changes the shader.
    this.floor.needsUpdate = true
    this.fitFloor()
    this.markMaterial.color.set(mark)
    this.lamp.color.set(light.colour)
    this.scene.environmentIntensity = light.environment
    this.darkFloor = !floor.light
    this.showGlows()
  }

  /** Stretches a starfield over the whole floor, keeping its stars round; a pattern tiled by the centimetre is left as it is. */
  private fitFloor(): void {
    if (!this.starfield || !this.box) return
    const side = Math.max(this.box.width, this.box.height)
    this.floor.map!.repeat.set(1 / side, 1 / side)
  }

  /** Fits the cup's opening to a viewport of the given size in CSS pixels. */
  setBox(box: BoxSize, widthPx: number, heightPx: number): void {
    this.renderer.setSize(widthPx, heightPx, false)

    this.tray.geometry.dispose()
    this.tray.geometry = trayGeometry(box)
    this.box = box
    this.fitFloor()

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
    const { mesh, instance, glowRadius } = this.slots[index]!
    mesh.setMatrixAt(instance, this.matrix.compose(this.position, this.quaternion, UNIT_SCALE))
    mesh.instanceMatrix.needsUpdate = true
    // Kept up while hidden too, so a glowing skin chosen with the dice at rest lights the floor where they lie.
    this.position.z = GLOW_HEIGHT
    this.scale.set(glowRadius, glowRadius, 1)
    this.glows.setMatrixAt(index, this.matrix.compose(this.position, this.quaternion.identity(), this.scale))
    this.glows.instanceMatrix.needsUpdate = true
    const fade = Math.min(1, Math.max(0, 1 - (position.z - GLOW_FULL) / GLOW_FADE))
    this.glows.setColorAt(index, this.glowShade.setScalar(fade))
    this.glows.instanceColor!.needsUpdate = true
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
    this.glowMaterial.map?.dispose()
    disposeLook({ geometry: this.glows.geometry, materials: [this.glowMaterial] })
    this.glows.dispose()
    this.lamp.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts, and a remount would otherwise leave this one behind.
    this.renderer.forceContextLoss()
  }
}
