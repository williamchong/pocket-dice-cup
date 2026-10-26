import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import { MAX_DICE, type DicePool } from '../../app/engine/core/pool'
import { COCKED_ALIGNMENT, readFace } from '../../app/engine/dice/faces'
import { DIE_KINDS, DIE_SHAPES, type DieKind } from '../../app/engine/dice/shapes'
import { REST_ACCELERATION } from '../../app/engine/input/motionSource'
import { CupSimulation } from '../../app/engine/simulation'
import { seededRandom, type Vec3 } from '../../app/engine/math'
import { shake } from './syntheticShake'

beforeAll(() => RAPIER.init())

const FRAME = 1 / 60
const box = boxForViewport(390, 844)

interface Roll {
  /** Each die's value, or null when it did not settle into a result. */
  values: number[] | null
  /** How many dice came to rest cocked. */
  cocked: number
  /** Time the simulation took a frame on average, in ms. */
  frameMs: number
}

/** Runs `simulation` a frame at a time, counting the frames run so far. */
function stepper(simulation: CupSimulation) {
  let time = 0
  const stepper = {
    frames: 0,
    /** Ticks for `seconds` with readings from `sample`, which takes the time since the call, or until `until`. */
    run(seconds: number, sample: (t: number) => typeof REST_ACCELERATION, until?: () => boolean) {
      for (const start = time; time - start < seconds && !until?.(); time += FRAME, stepper.frames++) {
        simulation.tick(FRAME, sample(time - start), time * 1000)
      }
    },
  }
  return stepper
}

/**
 * Held upright in the hand and still, a little past vertical, as in the
 * recorded Core Motion shake, trembling 0.2 m/s².
 */
const heldUpright = (t: number): Vec3 => ({ x: -1.2 + 0.2 * Math.sin(2 * Math.PI * 8 * t), y: 9.6, z: -0.8 })

/**
 * Shakes a cup of `pool` for 1 to 2 seconds and puts it down, or holds it as
 * `after` reads, waiting up to `settleSeconds` for a result. The dice start
 * at random places and faces from `seed`, and the shake's phases and length
 * vary with it.
 */
function roll(pool: DicePool, seed: number, settleSeconds = 10, after: (t: number) => Vec3 = () => REST_ACCELERATION): Roll {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
  const simulation = new CupSimulation(RAPIER, box, { pool })
  vi.restoreAllMocks()
  const phase = seed * 2.399
  const shakeSeconds = 1 + (seed * 0.618) % 1
  const steps = stepper(simulation)
  const { run } = steps
  const started = performance.now()
  run(0.5, () => REST_ACCELERATION)
  run(shakeSeconds, t => shake(t, phase))
  run(settleSeconds, after, () => simulation.state === 'result')
  const frameMs = (performance.now() - started) / steps.frames
  let cocked = 0
  for (let index = 0; index < simulation.physics.dieCount; index++) {
    if (readFace(simulation.physics.dieShape(index), simulation.physics.dieRotation(index)).alignment < COCKED_ALIGNMENT) cocked++
  }
  const values = simulation.state === 'result' ? simulation.result : null
  simulation.dispose()
  return { values, cocked, frameMs }
}

/**
 * The chi-squared value a fair die stays under 999 times in 1000, by the
 * Wilson–Hilferty approximation, close enough for 3 or more degrees of freedom.
 */
function chiSquaredLimit(degrees: number): number {
  const z = 3.09
  const spread = 2 / (9 * degrees)
  return degrees * (1 - spread + z * Math.sqrt(spread)) ** 3
}

describe('every kind of die', () => {
  it('rolls in a mixed cup, inside it, and reads each die in range', () => {
    const pool = DIE_KINDS.flatMap(kind => [kind, kind])
    expect(pool).toHaveLength(MAX_DICE)
    for (const seed of [1, 2]) {
      const { values } = roll(pool, seed)
      expect(values).toHaveLength(MAX_DICE)
      values!.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(DIE_SHAPES[pool[index]!].faces.length)
      })
    }
  })
})

/**
 * Over a thousand dice per kind, so it takes about a minute and runs only on
 * `npm run test:fairness`.
 */
describe.runIf(process.env.FAIRNESS)('the distribution of each kind of die', () => {
  const ROLLS = 100

  /**
   * Rolls a full cup of one kind ROLLS times, putting it down or holding it
   * as `after` reads, and checks the faces come out fair.
   */
  function expectFair(kind: DieKind, label: string, after?: (t: number) => Vec3): void {
    const sides = DIE_SHAPES[kind].faces.length
    const counts = Array.from({ length: sides }, () => 0)
    let unsettled = 0
    let frameMs = 0
    for (let seed = 1; seed <= ROLLS; seed++) {
      const result = roll(Array.from({ length: MAX_DICE }, () => kind), seed, 20, after)
      frameMs += result.frameMs / ROLLS
      if (!result.values) unsettled++
      for (const value of result.values ?? []) counts[value - 1]!++
    }
    const total = counts.reduce((sum, count) => sum + count, 0)
    const expected = total / sides
    const chiSquared = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
    console.log(`${label}: ${counts.join(' ')}; χ² ${chiSquared.toFixed(1)} of ${chiSquaredLimit(sides - 1).toFixed(1)}; ${frameMs.toFixed(2)} ms a frame`)
    expect(unsettled).toBe(0)
    expect(counts.every(count => count > 0)).toBe(true)
    expect(chiSquared).toBeLessThan(chiSquaredLimit(sides - 1))
  }

  // A full cup of one kind, the dice knocking each other about as they would.
  // One in a hundred cups of twelve d12 took 10.6 s to settle, a die perched
  // on the others creeping off them, so they get 20.
  it.each(DIE_KINDS)('comes out fair on a %s', (kind: DieKind) => expectFair(kind, kind))

  // Held upright and still after the shake, the dice rest against the low
  // wall until the cup lays them flat by itself, so they fall from there
  // rather than from wherever the shake left them.
  it.each(['d6', 'd20'] as const)('comes out fair laid flat by itself in the hand on a %s', (kind: DieKind) => {
    expectFair(kind, `${kind} held`, heldUpright)
  })

  // Alone, so only the cup can hold a die tilted: the bevels where the walls
  // meet the floor and the glass were tuned on the d6. In a crowded cup dice
  // also lean on each other, as real ones do: 2 to 6 dice in 100 with four in the cup.
  it.each(DIE_KINDS)('lies flat when a lone %s settles', (kind: DieKind) => {
    let cocked = 0
    for (let seed = 1; seed <= ROLLS; seed++) cocked += roll([kind], seed).cocked
    console.log(`${kind}: ${cocked} cocked of ${ROLLS}`)
    expect(cocked / ROLLS).toBeLessThan(0.05)
  })

  // A tap with the phone tilted used to throw the dice off the screen, and
  // they fell back into the corner by the bottom wall and slid there (see
  // TOSS). In this run of 400 taps in a row at 60°, each from where the d6
  // last landed, the old throw left it on its last face 29% of the time and
  // the new one 19%, where a fair die does 17%; the limit sits between.
  // Past 45° a tap now counts as one in the hand and lays the dice flat
  // (14% at 60°), so the run is at 40°, a phone resting tilted on a table,
  // where they still fall away from gravity: 18%.
  it('rarely leaves a tapped d6 on its last face with the phone tilted', () => {
    const g = REST_ACCELERATION.z
    const tilted = (degrees: number) => ({ x: 0, y: g * Math.sin(degrees * Math.PI / 180), z: g * Math.cos(degrees * Math.PI / 180) })
    const random = seededRandom(11)
    vi.spyOn(Math, 'random').mockImplementation(random)
    const simulation = new CupSimulation(RAPIER, box, { pool: ['d6'] })
    vi.restoreAllMocks()
    const { run } = stepper(simulation)
    let repeats = 0
    let last: number | undefined
    for (let toss = 0; toss < 400; toss++) {
      // Tilted to 40° and held, tapped, then laid flat for the result.
      run(0.6, t => tilted(40 * Math.min(1, t / 0.6)))
      run(0.5 + random(), () => tilted(40))
      simulation.toss(random)
      run(1 + random(), () => tilted(40))
      run(0.6, t => tilted(40 * Math.max(0, 1 - t / 0.6)))
      run(20, () => REST_ACCELERATION, () => simulation.state === 'result')
      const value = simulation.result![0]
      if (value === last) repeats++
      last = value
    }
    simulation.dispose()
    console.log(`tilted tap: ${repeats} repeats of 399`)
    expect(repeats / 399).toBeLessThan(0.21)
  })

  // A full cup piles up against a wall, where a fifth of the dice came to
  // rest leaning on the others until they were let slip off (see
  // settleCocked); now 2 to 30 in 1,200, the most on the d12.
  it.each(DIE_KINDS)('lies flat when a full cup of %s settles', (kind: DieKind) => {
    let cocked = 0
    for (let seed = 1; seed <= ROLLS; seed++) cocked += roll(Array.from({ length: MAX_DICE }, () => kind), seed).cocked
    console.log(`${kind}: ${cocked} cocked of ${ROLLS * MAX_DICE}`)
    expect(cocked / (ROLLS * MAX_DICE)).toBeLessThan(0.03)
  })
})
