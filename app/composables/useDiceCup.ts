import type { ShallowRef } from 'vue'
import type { DicePool } from '~/engine/core/pool'
import type { CupState } from '~/engine/core/stateMachine'
import type { CupDebugInfo, DiceCup } from '~/engine/diceCup'
import type { SoundTuning } from '~/engine/feedback/clackSound'
import type { HapticTuning } from '~/engine/feedback/cupFeedback'
import type { Surface } from '~/engine/physics/world'
import type { CupOptions } from '~/engine/simulation'
import { DeviceMotionSource, type MotionPermission } from '~/engine/input/motionSource'
import { TraceRecorder, type MotionTrace } from '~/engine/input/motionTrace'

export interface DiceCupOptions extends CupOptions {
  /** Keep the last 30 seconds of sensor readings for `exportTrace`. */
  recordTrace?: boolean
}

/**
 * Runs the dice cup on a canvas and exposes the little of its state the UI
 * needs. The engine itself is never made reactive: Vue's proxies would wrap
 * three.js and Rapier objects that are read thousands of times a frame.
 */
export function useDiceCup(canvas: Readonly<ShallowRef<HTMLCanvasElement | null>>, { recordTrace = false, ...options }: DiceCupOptions = {}) {
  const ready = ref(false)
  /** The engine could not start, for example because WebGL is unavailable. */
  const failed = ref(false)
  const state = ref<CupState>('idle')
  const result = ref<number[] | null>(null)
  const pool = shallowRef<DicePool>(['d6'])
  /** Null until the user has pressed start. */
  const permission = ref<MotionPermission | null>(null)

  const source = new DeviceMotionSource()
  const recorder = recordTrace ? new TraceRecorder() : null
  let cup: DiceCup | null = null
  let releaseWakeLock = () => {}
  let starting = false
  let unmounted = false

  onMounted(async () => {
    const element = canvas.value!
    try {
      // Both are imported here rather than statically so three.js and the
      // Rapier WASM (inlined in its module as base64) stay out of the initial
      // bundle, and together so neither download waits for the other.
      const [engine, rapier] = await Promise.all([
        import('~/engine/diceCup'),
        import('@dimforge/rapier3d-compat').then(async (module) => {
          await module.default.init()
          return module.default
        }),
      ])
      if (unmounted) return
      cup = engine.DiceCup.create(element, rapier, source, (snapshot) => {
        state.value = snapshot.state
        result.value = snapshot.result
      }, options, recorder)
      pool.value = cup.pool
      ready.value = true
    }
    catch (error) {
      console.error(error)
      failed.value = true
    }
  })

  onBeforeUnmount(() => {
    unmounted = true
    source.stop()
    releaseWakeLock()
    cup?.dispose()
  })

  /** Has to run inside a tap: iOS only shows the motion prompt, and starts audio, from a user gesture. */
  async function start() {
    if (starting || permission.value !== null) return
    void cup?.unlockSound()
    starting = true
    const granted = await source.start()
    starting = false
    // The component can go away while the iOS prompt is open.
    if (unmounted) return source.stop()
    permission.value = granted
    if (granted === 'granted') releaseWakeLock = keepScreenAwake()
  }

  function debugInfo(): CupDebugInfo | null {
    return cup?.debugInfo ?? null
  }

  /** The live haptic tuning, a plain object rather than a reactive one; null until the engine is ready. */
  function hapticTuning(): HapticTuning | null {
    return cup?.hapticTuning ?? null
  }

  function soundTuning(): SoundTuning | null {
    return cup?.soundTuning ?? null
  }

  /** A click, so it can start the sound too: a desktop browser need not have had the start tap. */
  async function testHit(surface: Surface) {
    await cup?.unlockSound()
    cup?.testHit(surface)
  }

  /** The recent sensor readings, or null when not recording. */
  function exportTrace(note: string): MotionTrace | null {
    return recorder?.toTrace(navigator.userAgent, note) ?? null
  }

  /** Changes the dice between rolls; during one it does nothing. Returns whether the dice changed. */
  function setPool(next: DicePool): boolean {
    if (!cup?.setPool(next)) return false
    pool.value = cup.pool
    return true
  }

  /** Rolls from a click or tap, with or without a motion sensor. */
  function toss() {
    void cup?.unlockSound()
    cup?.toss()
  }

  return { ready, failed, state, result, pool, permission, start, toss, setPool, debugInfo, exportTrace, hapticTuning, soundTuning, testHit }
}
