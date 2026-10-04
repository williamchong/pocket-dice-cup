import type { CounterRotationStyle } from '~/utils/counterRotation'

/**
 * Keeps an element upright in the device's portrait frame as the screen
 * rotates; see counterRotation. Bind the result to the element's style.
 */
export function useCounterRotation() {
  const style = shallowRef<CounterRotationStyle | undefined>()

  const update = () => {
    // The body is the fixed box the cup fills; iOS can report a different
    // innerHeight while its toolbar collapses.
    style.value = counterRotation(screen.orientation?.angle ?? 0, document.body.clientWidth, document.body.clientHeight)
  }

  onMounted(() => {
    update()
    // Both: the angle and the viewport size are not always updated by the
    // time the first of the two events fires.
    window.addEventListener('resize', update)
    screen.orientation?.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    screen.orientation?.removeEventListener('change', update)
  })

  return style
}
