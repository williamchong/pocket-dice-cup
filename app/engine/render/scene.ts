import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  type InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CAMERA_DISTANCE, type BoxSize } from '../box'
import type { Quat, Vec3 } from '../math'
import { createD6Look, createD6Mesh } from './d6Mesh'

/** Phones report 3; the extra pixels cost more than they show at this scale. */
const MAX_PIXEL_RATIO = 2

const FELT_COLOUR = 0x0d6b3c
const WALL_COLOUR = 0x2a160c
/** World units covered by one tile of the felt's speckle. */
const FELT_TILE = 1
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
 * The inside of the cup with rounded corners, open at the glass: a felt floor
 * that curves up into wooden walls (the walls are material group 0, the felt 1). It is built by
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
    // The felt's speckle is laid flat from above, so it keeps its size up the cove.
    uvs.push(x / FELT_TILE, y / FELT_TILE)
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

/** Fine random speckle, tiled across the floor, so the felt reads as cloth rather than flat paint. */
function feltTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 190 + Math.random() * 65
    image.data[i] = image.data[i + 1] = image.data[i + 2] = shade
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
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
  /** A warm lamp hung over the table: bright in the middle, falling off towards the rail. */
  private readonly lamp = new SpotLight(0xfff1dc, 5)
  private readonly feltMap = feltTexture()
  private readonly environment: WebGLRenderTarget
  private readonly d6Look = createD6Look()
  private readonly dice: InstancedMesh
  /** Reused for every die's transform, rather than made anew each frame. */
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()

  /** `capacity` is the most dice it will ever be asked to draw. */
  constructor(canvas: HTMLCanvasElement, capacity: number) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    this.renderer.shadowMap.enabled = true
    // Rolls bright highlights off instead of clipping them, without shifting
    // the hue of the felt the way the filmic curves do.
    this.renderer.toneMapping = NeutralToneMapping

    // Glossy surfaces need surroundings to reflect. This room is generated,
    // so there is no image to download. It is built y-up, and up here is +z.
    const pmrem = new PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    // Half the default resolution, for a quarter of the GPU memory. Raise it
    // if a mirror-like skin ever shows the reflections as blurry.
    this.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    room.dispose()
    pmrem.dispose()
    this.scene.environment = this.environment.texture
    this.scene.environmentRotation.x = Math.PI / 2
    // The room is there for reflections and a little fill. The lamp does the
    // lighting, so the table stays dark outside its pool.
    this.scene.environmentIntensity = 0.3

    // The geometry is built for each box size, in setBox.
    const wall = new MeshStandardMaterial({ color: WALL_COLOUR, roughness: 0.45 })
    const felt = new MeshStandardMaterial({ color: FELT_COLOUR, map: this.feltMap, roughness: 1 })
    this.tray = new Mesh(new BufferGeometry(), [wall, felt])
    this.tray.receiveShadow = true
    this.dice = createD6Mesh(this.d6Look, capacity)
    this.scene.add(this.tray, this.dice)

    // The pool of light comes from the soft edge of the cone, not from
    // distance, so the brightness does not change with the size of the table.
    this.lamp.penumbra = 0.9
    this.lamp.decay = 0
    this.lamp.castShadow = true
    this.lamp.shadow.mapSize.set(1024, 1024)
    this.lamp.shadow.normalBias = 0.03
    this.scene.add(this.lamp, this.lamp.target)
  }

  /** Draws the first `count` dice, up to the capacity. */
  setDiceCount(count: number): void {
    this.dice.count = count
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

    // Hung a little up and to the left of centre, so shadows fall down and
    // right. The cone reaches just past the far ends of the table, and its
    // wide penumbra is what dims them.
    const reach = Math.max(box.width, box.height)
    const height = reach * 1.1
    this.lamp.position.set(-reach * 0.12, reach * 0.15, height)
    this.lamp.target.position.set(0, 0, 0)
    this.lamp.angle = Math.atan(reach * 0.6 / height)
    this.lamp.shadow.camera.near = height * 0.5
    this.lamp.shadow.camera.far = height * 1.5
    // three.js only rebuilds the shadow projection when the cone angle
    // changes, and the angle is the same for every table size.
    this.lamp.shadow.camera.updateProjectionMatrix()
  }

  setDieTransform(index: number, position: Vec3, rotation: Quat): void {
    this.position.set(position.x, position.y, position.z)
    this.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    this.dice.setMatrixAt(index, this.matrix.compose(this.position, this.quaternion, UNIT_SCALE))
    this.dice.instanceMatrix.needsUpdate = true
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    const parts: [BufferGeometry, Material[]][] = [
      [this.tray.geometry, this.tray.material as Material[]],
      [this.d6Look.geometry, this.d6Look.materials],
    ]
    for (const [geometry, materials] of parts) {
      geometry.dispose()
      for (const material of new Set(materials)) {
        if (material instanceof MeshStandardMaterial) {
          material.map?.dispose()
          material.bumpMap?.dispose()
        }
        material.dispose()
      }
    }
    this.dice.dispose()
    this.lamp.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts, and a remount would otherwise leave this one behind.
    this.renderer.forceContextLoss()
  }
}
