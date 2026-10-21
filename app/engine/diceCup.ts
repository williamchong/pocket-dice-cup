import { boxForViewport, toScreen, type ScreenCircle } from './box'
import { MAX_DICE, type DicePool } from './core/pool'
import type { CupState } from './core/stateMachine'
import { ClackSound, type SoundTuning } from './feedback/clackSound'
import { CupFeedback, type FeedbackStats, type HapticTuning } from './feedback/cupFeedback'
import { deviceHaptics } from './feedback/haptics'
import type { MotionSource } from './input/motionSource'
import type { TraceRecorder } from './input/motionTrace'
import type { Vec3 } from './math'
import type { Rapier, Surface } from './physics/world'
import { DiceScene } from './render/scene'
import type { DieSkin } from './render/skins'
import type { Table } from './tables'
import { CupSimulation, type CupOptions } from './simulation'

export interface CupSnapshot {
  state: CupState
  result: number[] | null
  /** How many dice of the result did not roll over; see CupSimulation.slid. */
  slid: number
  /** Whether the phone has been shaken yet; see CupSimulation.shaken. */
  shaken: boolean
  /** Whether the roll will end by itself; see CupSimulation.layingFlat. */
  layingFlat: boolean
  /**
   * Where each die of the result lies on the canvas, in CSS pixels, for the
   * result card to keep off; empty with no result.
   */
  dice: ScreenCircle[]
  /** Frames have stopped while the phone lies screen-down; see CupSimulation.dormant. */
  dormant: boolean
  /** Whether the sensor has sent a reading yet. */
  sensing: boolean
  /** The dice are not drawn, the phone lying screen-down; a tap shows them. */
  hidden: boolean
}

export interface CupDebugInfo extends FeedbackStats {
  acceleration: Vec3
  agitation: number
  /** What the simulation takes a frame, in ms, averaged over about the last 60 frames. */
  physicsMs: number
  /** The time between frames drawn one after another, in ms, averaged likewise: 16.7 at 60 Hz, longer when drawing drops frames. */
  frameMs: number
  sensorActive: boolean
  /** What reads the sensor; see MotionSource.name. */
  sensorName: string
  sound: string
}

export interface DiceCupOptions extends CupOptions {
  /** How the dice are finished at the start. */
  skin: DieSkin
  /** What the cup is lined with at the start. */
  table: Table
}

/** A frame longer than this is treated as a pause (a hidden tab), not as time to catch up on. */
const MAX_FRAME_SECONDS = 0.1
/** How much each frame moves the averages of physicsMs and frameMs. */
const AVERAGE_SMOOTHING = 1 / 60
/** How long the marks under dice that did not roll over take to fade in (ms), about the result card's own pop. */
const MARK_FADE_MS = 300

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
  private physicsMs = 0
  private frameMs = 0
  /** When the dice were last drawn, for frameMs. A tick that goes dormant draws nothing, so the gap before waking never counts. */
  private drawnAtMs = -Infinity
  /** Dormant: no frame is asked for until a reading disturbs the stillness. */
  private framesStopped = false
  /** Whether the sensor has sent a reading yet; see onReading. */
  private measured = false
  /** Whether the last frame left the dice undrawn, screen-down. */
  private hidden = false
  /**
   * A tap with the phone screen-down draws the dice anyway, until it is
   * turned back up: someone is watching the screen, as through iPhone
   * Mirroring with the phone face down on a desk.
   */
  private shownScreenDown = false
  /** When the marks under the dice that did not roll over began to fade in. */
  private marksShownAt = -Infinity
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
    source.onReading = this.onReading
    this.frame = requestAnimationFrame(this.tick)
  }

  /** `rapier` must already be initialised. A `recorder` gets every reading the simulation is given. */
  static create(
    canvas: HTMLCanvasElement,
    rapier: Rapier,
    source: MotionSource,
    onChange: (snapshot: CupSnapshot) => void,
    { skin, table, ...options }: DiceCupOptions,
    recorder: TraceRecorder | null = null,
  ): DiceCup {
    // A canvas that is not laid out yet has no size; the first resize corrects the box.
    const simulation = new CupSimulation(rapier, boxForViewport(canvas.clientWidth || 1, canvas.clientHeight || 1), options)
    try {
      const scene = new DiceScene(canvas, MAX_DICE, skin, table)
      scene.setPool(simulation.physics.pool)
      const feedback = new CupFeedback(createSound(), deviceHaptics())
      feedback.setSurfaces(table.sound, table.sharpness)
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
      physicsMs: this.physicsMs,
      frameMs: this.frameMs,
      sensorActive: this.source.active,
      sensorName: this.source.name,
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

  /** In a browser, has to run inside a tap or click: browsers only start audio from one. */
  unlockSound(): Promise<void> {
    return this.feedback.unlock()
  }

  get pool(): DicePool {
    return this.simulation.physics.pool
  }

  /** Changes the dice between rolls; see CupSimulation.setPool. */
  setPool(pool: DicePool): boolean {
    if (!this.simulation.setPool(pool)) return false
    this.scene.setPool(this.pool)
    this.stale = true
    this.wake()
    this.notifyChange()
    return true
  }

  /** Recasts the dice in `skin`, at any time: it changes nothing about how they roll. */
  setSkin(skin: DieSkin): void {
    this.scene.setSkin(skin)
    this.stale = true
    this.wake()
  }

  /** Lines the cup as `table`, at any time: it changes how the dice look, sound and feel, never how they roll. */
  setTable(table: Table): void {
    this.scene.setTable(table)
    this.feedback.setSurfaces(table.sound, table.sharpness)
    this.stale = true
    this.wake()
  }

  /**
   * Throws the dice for a click; see CupSimulation.toss. With the dice
   * hidden screen-down, the click only shows them, so that they are seen
   * where they lie before the next throw.
   */
  toss(): void {
    this.wake()
    if (this.showScreenDown()) return
    const wasLayingFlat = this.simulation.layingFlat
    this.simulation.toss()
    // A tap mid-roll can lay the dice flat, or let them go, with no change of
    // state. From a result the next frame's change of state tells instead,
    // as the dice have only just been thrown from where the card was placed.
    if (this.simulation.layingFlat !== wasLayingFlat) this.notifyChange()
  }

  /**
   * Lays the dice down as if the phone were flat; see CupSimulation.settle.
   * Screen-down it shows them too, so they are seen to fall.
   */
  settle(): void {
    if (this.showScreenDown()) this.wake()
    if (this.simulation.settle()) this.notifyChange()
  }

  /** Draws the dice screen-down until the phone is turned up, if they were hidden. */
  private showScreenDown(): boolean {
    if (!this.hidden) return false
    this.shownScreenDown = true
    this.stale = true
    return true
  }

  dispose(): void {
    this.source.onReading = null
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.scene.dispose()
    this.feedback.dispose()
    this.simulation.dispose()
  }

  private notifyChange(): void {
    const { simulation } = this
    this.onChange({ state: simulation.state, result: simulation.result, slid: simulation.slid.length, shaken: simulation.shaken, layingFlat: simulation.layingFlat, dice: simulation.result ? this.diceOnScreen() : [], dormant: this.framesStopped, sensing: this.source.active, hidden: this.hidden })
  }

  private diceOnScreen(): ScreenCircle[] {
    const { physics } = this.simulation
    const box = boxForViewport(this.width, this.height)
    return Array.from({ length: physics.dieCount }, (_, index) => {
      const { x, y, pxPerCm } = toScreen(box, this.width, this.height, physics.diePosition(index))
      return { x, y, r: physics.dieShape(index).footprintRadius * pxPerCm }
    })
  }

  /**
   * Starts the motion analysis afresh at the first reading. While dormant,
   * the sensor still reads at its own rate, and a reading that moves the
   * phone starts the frames again, before the next hit is due.
   */
  private readonly onReading = (): void => {
    const { analyser } = this.simulation
    // Until the first reading the cup runs on the source's placeholder, a
    // phone lying flat. Held tipped back past upright, as lying in bed, the
    // first real reading strays from it by over 15 m/s², which read as a
    // shake: it started a roll and put the shake hint away for good.
    if (!this.measured) {
      this.measured = true
      analyser.forget()
      // The page shows the shake hint once the sensor is reading, and with
      // the phone still no change of state would send a snapshot to say so.
      this.notifyChange()
    }
    if (!this.framesStopped || !analyser.disturbedBy(this.source.acceleration)) return
    // Taken in now, so the stillness ends here even if the first frame
    // reads a quieter sample, and the cup does not go straight back.
    analyser.update(this.source.acceleration, performance.now())
    this.wake()
  }

  /** Asks for no frame until a reading disturbs the stillness; see onReading. */
  private stopFrames(): void {
    cancelAnimationFrame(this.frame)
    this.framesStopped = true
    this.notifyChange()
  }

  private wake(): void {
    if (!this.framesStopped) return
    this.framesStopped = false
    // The frame after the gap counts as a pause, as for a hidden tab (MAX_FRAME_SECONDS).
    this.frame = requestAnimationFrame(this.tick)
    this.notifyChange()
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
    // For frameMs, which counts only frames drawn one after another: a tick
    // that draws marks drawnAtMs with its own time, so the last tick drew if
    // the two still match.
    const drewLastTick = this.drawnAtMs === this.lastTimeMs
    this.lastTimeMs = timeMs

    const { simulation, scene } = this
    // Before the first reading the source holds a placeholder, not a measurement.
    if (this.source.active) this.recorder?.push(this.source.acceleration, timeMs)
    const started = performance.now()
    const changed = simulation.tick(dt, this.source.acceleration, timeMs)
    this.physicsMs += (performance.now() - started - this.physicsMs) * AVERAGE_SMOOTHING
    if (changed) {
      this.notifyChange()
      // The dice are often asleep by the time the result is read, and what
      // goes with a new state, such as the marks, still has to be drawn.
      this.stale = true
      if (simulation.state === 'result') this.marksShownAt = prefersReducedMotion() ? -Infinity : timeMs
    }
    this.feedback.play(simulation.physics.impacts, timeMs)

    // Screen-down, the dice still roll and are heard and felt, but no one
    // sees them; the first frame back up draws where they are.
    const { faceDown } = simulation.analyser
    if (!faceDown) this.shownScreenDown = false
    const hidden = faceDown && !this.shownScreenDown
    if (hidden !== this.hidden) {
      this.hidden = hidden
      this.notifyChange()
    }
    if (hidden) {
      this.stale = true
      if (simulation.dormant) this.stopFrames()
      return
    }
    // Shown screen-down by a tap, the cup still goes dormant once the dice
    // are drawn at rest, or the screen would be kept awake face down for good.
    if (faceDown && simulation.dormant && !this.stale) {
      this.stopFrames()
      return
    }

    // A result can sit on screen for minutes with the screen kept awake, so
    // do not redraw an unchanged picture 60 times a second.
    const moving = !simulation.physics.asleep
    const markShown = Math.min(1, (timeMs - this.marksShownAt) / MARK_FADE_MS)
    const fading = markShown < 1 && simulation.slid.length > 0
    if (!moving && !this.stale && !fading) return
    this.stale = moving
    for (let index = 0; index < simulation.physics.dieCount; index++) {
      scene.setDieTransform(index, simulation.physics.diePosition(index), simulation.physics.dieRotation(index))
    }
    // Read from where the dice lie each time, so a resize that pulls one in takes its mark along.
    scene.setMarks(simulation.slid.map((index) => {
      const { x, y } = simulation.physics.diePosition(index)
      return { x, y, footprintRadius: simulation.physics.dieShape(index).footprintRadius }
    }), markShown)
    scene.render()
    if (drewLastTick) this.frameMs += (timeMs - this.drawnAtMs - this.frameMs) * AVERAGE_SMOOTHING
    this.drawnAtMs = timeMs
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
