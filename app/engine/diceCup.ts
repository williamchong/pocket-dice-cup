import { boxForViewport } from './box'
import type { CupState } from './core/stateMachine'
import type { MotionSource } from './input/motionSource'
import type { TraceRecorder } from './input/motionTrace'
import type { Vec3 } from './math'
import type { Rapier } from './physics/world'
import { DiceScene } from './render/scene'
import { CupSimulation, type CupOptions } from './simulation'

export interface CupSnapshot {
  state: CupState
  result: number[] | null
}

export interface CupDebugInfo {
  acceleration: Vec3
  agitation: number
  sensorActive: boolean
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
      return new DiceCup(canvas, source, simulation, scene, onChange, recorder)
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
    }
  }

  /** Throws the dice for a click; see CupSimulation.toss. */
  toss(): void {
    this.simulation.toss()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.scene.dispose()
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
    this.recorder?.push(this.source.acceleration, timeMs)
    if (simulation.tick(dt, this.source.acceleration, timeMs)) {
      this.onChange({ state: simulation.state, result: simulation.result })
    }

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
