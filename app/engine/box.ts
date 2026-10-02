/**
 * Interior of the cup in world units (centimetres), in the device's own axes:
 * x to the right of the screen, y to its top, z out of the glass. The floor is
 * at z = 0 and the glass at z = depth.
 */
export interface BoxSize { width: number, height: number, depth: number }

const SHORT_SIDE = 7
const DEPTH = 4

/** A box whose opening has the viewport's aspect ratio and a phone-sized short side. */
export function boxForViewport(widthPx: number, heightPx: number): BoxSize {
  const scale = SHORT_SIDE / Math.min(widthPx, heightPx)
  return { width: widthPx * scale, height: heightPx * scale, depth: DEPTH }
}
