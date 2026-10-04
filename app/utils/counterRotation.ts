// A type rather than an interface, so that Vue accepts it as a style binding.
export type CounterRotationStyle = {
  top: string
  left: string
  width: string
  height: string
  transformOrigin: string
  transform: string
}

/**
 * Style that turns a full-viewport element back by the screen's rotation, so
 * it stays upright in the device's own portrait frame. Shaking tips the phone
 * far enough for the browser to rotate the page, and the web cannot lock the
 * orientation on iOS. Returns undefined when the screen is upright.
 *
 * `angle` is `screen.orientation.angle`: at 90 the device was turned 90°
 * counter-clockwise, so its top is at the left of the rotated viewport.
 * `width` and `height` are the rotated viewport's size.
 */
export function counterRotation(angle: number, width: number, height: number): CounterRotationStyle | undefined {
  // The element is laid out in portrait, then turned about its top-left
  // corner and moved back into the viewport.
  const portrait = { width: `${height}px`, height: `${width}px`, transformOrigin: 'top left' }
  if (angle === 90) return { ...portrait, top: `${height}px`, left: '0px', transform: 'rotate(-90deg)' }
  if (angle === 270) return { ...portrait, top: '0px', left: `${width}px`, transform: 'rotate(90deg)' }
  // Upside down, as an iPad or an Android phone can be: the same size, half a turn.
  if (angle === 180) return { top: `${height}px`, left: `${width}px`, width: `${width}px`, height: `${height}px`, transformOrigin: 'top left', transform: 'rotate(180deg)' }
  return undefined
}
