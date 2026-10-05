import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import type { CupState } from '../../app/engine/core/stateMachine'
import { D6_FACES, D6_SIZE } from '../../app/engine/dice/d6'
import { readTopFace } from '../../app/engine/dice/faces'
import { REST_ACCELERATION } from '../../app/engine/input/motionSource'
import { distance, type Vec3 } from '../../app/engine/math'
import type { Impact } from '../../app/engine/physics/world'
import { CupSimulation } from '../../app/engine/simulation'
import { seededRandom } from './seededRandom'

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

/** Clicks once on a desktop with no sensor, lying still, and runs until the die settles. */
function toss(index: number) {
  const simulation = fixedCup()
  const states: CupState[] = [simulation.state]
  let peakHeight = 0
  for (let i = 0; i < 10 * 60 && simulation.state !== 'result'; i++) {
    if (i === 30) simulation.toss(seededRandom(index + 1))
    if (simulation.tick(FRAME, REST_ACCELERATION, (i + 1) * FRAME * 1000)) states.push(simulation.state)
    peakHeight = Math.max(peakHeight, simulation.physics.diePosition(0).z)
    assertInsideBox(simulation)
  }
  return { simulation, states, peakHeight }
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

  it('launches the die off the floor and rolls it fairly from a click on a desktop with no sensor', () => {
    const counts = [0, 0, 0, 0, 0, 0]
    const tosses = 60
    for (let i = 0; i < tosses; i++) {
      const { simulation, states, peakHeight } = toss(i)
      expect(states).toEqual(['idle', 'shaking', 'settling', 'result'])
      // Its centre at least a die's width up, so it is in the air, not sliding.
      expect(peakHeight).toBeGreaterThan(D6_SIZE)
      counts[simulation.result![0]! - 1]!++
      simulation.dispose()
    }
    // Every toss starts with the 3 up; a fair roll leaves it there one time in six.
    expect(counts[2]! / tosses).toBeLessThan(0.3)
    expect(counts.every(count => count > 0)).toBe(true)
  })
  it('restarts a shown result on a click, and rests there once the die settles', () => {
    const { simulation } = toss(0)
    simulation.toss(seededRandom(99))
    const states: CupState[] = []
    for (let i = 1; i <= 5 * 60; i++) {
      if (simulation.tick(FRAME, REST_ACCELERATION, 100_000 + i * FRAME * 1000)) states.push(simulation.state)
    }
    expect(states).toEqual(['shaking', 'settling', 'result'])
    simulation.dispose()
  })
})

describe('impacts', () => {
  /** Runs `seconds` of frames at a steady reading and returns the impacts seen. */
  function hold(simulation: CupSimulation, acceleration: Vec3, seconds: number): Impact[] {
    const impacts: Impact[] = []
    for (let i = 0; i < seconds * 60; i++) {
      simulation.tick(FRAME, acceleration, i * FRAME * 1000)
      impacts.push(...simulation.physics.impacts)
    }
    return impacts
  }

  it('reports none for a die lying still, or pressed against a wall', () => {
    const simulation = fixedCup()
    expect(hold(simulation, REST_ACCELERATION, 2)).toEqual([])
    // Pushed to the right at about 5 g, as in a shake, the die hits that wall
    // and stays there, pressed against it five times harder than by gravity.
    const pushed = { x: -50, y: 0, z: 9.8 }
    expect(hold(simulation, pushed, 2).length).toBeGreaterThan(0)
    expect(hold(simulation, pushed, 2)).toEqual([])
    simulation.dispose()
  })

  it('tells the glass, the floor and the walls apart', () => {
    const simulation = fixedCup()
    // Turned screen-down, the die falls onto the glass, and back onto the floor.
    expect(hold(simulation, { x: 0, y: 0, z: -9.8 }, 2)[0]?.surface).toBe('glass')
    const [landing] = hold(simulation, REST_ACCELERATION, 2)
    expect(landing?.surface).toBe('floor')
    // Falling the depth of the cup less a die, it lands at about 69 cm/s and
    // bounces back up at 0.8 of that.
    const fall = Math.sqrt(2 * 981 * (box.depth - D6_SIZE))
    expect(landing!.speed).toBeGreaterThan(fall)
    expect(landing!.speed).toBeLessThan(2 * fall)
    expect(hold(simulation, { x: -9.8, y: 0, z: 1 }, 2)[0]?.surface).toBe('wall')
    simulation.dispose()
  })

  it('stops once a click-tossed die has settled', () => {
    const { simulation, states } = toss(0)
    expect(states.at(-1)).toBe('result')
    expect(hold(simulation, REST_ACCELERATION, 1)).toEqual([])
    simulation.toss(seededRandom(7))
    expect(hold(simulation, REST_ACCELERATION, 1).length).toBeGreaterThan(0)
    simulation.dispose()
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
