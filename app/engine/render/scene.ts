import {
  BackSide,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
  type Material,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { BoxSize } from '../box'
import type { Quat, Vec3 } from '../math'
import { createD6Mesh } from './d6Mesh'

/** Camera distance above the glass, as a multiple of the cup's height. Larger is flatter. */
const CAMERA_DISTANCE = 2
/** Phones report 3; the extra pixels cost more than they show at this scale. */
const MAX_PIXEL_RATIO = 2

const FELT_COLOUR = 0x1f6b45
const WALL_COLOUR = 0x3b2416

/**
 * Draws the cup from straight above, so the screen is a window into it. Scene
 * coordinates are the physics world's, which are the device's.
 */
export class DiceScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera()
  private readonly tray: Mesh
  private readonly sun = new DirectionalLight(0xffffff, 2.4)
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
    // Half the default resolution: a quarter of the GPU memory, and nothing
    // here is glossy enough to show the difference.
    this.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    room.dispose()
    pmrem.dispose()
    this.scene.environment = this.environment.texture
    this.scene.environmentRotation.x = Math.PI / 2
    // The room fills in for an ambient light. At full strength it washes out
    // the sun's shadows and greys the pips with its reflection.
    this.scene.environmentIntensity = 0.5

    // A unit box seen from inside: BoxGeometry's groups are +x, -x, +y, -y,
    // +z, -z, so the last one is the floor. The +z face is the glass, which
    // BackSide leaves undrawn from above.
    const wall = new MeshStandardMaterial({ color: WALL_COLOUR, roughness: 0.8, side: BackSide })
    const felt = new MeshStandardMaterial({ color: FELT_COLOUR, roughness: 1, side: BackSide })
    this.tray = new Mesh(new BoxGeometry(1, 1, 1), [wall, wall, wall, wall, wall, felt])
    this.tray.receiveShadow = true
    this.scene.add(this.tray)

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)
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

    // From over the viewer's left shoulder, so shadows fall down and right.
    const reach = Math.max(box.width, box.height)
    this.sun.position.set(-reach * 0.35, reach * 0.45, reach * 1.5)
    this.sun.target.position.set(0, 0, 0)
    const shadow = this.sun.shadow.camera
    shadow.left = shadow.bottom = -reach * 0.75
    shadow.right = shadow.top = reach * 0.75
    shadow.near = reach * 0.5
    shadow.far = reach * 2.5
    shadow.updateProjectionMatrix()
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
        if (material instanceof MeshStandardMaterial) material.map?.dispose()
        material.dispose()
      }
    }
    this.sun.dispose()
    this.environment.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts, and a remount would otherwise leave this one behind.
    this.renderer.forceContextLoss()
  }
}
