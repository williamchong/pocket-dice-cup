import type { BoxSize } from './box'
import { MotionAnalyser } from './core/motionAnalyser'
import type { DicePool } from './core/pool'
import { isRolling, nextState, type CupState } from './core/stateMachine'
import { readAlignment, readFace, type DieFace } from './dice/faces'
import { REST_ACCELERATION } from './input/motionSource'
import { length, normalise, type Vec3 } from './math'
import { PhysicsWorld, type Rapier } from './physics/world'

/**
 * How hard a click hits the dice: up and sideways in cm/s, spin in rad/s.
 * Thrown off the screen at 100 cm/s and 50 rad/s, a d6 tapped in 1,200 rolls
 * in a row with the phone tilted 40° to upright landed on the face it had
 * 25-26% of the time, where a fair die does it 17%. Thrown away from gravity
 * at these, it did 15-18% at every tilt. A d4 among other dice still keeps
 * its face about 30% of the time, against 25%, once the phone is tilted 40°
 * or more; spinning it at 120 rad/s did not change that.
 */
const TOSS = { lift: 150, push: 80, spin: 80 }
/**
 * Steady gravity (m/s²) below which it gives no direction to toss the dice
 * away from, as in free fall, and they are thrown off the screen instead.
 */
const MIN_TOSS_GRAVITY = 1
/** How long the phone lies still screen-down, its dice asleep, before the cup goes dormant. */
const DORMANT_AFTER_MS = 2000
/**
 * How long a phone held in the hand stays still after a shake, its dice at
 * rest against the low wall, before they are laid flat as Settle does. The
 * recorded Core Motion shake holds the iPhone upright for over 3 s between
 * two shakes, at 0.3-0.4 m/s² against the 1 m/s² that counts as still, and
 * ends its first roll there. Longer than the 0.3 s that counts as put down
 * screen-up, so a short pause between shakes goes on rolling; no such pause
 * has been recorded on a phone yet to tune it against.
 */
const HELD_STILL_SETTLE_MS = 1000

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
  /**
   * The dice of the result, by index, that never turned over in the roll:
   * each ended on the face it began with, which never tipped past sideways,
   * so it slid, rocked or stood still. A real cup slid gently does the same,
   * and the trick is left to work, so they are only pointed out.
   */
  slid: number[] = []
  /** Whether the phone has been shaken since the cup was made, rather than only tapped. */
  shaken = false

  readonly analyser = new MotionAnalyser()
  readonly physics: PhysicsWorld
  /** A click since the last tick, which starts a roll like a shake does. */
  private tossed = false
  /**
   * The pull the dice feel in place of the sensor's, or null to follow it.
   * A result keeps the pull the dice came to rest under, so they stay put
   * while the phone is picked up and passed around, until the next roll.
   * During a roll it is only set by settle(), asked for or by a phone held
   * still after a shake, or by a tap in the hand, so it also stands for the
   * phone lying flat.
   */
  private pinned: Vec3 | null = null
  /**
   * The face each die showed as the roll began, and the least its alignment
   * with the way the die is read has been since: below 0 it has tipped past
   * sideways.
   */
  private rollStart: { face: DieFace, lowest: number }[] = []
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
    this.slid = []
    this.pinned = null
    this.rollStart = []
    return true
  }

  /**
   * Advances by one frame using the latest `accelerationIncludingGravity`
   * reading. Returns whether the state changed.
   */
  tick(dtSeconds: number, acceleration: Vec3, timeMs: number): boolean {
    this.analyser.update(acceleration, timeMs)
    if (this.analyser.shaking) this.shaken = true
    // Read before the step, so a toss's first frame of spin is counted.
    if (!isRolling(this.state) && (this.analyser.shaking || this.tossed)) {
      this.rollStart = this.readFaces().map(face => ({ face, lowest: 1 }))
    }
    if (this.heldStillAfterShake) this.settle()
    this.physics.setAcceleration(this.pinned ?? acceleration)
    this.physics.setLayingFlat(this.layingFlat)
    this.physics.step(dtSeconds)

    const next = nextState(this.state, {
      shaking: this.analyser.shaking || this.tossed,
      // Pinned during a roll means settle() was asked for, or a tap in the hand.
      restingFaceUp: this.analyser.restingFaceUp || this.pinned !== null,
      diceAtRest: this.physics.diceAtRest,
    })
    this.tossed = false
    if (isRolling(next)) this.trackTurns()
    if (next === this.state) return false

    this.state = next
    // Only a shake lets go of the pin: toss() has already set or cleared it
    // for a tap. The analyser still calls the phone shaken for up to a second
    // after it stops, but the state is still shaking then, with no change to
    // come through here, so a settle asked for then holds.
    if (next === 'shaking') {
      this.result = null
      this.slid = []
      if (this.analyser.shaking) this.pinned = null
    }
    if (next === 'result') {
      const faces = this.readFaces()
      this.result = faces.map(face => face.value)
      this.slid = this.rollStart.flatMap(({ face, lowest }, index) => face === faces[index] && lowest > 0 ? [index] : [])
      this.pinned ??= { ...acceleration }
    }
    return true
  }

  /**
   * Rolls from a click or tap: hits the dice up, away from gravity, with a
   * random push and spin, and starts a roll on the next tick. Up comes from
   * the analyser's steady gravity, which the jolt of a finger on the screen
   * barely moves, not from the pinned pull of a shown result.
   *
   * A phone held in the hand is never flat and still, so a roll that
   * followed it would never end: the dice slid into the low edge and waited
   * there until Settle was pressed again. A tap with the sensor reading a
   * phone neither resting screen-up nor being shaken lays the dice flat, as
   * settle() does, and throws them straight off the screen. One lying still
   * on a table, even tilted up to 45°, keeps its pull.
   */
  toss(random: () => number = Math.random): void {
    const { analyser } = this
    const held = analyser.steadyGravity !== null && !analyser.restingFaceUp && !analyser.shaking
    this.pinned = held ? { ...REST_ACCELERATION } : null
    const gravity = this.pinned ?? analyser.steadyGravity
    const up = gravity && length(gravity) > MIN_TOSS_GRAVITY ? normalise(gravity) : undefined
    this.physics.launchDice(TOSS, random, up)
    this.tossed = true
  }

  /**
   * Lays the dice down during a roll as if the phone were flat and still,
   * however it is held: they fall straight onto the screen, which bounces
   * them less until the result (see PhysicsWorld.setLayingFlat) so they
   * stay on it, and the roll goes on to a result. A shake starts a new roll.
   * Returns whether it did anything.
   */
  settle(): boolean {
    if (!isRolling(this.state)) return false
    this.pinned = { ...REST_ACCELERATION }
    return true
  }

  /**
   * A roll is under way that will end by itself however the phone is held,
   * as settle() was asked for or a tap in the hand laid the dice flat.
   */
  get layingFlat(): boolean {
    return isRolling(this.state) && this.pinned !== null
  }

  /**
   * Screen-down and still for a while, with every die asleep: nothing moves
   * or is seen until the phone is picked up, so frames can stop.
   */
  get dormant(): boolean {
    return this.analyser.faceDown && this.analyser.stillMs >= DORMANT_AFTER_MS && this.physics.asleep
  }

  /**
   * A shake has ended with the phone in the hand, neither screen-up nor
   * screen-down, held still with its dice at rest against the low wall. Held,
   * the phone never reads as resting screen-up, so the roll would wait there
   * for Settle; staying still this long is taken as the shake being over.
   * Screen-down is left out, as a cup turned over on the table waits to be
   * lifted.
   */
  private get heldStillAfterShake(): boolean {
    const { analyser } = this
    return this.state === 'shaking'
      && !analyser.shaking
      && !analyser.restingFaceUp
      && !analyser.faceDown
      && analyser.stillMs >= HELD_STILL_SETTLE_MS
      && this.physics.diceAtRest
  }

  dispose(): void {
    this.physics.dispose()
  }

  private readFaces(): DieFace[] {
    return Array.from(
      { length: this.physics.dieCount },
      (_, index) => readFace(this.physics.dieShape(index), this.physics.dieRotation(index)).face,
    )
  }

  /**
   * Once a frame: a die that rocks onto a neighbouring face and back, as a d20
   * does in a gentle shake, ends where it began, so the face it shows is not
   * enough to tell it turned over.
   */
  private trackTurns(): void {
    this.rollStart.forEach((start, index) => {
      if (start.lowest <= 0) return
      const alignment = readAlignment(this.physics.dieShape(index), start.face, this.physics.dieRotation(index))
      start.lowest = Math.min(start.lowest, alignment)
    })
  }
}
