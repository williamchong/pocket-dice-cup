import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CAMERA_DISTANCE, type BoxSize } from '../box'
import type { Quat, Vec3 } from '../math'
import { createD6Mesh } from './d6Mesh'

/** Phones report 3; the extra pixels cost more than they show at this scale. */
const MAX_PIXEL_RATIO = 2

const FELT_COLOUR = 0x0d6b3c
const WALL_COLOUR = 0x2a160c
/** World units covered by one tile of the felt's speckle. */
const FELT_TILE = 1

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
  private readonly dice: Mesh[] = []

  constructor(canvas: HTMLCanvasElement) {
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

    // A unit box seen from inside: BoxGeometry's groups are +x, -x, +y, -y,
    // +z, -z, so the last one is the floor. The +z face is the glass, which
    // BackSide leaves undrawn from above.
    const wall = new MeshStandardMaterial({ color: WALL_COLOUR, roughness: 0.45, side: BackSide })
    const felt = new MeshStandardMaterial({ color: FELT_COLOUR, map: this.feltMap, roughness: 1, side: BackSide })
    this.tray = new Mesh(new BoxGeometry(1, 1, 1), [wall, wall, wall, wall, wall, felt])
    this.tray.receiveShadow = true
    this.scene.add(this.tray)

    // The pool of light comes from the soft edge of the cone, not from
    // distance, so the brightness does not change with the size of the table.
    this.lamp.penumbra = 0.9
    this.lamp.decay = 0
    this.lamp.castShadow = true
    this.lamp.shadow.mapSize.set(1024, 1024)
    this.lamp.shadow.normalBias = 0.03
    this.scene.add(this.lamp, this.lamp.target)
  }

  addD6(): void {
    const mesh = createD6Mesh()
    this.dice.push(mesh)
    this.scene.add(mesh)
  }

  /** Fits the cup's opening to a viewport of the given size in CSS pixels. */
  setBox(box: BoxSize, widthPx: number, heightPx: number): void {
    this.renderer.setSize(widthPx, heightPx, false)

    this.tray.scale.set(box.width, box.height, box.depth)
    this.tray.position.set(0, 0, box.depth / 2)

    const distance = box.height * CAMERA_DISTANCE
    this.camera.fov = 2 * Math.atan(box.height / 2 / distance) * 180 / Math.PI
    this.camera.aspect = box.width / box.height
    this.camera.near = distance / 2
    this.camera.far = distance + box.depth + 1
    this.camera.position.set(0, 0, box.depth + distance)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()

    this.feltMap.repeat.set(box.width / FELT_TILE, box.height / FELT_TILE)

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
    const mesh = this.dice[index]!
    mesh.position.set(position.x, position.y, position.z)
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    for (const mesh of [this.tray, ...this.dice]) {
      mesh.geometry.dispose()
      for (const material of new Set(mesh.material as Material[])) {
        if (material instanceof MeshStandardMaterial) {
          material.map?.dispose()
          material.bumpMap?.dispose()
        }
        material.dispose()
      }
    }
    this.lamp.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts, and a remount would otherwise leave this one behind.
    this.renderer.forceContextLoss()
  }
}
