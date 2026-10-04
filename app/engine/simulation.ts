import type { BoxSize } from './box'
import { MotionAnalyser } from './core/motionAnalyser'
import { nextState, type CupState } from './core/stateMachine'
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

  constructor(rapier: Rapier, box: BoxSize, { randomStart = true }: CupOptions = {}) {
    this.physics = new PhysicsWorld(rapier, box)
    this.physics.addD6(randomStart ? Math.random : undefined)
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
