/** Where a key press goes to a control of its own rather than the cup. */
const CONTROL_SELECTOR = 'button, input, textarea, select, a[href], [role="button"], [contenteditable]:not([contenteditable="false"])'

/** The few fields of a KeyboardEvent this looks at, so it can be tested in Node. */
export type RollKeyEvent = Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>

/**
 * Whether a key press should roll the dice: the space bar, pressed rather
 * than held, outside a control. Space already presses a focused button, and
 * a button keeps the focus after it is clicked, so one press would both open
 * a sheet and roll.
 */
export function isRollKey({ key, repeat, ctrlKey, altKey, metaKey, target }: RollKeyEvent): boolean {
  if (key !== ' ' || repeat || ctrlKey || altKey || metaKey) return false
  // The window, the document and text nodes have no closest(), and are never a control.
  return !(target as Element | null)?.closest?.(CONTROL_SELECTOR)
}
