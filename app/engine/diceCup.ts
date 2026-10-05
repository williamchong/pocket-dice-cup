import { boxForViewport } from './box'
import type { CupState } from './core/stateMachine'
import { ClackSound, type SoundTuning } from './feedback/clackSound'
import { CupFeedback, type FeedbackStats, type HapticTuning } from './feedback/cupFeedback'
import { deviceHaptics } from './feedback/haptics'
import type { MotionSource } from './input/motionSource'
import type { TraceRecorder } from './input/motionTrace'
import type { Vec3 } from './math'
import type { Rapier, Surface } from './physics/world'
import { DiceScene } from './render/scene'
import { CupSimulation, type CupOptions } from './simulation'

export interface CupSnapshot {
  state: CupState
  result: number[] | null
}

export interface CupDebugInfo extends FeedbackStats {
  acceleration: Vec3
  agitation: number
  sensorActive: boolean
  sound: string
}

/** A frame longer than this is treated as a pause (a hidden tab), not as time to catch up on. */
const MAX_FRAME_SECONDS = 0.1

/**
 * The dice cup in a browser: runs the simulation from a motion source every
 * animation frame and draws it on a canvas.
 */
export class DiceCup {
  private frame = 0
  private lastTimeMs = 0
  private width = 0
  private height = 0
  /** Whether the last frame had dice in motion, or the view changed, so one more draw is owed. */
  private stale = true
  private readonly resizeObserver: ResizeObserver

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly source: MotionSource,
    private readonly simulation: CupSimulation,
    private readonly scene: DiceScene,
    private readonly feedback: CupFeedback,
    private readonly onChange: (snapshot: CupSnapshot) => void,
    private readonly recorder: TraceRecorder | null,
  ) {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
  }

  /** `rapier` must already be initialised. A `recorder` gets every reading the simulation is given. */
  static create(
    canvas: HTMLCanvasElement,
    rapier: Rapier,
    source: MotionSource,
    onChange: (snapshot: CupSnapshot) => void,
    options: CupOptions = {},
    recorder: TraceRecorder | null = null,
  ): DiceCup {
    // A canvas that is not laid out yet has no size; the first resize corrects the box.
    const simulation = new CupSimulation(rapier, boxForViewport(canvas.clientWidth || 1, canvas.clientHeight || 1), options)
    try {
      const scene = new DiceScene(canvas)
      for (let index = 0; index < simulation.physics.dieCount; index++) scene.addD6()
      const feedback = new CupFeedback(createSound(), deviceHaptics())
      return new DiceCup(canvas, source, simulation, scene, feedback, onChange, recorder)
    }
    catch (error) {
      // WebGL can be unavailable; do not leave the WASM world behind.
      simulation.dispose()
      throw error
    }
  }

  get debugInfo(): CupDebugInfo {
    return {
      acceleration: this.source.acceleration,
      agitation: this.simulation.analyser.agitation,
      sensorActive: this.source.active,
      sound: this.feedback.soundState,
      ...this.feedback.stats,
    }
  }

  /** The live haptic tuning, for the debug overlay to change. */
  get hapticTuning(): HapticTuning {
    return this.feedback.tuning
  }

  /** The live sound tuning, for the debug overlay to change; null where there is no Web Audio. */
  get soundTuning(): SoundTuning | null {
    return this.feedback.soundTuning
  }

  /** Plays a full-strength hit on `surface`, to hear and feel the tuning without a shake. */
  testHit(surface: Surface): void {
    this.feedback.testHit(surface)
  }

  /** Has to run inside a tap or click: browsers only start audio from one. */
  unlockSound(): Promise<void> {
    return this.feedback.unlock()
  }

  /** Throws the dice for a click; see CupSimulation.toss. */
  toss(): void {
    this.simulation.toss()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.scene.dispose()
    this.feedback.dispose()
    this.simulation.dispose()
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.canvas
    if (clientWidth === 0 || clientHeight === 0) return
    if (clientWidth === this.width && clientHeight === this.height) return
    this.width = clientWidth
    this.height = clientHeight
    this.stale = true
    const box = boxForViewport(clientWidth, clientHeight)
    this.simulation.physics.resize(box)
    this.scene.setBox(box, clientWidth, clientHeight)
  }

  private readonly tick = (timeMs: number): void => {
    this.frame = requestAnimationFrame(this.tick)
    const dt = Math.min((timeMs - this.lastTimeMs) / 1000, MAX_FRAME_SECONDS)
    this.lastTimeMs = timeMs

    const { simulation, scene } = this
    // Before the first reading the source holds a placeholder, not a measurement.
    if (this.source.active) this.recorder?.push(this.source.acceleration, timeMs)
    if (simulation.tick(dt, this.source.acceleration, timeMs)) {
      this.onChange({ state: simulation.state, result: simulation.result })
    }
    this.feedback.play(simulation.physics.impacts, timeMs)

    // A result can sit on screen for minutes with the screen kept awake, so
    // do not redraw an unchanged picture 60 times a second.
    const moving = !simulation.physics.asleep
    if (!moving && !this.stale) return
    this.stale = moving
    for (let index = 0; index < simulation.physics.dieCount; index++) {
      scene.setDieTransform(index, simulation.physics.diePosition(index), simulation.physics.dieRotation(index))
    }
    scene.render()
  }
}

/**
 * The dice still roll, in silence, where there is no Web Audio or it will not
 * start: iOS refuses a new AudioContext past a handful open at once.
 */
function createSound(): ClackSound | null {
  if (typeof AudioContext === 'undefined') return null
  try {
    return new ClackSound()
  }
  catch (error) {
    console.error(error)
    return null
  }
}
