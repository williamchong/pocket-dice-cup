import type { BoxSize } from './box'
import { MotionAnalyser } from './core/motionAnalyser'
import { nextState, type CupState } from './core/stateMachine'
import { D6_FACES } from './dice/d6'
import { readTopFace } from './dice/faces'
import type { Vec3 } from './math'
import { PhysicsWorld, type Rapier } from './physics/world'

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
      shaking: this.analyser.shaking,
      restingFaceUp: this.analyser.restingFaceUp,
      diceAtRest: this.physics.diceAtRest,
    })
    if (next === this.state) return false

    this.state = next
    if (next === 'shaking') this.result = null
    if (next === 'result') this.result = this.readDice()
    return true
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
