import { D6_SIZE } from './dice/d6'

/**
 * Interior of the cup in world units (centimetres), in the device's own axes:
 * x to the right of the screen, y to its top, z out of the glass. The floor is
 * at z = 0 and the glass at z = depth.
 */
export interface BoxSize { width: number, height: number, depth: number }

/**
 * CSS pixels per centimetre of glass. A browser does not report how big its
 * screen is, but phones agree closely: every iPhone with a 3x screen is 60.4,
 * and Android phones run from about 53 to 64.
 */
const CSS_PX_PER_CM = 60
const DEPTH = 4
/**
 * The shortest screen side the cup is sized for. A smaller viewport, such as a
 * canvas that is not laid out yet, gets the dice drawn smaller instead, so the
 * cup still holds them.
 */
const MIN_SCREEN_SIDE = 4

/**
 * Camera distance above the glass, as a multiple of the cup's height. Larger is
 * flatter. It lives here because the cup is sized for this camera.
 */
export const CAMERA_DISTANCE = 2

/**
 * A box whose opening fills the viewport, sized so that a die at rest on the
 * floor is drawn at its real size on a phone. The floor is further from the
 * camera than the glass, so the opening is a little smaller than the screen.
 */
export function boxForViewport(widthPx: number, heightPx: number): BoxSize {
  const pxPerCm = Math.min(CSS_PX_PER_CM, Math.min(widthPx, heightPx) / MIN_SCREEN_SIDE)
  const screenWidth = widthPx / pxPerCm
  const screenHeight = heightPx / pxPerCm
  // With the camera CAMERA_DISTANCE cup heights above the glass, this is the
  // height at which the plane of the die's top face is drawn at 1:1.
  const height = screenHeight - (DEPTH - D6_SIZE) / CAMERA_DISTANCE
  const scale = height / screenHeight
  return { width: screenWidth * scale, height, depth: DEPTH }
}
