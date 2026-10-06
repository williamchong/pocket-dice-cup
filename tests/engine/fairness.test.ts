import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import { MAX_DICE, type DicePool } from '../../app/engine/core/pool'
import { readFace } from '../../app/engine/dice/faces'
import { DIE_KINDS, DIE_SHAPES, type DieKind } from '../../app/engine/dice/shapes'
import { REST_ACCELERATION } from '../../app/engine/input/motionSource'
import { CupSimulation } from '../../app/engine/simulation'
import { seededRandom } from './seededRandom'
import { shake } from './syntheticShake'

beforeAll(() => RAPIER.init())

const FRAME = 1 / 60
const box = boxForViewport(390, 844)
/** A die resting tilted further than this off a face, leaning on the cup or another die, counts as cocked. */
const COCKED_ALIGNMENT = Math.cos(10 * Math.PI / 180)

interface Roll {
  /** Each die's value, or null when it did not settle into a result. */
  values: number[] | null
  /** How many dice came to rest cocked. */
  cocked: number
  /** Time the simulation took a frame on average, in ms. */
  frameMs: number
}

/**
 * Shakes a cup of `pool` for 1 to 2 seconds and puts it down, waiting up to
 * `settleSeconds` for a result. The dice start at random places and faces
 * from `seed`, and the shake's phases and length vary with it.
 */
function roll(pool: DicePool, seed: number, settleSeconds = 10): Roll {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
  const simulation = new CupSimulation(RAPIER, box, { pool })
  vi.restoreAllMocks()
  const phase = seed * 2.399
  const shakeSeconds = 1 + (seed * 0.618) % 1
  let time = 0
  let frames = 0
  const started = performance.now()
  const run = (seconds: number, sample: (t: number) => typeof REST_ACCELERATION, until?: () => boolean) => {
    for (const start = time; time - start < seconds && !until?.(); time += FRAME, frames++) {
      simulation.tick(FRAME, sample(time - start), time * 1000)
    }
  }
  run(0.5, () => REST_ACCELERATION)
  run(shakeSeconds, t => shake(t, phase))
  run(settleSeconds, () => REST_ACCELERATION, () => simulation.state === 'result')
  const frameMs = (performance.now() - started) / frames
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

  // A full cup of one kind, the dice knocking each other about as they would.
  // One in a hundred cups of twelve d12 took 10.6 s to settle, a die perched
  // on the others creeping off them, so they get 20.
  it.each(DIE_KINDS)('comes out fair on a %s', (kind: DieKind) => {
    const sides = DIE_SHAPES[kind].faces.length
    const counts = Array.from({ length: sides }, () => 0)
    let unsettled = 0
    let frameMs = 0
    for (let seed = 1; seed <= ROLLS; seed++) {
      const result = roll(Array.from({ length: MAX_DICE }, () => kind), seed, 20)
      frameMs += result.frameMs / ROLLS
      if (!result.values) unsettled++
      for (const value of result.values ?? []) counts[value - 1]!++
    }
    const total = counts.reduce((sum, count) => sum + count, 0)
    const expected = total / sides
    const chiSquared = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
    console.log(`${kind}: ${counts.join(' ')}; χ² ${chiSquared.toFixed(1)} of ${chiSquaredLimit(sides - 1).toFixed(1)}; ${frameMs.toFixed(2)} ms a frame`)
    expect(unsettled).toBe(0)
    expect(counts.every(count => count > 0)).toBe(true)
    expect(chiSquared).toBeLessThan(chiSquaredLimit(sides - 1))
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
})
