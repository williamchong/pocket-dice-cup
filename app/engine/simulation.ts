import type { BoxSize } from './box'
import { MotionAnalyser } from './core/motionAnalyser'
import { isRolling, nextState, type CupState } from './core/stateMachine'
import { D6_FACES } from './dice/d6'
import { readTopFace } from './dice/faces'
import type { Vec3 } from './math'
import { PhysicsWorld, type Rapier } from './physics/world'

/** How hard a click hits the dice: up and sideways in cm/s, spin in rad/s. */
const TOSS = { lift: 100, push: 80, spin: 50 }

export interface CupOptions {
  /**
   * Whether the dice start at a random place and face, as if left from the
   * last roll. Off, they start in the middle with the same face up every time,
   * for tests and debugging. On by default.
   */
  randomStart?: boolean
  /** How many d6 are in the cup at the start. 1 by default. */
  dice?: number
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
  /** Where new dice are placed at random; with none, on a fixed grid. */
  private readonly random: (() => number) | undefined

  constructor(rapier: Rapier, box: BoxSize, { randomStart = true, dice = 1 }: CupOptions = {}) {
    this.physics = new PhysicsWorld(rapier, box)
    this.random = randomStart ? Math.random : undefined
    this.physics.setDiceCount(dice, this.random)
  }

  /**
   * Adds or removes dice between rolls, which clears any result; during one
   * it does nothing. Returns whether the number of dice changed.
   */
  setDiceCount(count: number): boolean {
    if (isRolling(this.state)) return false
    const before = this.physics.dieCount
    this.physics.setDiceCount(count, this.random)
    if (this.physics.dieCount === before) return false
    this.state = 'idle'
    this.result = null
    return true
  }

  /**
   * Advances by one frame using the latest `accelerationIncludingGravity`
   * reading. Returns whether the state changed.
   */
  tick(dtSeconds: number, acceleration: Vec3, timeMs: number): boolean {
    this.analyser.update(acceleration, timeMs)
    this.physics.setAcceleration(acceleration)
    this.physics.step(dtSeconds)

    const next = nextState(this.state, {
      shaking: this.analyser.shaking || this.tossed,
      restingFaceUp: this.analyser.restingFaceUp,
      diceAtRest: this.physics.diceAtRest,
    })
    this.tossed = false
    if (next === this.state) return false

    this.state = next
    if (next === 'shaking') this.result = null
    if (next === 'result') this.result = this.readDice()
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

  dispose(): void {
    this.physics.dispose()
  }

  private readDice(): number[] {
    return Array.from(
      { length: this.physics.dieCount },
      (_, index) => readTopFace(D6_FACES, this.physics.dieRotation(index)),
    )
  }
}
