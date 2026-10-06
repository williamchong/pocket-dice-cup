import type { DieKind } from '~/engine/dice/shapes'

/** Big enough for a 44 px picture on a 3x screen. */
const ICON_PIXELS = 132

/** Null while they are drawn, or for good if they cannot be, as without WebGL. */
const icons = shallowRef<Record<DieKind, string> | null>(null)
let drawing = false

/**
 * Draws the pictures, once. It holds the page for a moment, so the cup
 * calls it while idle, before anyone opens the picker.
 */
export function drawDieIcons(): void {
  if (drawing) return
  drawing = true
  // Imported here so three.js stays out of the initial bundle.
  import('~/engine/render/dieIcons')
    .then(({ renderDieIcons }) => {
      icons.value = renderDieIcons(ICON_PIXELS)
    })
    .catch((error) => {
      console.error(error)
    })
}

/** A picture of each kind of die showing its highest face, as image URLs, shared by every picker. */
export function useDieIcons() {
  drawDieIcons()
  return readonly(icons)
}
