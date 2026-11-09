import type { BoxSize } from './box'

/**
 * How long the felt takes to grow or shrink when a phone is unfolded or
 * folded (ms): long enough to be seen as the cup opening, about the time
 * the system's own unfold animation takes, short enough not to hold up a roll.
 */
export const FOLD_MS = 350

/**
 * The ease of the fold, an ease-out cubic; FOLD_EASING is the same curve for
 * CSS, so the buttons arrive with the felt.
 */
export function foldEase(t: number): number {
  return 1 - (1 - t) ** 3
}
export const FOLD_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)'

/**
 * Whether a resize from one viewport to the other (CSS px) is a phone being
 * folded or unfolded. The cup is held in portrait, so on a phone only a fold
 * changes the width; a browser toolbar changes the height by a tenth or so,
 * and a desktop window dragged wider comes in many small steps.
 */
export function isFold(from: { width: number, height: number }, to: { width: number, height: number }): boolean {
  return from.width > 0 && Math.abs(to.width - from.width) > from.width / 4
}

/**
 * How far to move the dice, in cm along x, so that each keeps its distance
 * from the right-hand wall. Opened like a book, the half held in the hand
 * stays put and the cover swings away to the left, so the outer screen lies
 * over the right-hand part of the inner one. Top to bottom the box stays
 * centred, as how the two screens line up is not known.
 */
export function foldShift(from: BoxSize, to: BoxSize): number {
  return (to.width - from.width) / 2
}

/**
 * The cup `t` of the way through a fold from `from` to `to`, from 0 to 1:
 * its size, and how far right of the final box's centre its own centre lies,
 * so that its right-hand wall stays where it was.
 */
export function foldFrame(from: BoxSize, to: BoxSize, t: number): { box: BoxSize, offsetX: number } {
  const eased = foldEase(Math.min(1, Math.max(0, t)))
  const width = from.width + (to.width - from.width) * eased
  const height = from.height + (to.height - from.height) * eased
  return { box: { width, height, depth: to.depth }, offsetX: (to.width - width) / 2 }
}
