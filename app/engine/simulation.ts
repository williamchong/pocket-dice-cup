import type { BoxSize } from './box'
import { MotionAnalyser } from './core/motionAnalyser'
import type { DicePool } from './core/pool'
import { isRolling, nextState, type CupState } from './core/stateMachine'
import { readFace } from './dice/faces'
import { REST_ACCELERATION } from './input/motionSource'
import type { Vec3 } from './math'
import { PhysicsWorld, type Rapier } from './physics/world'

/** How hard a click hits the dice: up and sideways in cm/s, spin in rad/s. */
const TOSS = { lift: 100, push: 80, spin: 50 }
/** How long the phone lies still screen-down, its dice asleep, before the cup goes dormant. */
const DORMANT_AFTER_MS = 2000

export interface CupOptions {
  /**
   * Whether the dice start at a random place and face, as if left from the
   * last roll. Off, they start in the middle with the same face up every time,
   * for tests and debugging. On by default.
   */
  randomStart?: boolean
  /** The dice in the cup at the start. One d6 by default. */
  pool?: DicePool
}

/**
 * The dice cup without a screen: physics, motion analysis and the state
 * machine. It has no DOM dependency, so tests drive it in Node with recorded
 * or synthetic sensor data.
 */
export class CupSimulation {
  state: CupState = 'idle'
  /** One value per die once they have settled, otherwise null. */
  result: number[] | null = null

  readonly analyser = new MotionAnalyser()
  readonly physics: PhysicsWorld
  /** A click since the last tick, which starts a roll like a shake does. */
  private tossed = false
  /**
   * The pull the dice feel in place of the sensor's, or null to follow it.
   * A result keeps the pull the dice came to rest under, so they stay put
   * while the phone is picked up and passed around, until the next roll.
   * During a roll it is only set by settle(), so it also stands for the
   * phone lying flat.
   */
  private pinned: Vec3 | null = null
  /** Where new dice are placed at random; with none, on a fixed grid. */
  private readonly random: (() => number) | undefined

  constructor(rapier: Rapier, box: BoxSize, { randomStart = true, pool = ['d6'] }: CupOptions = {}) {
    this.physics = new PhysicsWorld(rapier, box)
    this.random = randomStart ? Math.random : undefined
    this.physics.setPool(pool, this.random)
  }

  /**
   * Changes the dice between rolls, which clears any result; during one it
   * does nothing. Returns whether the dice changed.
   */
  setPool(pool: DicePool): boolean {
    if (isRolling(this.state)) return false
    const before = this.physics.pool.join()
    this.physics.setPool(pool, this.random)
    if (this.physics.pool.join() === before) return false
    this.state = 'idle'
    this.result = null
    this.pinned = null
    return true
  }

  /**
   * Advances by one frame using the latest `accelerationIncludingGravity`
   * reading. Returns whether the state changed.
   */
  tick(dtSeconds: number, acceleration: Vec3, timeMs: number): boolean {
    this.analyser.update(acceleration, timeMs)
    this.physics.setAcceleration(this.pinned ?? acceleration)
    this.physics.step(dtSeconds)

    const next = nextState(this.state, {
      shaking: this.analyser.shaking || this.tossed,
      // Pinned during a roll means settle() was asked for.
      restingFaceUp: this.analyser.restingFaceUp || this.pinned !== null,
      diceAtRest: this.physics.diceAtRest,
    })
    this.tossed = false
    if (next === this.state) return false

    this.state = next
    // Only a new roll lets go of the pin. The analyser still calls the phone
    // shaken for up to a second after it stops, and a settle asked for then
    // must hold.
    if (next === 'shaking') {
      this.result = null
      this.pinned = null
    }
    if (next === 'result') {
      this.result = this.readDice()
      this.pinned ??= { ...acceleration }
    }
    return true
  }

  /**
   * Rolls from a click or tap: hits the dice up into the air with a
   * random push and spin, and starts a roll on the next tick.
   */
  toss(random: () => number = Math.random): void {
    this.physics.launchDice(TOSS, random)
    this.tossed = true
  }

  /**
   * Lays the dice down during a roll as if the phone were flat and still,
   * however it is held: they fall straight onto the screen and the roll
   * goes on to a result. A shake starts a new roll. Returns whether it did
   * anything.
   */
  settle(): boolean {
    if (!isRolling(this.state)) return false
    this.pinned = { ...REST_ACCELERATION }
    return true
  }

  /**
   * Screen-down and still for a while, with every die asleep: nothing moves
   * or is seen until the phone is picked up, so frames can stop.
   */
  get dormant(): boolean {
    return this.analyser.faceDown && this.analyser.stillMs >= DORMANT_AFTER_MS && this.physics.asleep
  }

  dispose(): void {
    this.physics.dispose()
  }

  private readDice(): number[] {
    return Array.from(
      { length: this.physics.dieCount },
      (_, index) => readFace(this.physics.dieShape(index), this.physics.dieRotation(index)).face.value,
    )
  }
}
