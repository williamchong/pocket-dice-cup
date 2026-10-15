import type { ScreenCircle } from '../engine/box'

export interface ScreenRect { left: number, top: number, width: number, height: number }

/**
 * Whether the card hides the die: its centre is under the card, or within
 * half its radius of an edge. A corner of a die under the card leaves its
 * face to be read, and with a full cup both places nearly always clip one.
 */
function hides(rect: ScreenRect, { x, y, r }: ScreenCircle): boolean {
  const margin = r / 2
  return x > rect.left - margin && x < rect.left + rect.width + margin
    && y > rect.top - margin && y < rect.top + rect.height + margin
}

/**
 * The index of the place for the result card that hides the fewest dice,
 * the first of those that tie, so the card keeps to its usual place unless
 * moving it shows a die it would hide there.
 */
export function placeCard(dice: readonly ScreenCircle[], places: readonly ScreenRect[]): number {
  let best = 0
  let fewest = Infinity
  places.forEach((place, index) => {
    const hidden = dice.filter(die => hides(place, die)).length
    if (hidden < fewest) {
      best = index
      fewest = hidden
    }
  })
  return best
}
