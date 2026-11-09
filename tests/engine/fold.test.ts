import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { boxForViewport, type BoxSize } from '../../app/engine/box'
import { d6Pool } from '../../app/engine/core/pool'
import { readFace } from '../../app/engine/dice/faces'
import { DIE_SHAPES } from '../../app/engine/dice/shapes'
import { foldFrame, foldShift, isFold } from '../../app/engine/fold'
import { REST_ACCELERATION } from '../../app/engine/input/motionSource'
import type { Vec3 } from '../../app/engine/math'
import { CupSimulation } from '../../app/engine/simulation'

beforeAll(() => RAPIER.init())

const FRAME = 1 / 60
// The iPhone Duo's two screens in the simulator, at 3 pixels to the CSS pixel.
const OUTER = { width: 466, height: 678 }
const INNER = { width: 669, height: 951 }
const outerBox = boxForViewport(OUTER.width, OUTER.height)
const innerBox = boxForViewport(INNER.width, INNER.height)

describe('isFold', () => {
  it('takes a change of screen on a folding phone for a fold, either way', () => {
    expect(isFold(OUTER, INNER)).toBe(true)
    expect(isFold(INNER, OUTER)).toBe(true)
  })

  it('leaves a browser toolbar, a step of a dragged window and the first layout alone', () => {
    expect(isFold({ width: 390, height: 844 }, { width: 390, height: 760 })).toBe(false)
    expect(isFold({ width: 800, height: 600 }, { width: 816, height: 600 })).toBe(false)
    expect(isFold({ width: 0, height: 0 }, INNER)).toBe(false)
  })
})

describe('foldFrame', () => {
  it('keeps the right-hand wall still from the old box to the new one', () => {
    for (const [from, to] of [[outerBox, innerBox], [innerBox, outerBox]]) {
      for (const t of [0, 0.25, 0.5, 1]) {
        const { box, offsetX } = foldFrame(from!, to!, t)
        expect(offsetX + box.width / 2).toBeCloseTo(to!.width / 2)
      }
      expect(foldFrame(from!, to!, 0).box.width).toBeCloseTo(from!.width)
      expect(foldFrame(from!, to!, 1)).toEqual({ box: to, offsetX: 0 })
    }
  })
})

/** Runs the dice under `acceleration` for `seconds`. */
function run(simulation: CupSimulation, seconds: number, acceleration: Vec3, clock: { ms: number }) {
  for (let i = 0; i < seconds / FRAME; i++) {
    clock.ms += FRAME * 1000
    simulation.tick(FRAME, acceleration, clock.ms)
  }
}

/** Folds or unfolds the cup from `from` to `to` as DiceCup does, frame by frame, the phone lying still. */
function fold(simulation: CupSimulation, from: BoxSize, to: BoxSize, clock: { ms: number }) {
  simulation.physics.shiftDice(foldShift(from, to))
  for (let t = 0; t <= 1; t += FRAME / 0.35) {
    const { box, offsetX } = foldFrame(from, to, t)
    simulation.physics.resize(box, offsetX)
    run(simulation, FRAME, REST_ACCELERATION, clock)
  }
  simulation.physics.resize(to)
  run(simulation, 0.5, REST_ACCELERATION, clock)
}

function dice(simulation: CupSimulation) {
  const { physics } = simulation
  return Array.from({ length: physics.dieCount }, (_, index) => ({
    position: physics.diePosition(index),
    face: readFace(DIE_SHAPES.d6, physics.dieRotation(index)).face.value,
  }))
}

describe('folding the cup', () => {
  it('keeps each die where it lay against the right-hand wall when unfolded, face up as it was', () => {
    const simulation = new CupSimulation(RAPIER, outerBox, { randomStart: false, pool: d6Pool(4) })
    const clock = { ms: 0 }
    run(simulation, 1, REST_ACCELERATION, clock)
    const before = dice(simulation)
    fold(simulation, outerBox, innerBox, clock)
    dice(simulation).forEach(({ position, face }, index) => {
      expect(innerBox.width / 2 - position.x).toBeCloseTo(outerBox.width / 2 - before[index]!.position.x, 1)
      expect(position.y).toBeCloseTo(before[index]!.position.y, 1)
      expect(face).toBe(before[index]!.face)
    })
    simulation.dispose()
  })

  it('carries the dice along with the left-hand wall when folded, without turning one over', () => {
    const simulation = new CupSimulation(RAPIER, innerBox, { randomStart: false, pool: d6Pool(3) })
    const clock = { ms: 0 }
    // Slide the dice to the left-hand wall of the open phone, then lay it flat.
    run(simulation, 2, { x: 9.8, y: 0, z: 2 }, clock)
    run(simulation, 2, REST_ACCELERATION, clock)
    const before = dice(simulation)
    expect(before.some(({ position }) => position.x + foldShift(innerBox, outerBox) < -outerBox.width / 2)).toBe(true)
    fold(simulation, innerBox, outerBox, clock)
    dice(simulation).forEach(({ position, face }, index) => {
      expect(Math.abs(position.x)).toBeLessThanOrEqual(outerBox.width / 2 - DIE_SHAPES.d6.inradius + 1e-3)
      expect(Math.abs(position.y)).toBeLessThanOrEqual(outerBox.height / 2 - DIE_SHAPES.d6.inradius + 1e-3)
      expect(face).toBe(before[index]!.face)
    })
    simulation.dispose()
  })
})
