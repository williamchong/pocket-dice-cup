import type { ShallowRef } from 'vue'
import type { DicePool } from '~/engine/core/pool'
import type { CupState } from '~/engine/core/stateMachine'
import type { CupDebugInfo, DiceCup, DiceCupOptions } from '~/engine/diceCup'
import type { SoundTuning } from '~/engine/feedback/clackSound'
import type { HapticTuning } from '~/engine/feedback/cupFeedback'
import type { Surface } from '~/engine/physics/world'
import type { DieSkin } from '~/engine/render/skins'
import { DeviceMotionSource, type MotionPermission } from '~/engine/input/motionSource'
import { TraceRecorder, type MotionTrace } from '~/engine/input/motionTrace'
import type { ScreenAwake } from '~/utils/wakeLock'

export interface UseDiceCupOptions extends DiceCupOptions {
  /** Keep the last 30 seconds of sensor readings for `exportTrace`. */
  recordTrace?: boolean
}

/**
 * Runs the dice cup on a canvas and exposes the little of its state the UI
 * needs. The engine itself is never made reactive: Vue's proxies would wrap
 * three.js and Rapier objects that are read thousands of times a frame.
 */
export function useDiceCup(canvas: Readonly<ShallowRef<HTMLCanvasElement | null>>, { recordTrace = false, ...options }: UseDiceCupOptions) {
  const ready = ref(false)
  /** The engine could not start, for example because WebGL is unavailable. */
  const failed = ref(false)
  const state = ref<CupState>('idle')
  const result = ref<number[] | null>(null)
  const pool = shallowRef<DicePool>(['d6'])
  /**
   * The sensor has sent a reading, as of the last change of state. Desktop
   * Chrome grants motion access yet never sends one.
   */
  const sensing = ref(false)
  /** Null until the first attempt to start the sensor, on mount, has settled. */
  const permission = ref<MotionPermission | null>(null)

  const source = new DeviceMotionSource()
  const recorder = recordTrace ? new TraceRecorder() : null
  let cup: DiceCup | null = null
  let screenAwake: ScreenAwake | null = null
  let starting = false
  let unmounted = false

  onMounted(async () => {
    // Only iOS waits for a tap, and only until access is given.
    void start()
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
        sensing.value = source.active
        screenAwake?.setWanted(!snapshot.dormant)
      }, options, recorder)
      pool.value = cup.pool
      // Capacitor's WebView lets audio start without a tap; a browser leaves
      // it waiting for the first one.
      void cup.unlockSound()
      ready.value = true
    }
    catch (error) {
      console.error(error)
      failed.value = true
      // Started on mount for a cup that will not come.
      source.stop()
      screenAwake?.release()
    }
  })

  onBeforeUnmount(() => {
    unmounted = true
    source.stop()
    screenAwake?.release()
    cup?.dispose()
  })

  /**
   * Starts the sensor, and the sound. On iOS both need a tap the first time:
   * it only shows the motion prompt, and starts audio, from a user gesture.
   */
  async function start() {
    void cup?.unlockSound()
    // 'prompt' is the one outcome a tap can change.
    const settled = permission.value !== null && permission.value !== 'prompt'
    if (starting || settled) return
    starting = true
    const granted = await source.start()
    starting = false
    // The component can go away while the iOS prompt is open.
    if (unmounted) return source.stop()
    permission.value = granted
    if (granted === 'granted') screenAwake = keepScreenAwake()
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

  /** Recasts the dice in `skin`, at any time. */
  function setSkin(skin: DieSkin) {
    cup?.setSkin(skin)
  }

  /** Rolls from a click or tap, with or without a motion sensor. */
  function toss() {
    void cup?.unlockSound()
    cup?.toss()
  }

  /** Lays the dice down during a roll, for a phone held in the hand rather than put down. */
  function settle() {
    cup?.settle()
  }

  return { ready, failed, state, result, pool, sensing, permission, start, toss, settle, setPool, setSkin, debugInfo, exportTrace, hapticTuning, soundTuning, testHit }
}
