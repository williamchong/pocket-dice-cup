import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import type { CupState } from '../../app/engine/core/stateMachine'
import { D6_FACES, D6_SIZE } from '../../app/engine/dice/d6'
import { readTopFace } from '../../app/engine/dice/faces'
import { REST_ACCELERATION, type MotionSource } from '../../app/engine/input/motionSource'
import { PointerSource } from '../../app/engine/input/pointerSource'
import { distance, type Vec3 } from '../../app/engine/math'
import { CupSimulation } from '../../app/engine/simulation'

beforeAll(() => RAPIER.init())

const FRAME = 1 / 60
const box = boxForViewport(390, 844)

/**
 * A vigorous shake on top of the phone being held roughly upright: several g
 * on every axis at different frequencies, with `seed` shifting the phases.
 */
function shake(t: number, seed: number): Vec3 {
  return {
    x: 30 * Math.sin(2 * Math.PI * 4.1 * t + seed),
    y: 9.8 + 45 * Math.sin(2 * Math.PI * 5.3 * t + 2 * seed),
    z: 25 * Math.sin(2 * Math.PI * 3.7 * t + 3 * seed),
  }
}

/** The dice start in the same place every time, so each roll is repeatable. */
function fixedCup(size = box): CupSimulation {
  return new CupSimulation(RAPIER, size, { randomStart: false })
}

const desktop: MotionSource = {
  acceleration: REST_ACCELERATION,
  active: false,
  start: async () => 'unsupported',
  stop: () => {},
}

interface Roll {
  simulation: CupSimulation
  states: CupState[]
  /** Seconds between putting the phone down and the result. */
  settleSeconds: number
}

function roll(seed: number, shakeSeconds = 2): Roll {
  const simulation = fixedCup()
  const states: CupState[] = [simulation.state]
  let time = 0
  const run = (seconds: number, sample: (t: number) => Vec3, until?: () => boolean) => {
    const start = time
    while (time - start < seconds && !until?.()) {
      time += FRAME
      if (simulation.tick(FRAME, sample(time - start), time * 1000)) states.push(simulation.state)
      assertInsideBox(simulation)
    }
    return time - start
  }
  run(0.5, () => REST_ACCELERATION)
  run(shakeSeconds, t => shake(t, seed))
  const settleSeconds = run(10, () => REST_ACCELERATION, () => simulation.state === 'result')
  return { simulation, states, settleSeconds }
}

/** A repeatable stand-in for Math.random (mulberry32). */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Clicks once on a desktop with no sensor and runs until the die settles. */
function toss(index: number) {
  let timeMs = 0
  const source = new PointerSource(desktop, () => timeMs)
  const simulation = fixedCup()
  const states: CupState[] = [simulation.state]
  let peakSpeed = 0
  let last = simulation.physics.diePosition(0)
  for (let i = 0; i < 10 * 60 && simulation.state !== 'result'; i++) {
    timeMs += FRAME * 1000
    if (i === 30) {
      source.shake(index * 0.73)
      simulation.toss(seededRandom(index + 1))
    }
    if (simulation.tick(FRAME, source.acceleration, timeMs)) states.push(simulation.state)
    const position = simulation.physics.diePosition(0)
    peakSpeed = Math.max(peakSpeed, distance(position, last) / FRAME)
    last = position
    assertInsideBox(simulation)
  }
  return { simulation, states, peakSpeed }
}

function assertInsideBox(simulation: CupSimulation): void {
  // A die lying flat against a wall has its centre half a die away. Hard
  // impacts sink in briefly; more than this would start to show.
  const margin = D6_SIZE / 2 - 0.35
  const p = simulation.physics.diePosition(0)
  expect(Math.abs(p.x)).toBeLessThan(box.width / 2 - margin)
  expect(Math.abs(p.y)).toBeLessThan(box.height / 2 - margin)
  expect(p.z).toBeGreaterThan(margin)
  expect(p.z).toBeLessThan(box.depth - margin)
}

describe('CupSimulation', () => {
  it('stays idle with no result while the phone lies still', () => {
    const simulation = fixedCup()
    for (let i = 1; i <= 120; i++) simulation.tick(FRAME, REST_ACCELERATION, i * FRAME * 1000)
    expect(simulation.state).toBe('idle')
    expect(simulation.result).toBeNull()
  })

  it('goes through shaking and settling to a result when shaken and put down', () => {
    const { simulation, states, settleSeconds } = roll(1)
    expect(states).toEqual(['idle', 'shaking', 'settling', 'result'])
    expect(simulation.result).toHaveLength(1)
    expect(simulation.result![0]).toBeGreaterThanOrEqual(1)
    expect(simulation.result![0]).toBeLessThanOrEqual(6)
    expect(settleSeconds).toBeLessThan(5)
    simulation.dispose()
  })

  it('leaves the die lying flat on the floor', () => {
    const { simulation } = roll(2)
    expect(simulation.physics.diePosition(0).z).toBeCloseTo(D6_SIZE / 2, 1)
    simulation.dispose()
  })

  it('keeps the die inside the cup through hard shakes and lands on varied faces', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 24; seed++) {
      const { simulation, states } = roll(seed * 0.37, 1.5)
      expect(states.at(-1)).toBe('result')
      seen.add(simulation.result![0]!)
      simulation.dispose()
    }
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('clears the result and rolls again on a second shake', () => {
    const { simulation } = roll(3)
    let time = 100
    for (let i = 0; i < 30; i++) {
      time += FRAME
      simulation.tick(FRAME, shake(i * FRAME, 5), time * 1000)
    }
    expect(simulation.state).toBe('shaking')
    expect(simulation.result).toBeNull()
    simulation.dispose()
  })

  it('pulls the die back inside when the cup shrinks around it', () => {
    const simulation = fixedCup(boxForViewport(844, 390))
    // Slide the die to the right-hand wall of a landscape cup.
    for (let i = 1; i <= 120; i++) simulation.tick(FRAME, { x: -9.8, y: 0, z: 2 }, i * FRAME * 1000)
    expect(simulation.physics.diePosition(0).x).toBeGreaterThan(box.width / 2)
    simulation.physics.resize(box)
    expect(simulation.physics.diePosition(0).x).toBeCloseTo(box.width / 2 - D6_SIZE / 2)
    simulation.dispose()
  })

  it('rolls the die fairly and gently from a click on a desktop with no sensor', () => {
    const counts = [0, 0, 0, 0, 0, 0]
    let peakSpeed = 0
    const tosses = 60
    for (let i = 0; i < tosses; i++) {
      const { simulation, states, peakSpeed: speed } = toss(i)
      expect(states).toEqual(['idle', 'shaking', 'settling', 'result'])
      counts[simulation.result![0]! - 1]!++
      peakSpeed = Math.max(peakSpeed, speed)
      simulation.dispose()
    }
    // A hard shake peaks at about 360 cm/s.
    expect(peakSpeed).toBeLessThan(100)
    // Every toss starts with the 3 up; a fair roll leaves it there one time in six.
    expect(counts[2]! / tosses).toBeLessThan(0.3)
    expect(counts.every(count => count > 0)).toBe(true)
  })
})

describe('starting position', () => {
  it('puts the die in the middle with the 3 up when the start is fixed', () => {
    const simulation = fixedCup()
    const p = simulation.physics.diePosition(0)
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
    expect(p.z).toBeCloseTo(D6_SIZE / 2)
    expect(readTopFace(D6_FACES, simulation.physics.dieRotation(0))).toBe(3)
    simulation.dispose()
  })

  it('lays the die flat at a random place and face by default', () => {
    const faces = new Set<number>()
    for (let i = 0; i < 100; i++) {
      const simulation = new CupSimulation(RAPIER, box)
      const p = simulation.physics.diePosition(0)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(box.width / 2 - D6_SIZE / Math.SQRT2)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(box.height / 2 - D6_SIZE / Math.SQRT2)
      expect(p.z).toBeCloseTo(D6_SIZE / 2)
      const face = readTopFace(D6_FACES, simulation.physics.dieRotation(0))
      faces.add(face)
      // Lying flat already, so it only settles into the floor rather than
      // falling into place.
      for (let j = 1; j <= 30; j++) simulation.tick(FRAME, REST_ACCELERATION, j * FRAME * 1000)
      expect(distance(simulation.physics.diePosition(0), p)).toBeLessThan(0.1)
      expect(readTopFace(D6_FACES, simulation.physics.dieRotation(0))).toBe(face)
      simulation.dispose()
    }
    expect(faces.size).toBe(6)
  })
})
