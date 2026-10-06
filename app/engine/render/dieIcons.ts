import { Box3, DirectionalLight, MathUtils, Mesh, NeutralToneMapping, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type WebGLRenderTarget } from 'three'
import { DIE_KINDS, DIE_SHAPES, faceTop, POLYHEDRA, type DieKind } from '../dice/shapes'
import { axisAngle, multiply, normalise, rotate, rotationBetween, subtract, type Quat, type Vec3 } from '../math'
import { disposeLook } from './dieLook'
import { createDieLook, LAMP_COLOUR, lightByRoom } from './scene'

const X_AXIS: Vec3 = { x: 1, y: 0, z: 0 }
const Y_AXIS: Vec3 = { x: 0, y: 1, z: 0 }
const Z_AXIS: Vec3 = { x: 0, y: 0, z: 1 }
/** Tipped back and turned a little, so the die shows a side or two and reads as solid. */
const TILT = multiply(axisAngle(Y_AXIS, 0.15), axisAngle(X_AXIS, -0.3))
const FIELD_OF_VIEW = 30
/** Room around the die, as a multiple of its size. */
const MARGIN = 1.08

/**
 * Turns the face with outward normal `front` to the viewer, then about the
 * line of sight until `towards`, a direction on the die, points up the
 * picture, then tilts it.
 */
function present(front: Vec3, towards: Vec3): Quat {
  const facing = rotationBetween(front, Z_AXIS)
  const up = rotate(towards, facing)
  return multiply(TILT, multiply(axisAngle(Z_AXIS, Math.PI / 2 - Math.atan2(up.y, up.x)), facing))
}

/**
 * Turns a die of `kind` so its highest value faces the viewer, upright. A d4
 * stands on its highest face, seen from the side, with the value at its top
 * corner.
 */
function showcaseRotation(kind: DieKind): Quat {
  if (kind === 'd6') {
    const six = DIE_SHAPES.d6.faces.find(face => face.value === 6)!
    return multiply(TILT, rotationBetween(six.normal, Z_AXIS))
  }
  const shape = POLYHEDRA[kind]
  const top = shape.faces.reduce((best, face) => face.value > best.value ? face : best)
  if (shape.reads === 'down') {
    const side = shape.faces.find(face => face !== top)!
    const apex = shape.vertices.find((_, index) => !top.corners.includes(index))!
    return present(side.normal, apex)
  }
  const { centre, far } = faceTop(shape, top)
  return present(top.normal, normalise(subtract(far, centre)))
}

/**
 * A picture of each kind of die showing its highest face, `sizePx` square
 * with a clear background, as a PNG data URL. It has a WebGL context of its
 * own for as long as it takes, so the cup's renderer is left alone.
 */
export function renderDieIcons(sizePx: number): Record<DieKind, string> {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  let environment: WebGLRenderTarget | undefined
  try {
    renderer.setSize(sizePx, sizePx, false)
    renderer.toneMapping = NeutralToneMapping
    // Lit as in the cup, with more of the room as there is no pool of light to sit in.
    const scene = new Scene()
    environment = lightByRoom(renderer, scene)
    scene.environmentIntensity = 0.5
    const lamp = new DirectionalLight(LAMP_COLOUR, 3)
    lamp.position.set(-1, 1.5, 3)
    scene.add(lamp)
    const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1)

    const icons = {} as Record<DieKind, string>
    for (const kind of DIE_KINDS) {
      const look = createDieLook(kind)
      const die = new Mesh(look.geometry, look.materials)
      const { x, y, z, w } = showcaseRotation(kind)
      die.quaternion.set(x, y, z, w)
      // Centred on the die as turned, and close enough that its nearest side
      // fills the picture, give or take a margin.
      const bounds = new Box3().setFromObject(die, true)
      const centre = bounds.getCenter(new Vector3())
      const size = bounds.getSize(new Vector3())
      const distance = Math.max(size.x, size.y) / 2 * MARGIN / Math.tan(MathUtils.degToRad(FIELD_OF_VIEW / 2)) + size.z / 2
      camera.position.set(centre.x, centre.y, centre.z + distance)
      camera.near = distance - size.z
      camera.far = distance + size.z
      camera.updateProjectionMatrix()
      scene.add(die)
      renderer.render(scene, camera)
      // Read in the same task as the render, before the browser clears the canvas.
      icons[kind] = renderer.domElement.toDataURL('image/png')
      scene.remove(die)
      disposeLook(look)
    }
    return icons
  }
  finally {
    environment?.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
