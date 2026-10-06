import { readFileSync } from 'node:fs'
import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import { MotionAnalyser } from '../../app/engine/core/motionAnalyser'
import { readFace } from '../../app/engine/dice/faces'
import { DIE_KINDS } from '../../app/engine/dice/shapes'
import type { MotionTrace } from '../../app/engine/input/motionTrace'
import { CupSimulation } from '../../app/engine/simulation'
import { seededRandom } from './seededRandom'

// Sensor readings recorded on an iPhone with ?debug and "Copy trace". Each one
// starts with the phone lying screen-up on a table and ends with the tap on
// the copy button.

beforeAll(() => RAPIER.init())
afterEach(() => vi.restoreAllMocks())

function load(name: string): MotionTrace {
  return JSON.parse(readFileSync(new URL(`../fixtures/traces/${name}.json`, import.meta.url), 'utf8'))
}

interface Frame {
  timeMs: number
  shaking: boolean
  restingFaceUp: boolean
}

/** Runs a trace through the motion analyser, as DiceCup does once a frame. */
function analyse(trace: MotionTrace): Frame[] {
  const analyser = new MotionAnalyser()
  return trace.samples.map(([timeMs, x, y, z]) => {
    analyser.update({ x, y, z }, timeMs)
    return { timeMs, shaking: analyser.shaking, restingFaceUp: analyser.restingFaceUp }
  })
}

const SHAKES = ['shake-horizontal', 'shake-vertical', 'shake-face-down', 'shake-gentle']
/** When the phone in shake-face-down is turned screen-up to reach the copy button. */
const FACE_DOWN_TURNED_UP_MS = 7600
/** When the phone in shake-horizontal stops shaking, before it is put down. */
const HORIZONTAL_SHAKE_END_MS = 3900

/** Feeds a trace to the simulation frame by frame, as DiceCup does, up to `untilMs`. */
function replay(simulation: CupSimulation, trace: MotionTrace, untilMs = Infinity, onFrame = () => {}): void {
  let lastMs = 0
  for (const [timeMs, x, y, z] of trace.samples) {
    if (timeMs > untilMs) break
    simulation.tick((timeMs - lastMs) / 1000, { x, y, z }, timeMs)
    lastMs = timeMs
    onFrame()
  }
}

describe('recorded iPhone traces', () => {
  it('read a phone lying screen-up as +z, so the iOS sign flip is right', () => {
    for (const name of ['pickup', ...SHAKES]) {
      const [, x, y, z] = load(name).samples[0]!
      expect(z, name).toBeGreaterThan(9)
      expect(Math.hypot(x, y), name).toBeLessThan(3)
    }
  })

  it('count every recorded shake as shaking', () => {
    for (const name of SHAKES) {
      expect(analyse(load(name)).some(frame => frame.shaking), name).toBe(true)
    }
  })

  it('do not count picking the phone up and putting it back as a shake', () => {
    expect(analyse(load('pickup')).filter(frame => frame.shaking).map(frame => frame.timeMs)).toEqual([])
  })

  it('do not count a phone shaken screen-down as put down', () => {
    const frames = analyse(load('shake-face-down'))
    const firstShake = frames.find(frame => frame.shaking)!.timeMs
    const screenDown = frames.filter(frame => frame.timeMs > firstShake && frame.timeMs < FACE_DOWN_TURNED_UP_MS)
    expect(screenDown.some(frame => frame.restingFaceUp)).toBe(false)
  })

  it('roll and read the dice from a real shake and put-down', () => {
    const simulation = new CupSimulation(RAPIER, boxForViewport(390, 844), { randomStart: false })
    const states: string[] = [simulation.state]
    replay(simulation, load('shake-horizontal'), Infinity, () => {
      if (states.at(-1) !== simulation.state) states.push(simulation.state)
    })
    simulation.dispose()
    expect(states).toEqual(['idle', 'shaking', 'settling', 'result'])
  })

  it('rattle the die against the cup through a real shake, and fall quiet once it is read', () => {
    /** Impacts per state and surface, such as "shaking glass". */
    const count = (name: string) => {
      const simulation = new CupSimulation(RAPIER, boxForViewport(390, 844), { randomStart: false })
      const impacts: Partial<Record<string, number>> = {}
      replay(simulation, load(name), Infinity, () => {
        for (const { surface } of simulation.physics.impacts) {
          const key = `${simulation.state} ${surface}`
          impacts[key] = (impacts[key] ?? 0) + 1
        }
      })
      const { state } = simulation
      simulation.dispose()
      return { impacts, state }
    }
    // Up and down with the screen up throws the die at the glass and back.
    const { impacts: vertical } = count('shake-vertical')
    expect(vertical['shaking wall']).toBeGreaterThan(10)
    expect(vertical['shaking floor']).toBeGreaterThan(5)
    expect(vertical['shaking glass']).toBeGreaterThan(5)
    const { impacts: horizontal, state } = count('shake-horizontal')
    expect(state).toBe('result')
    expect(Object.keys(horizontal).filter(key => key.startsWith('result'))).toEqual([])
  })

  it.each(DIE_KINDS)('tumble a %s shaken side to side screen-up instead of sliding it on one face', (kind) => {
    // Without the floor bevel a d6 kept its face in 23 of 30 starts and
    // changed face 0.6 times a shake; with it, 3 of 30, and about 8 times.
    // The limits sit between the two with room for noise. A d4 tumbles least,
    // keeping its face 9 times in 30, where a fair one would 7 or 8.
    const trace = load('shake-horizontal')
    const starts = 30
    let keptFace = 0
    let faceChanges = 0
    for (let seed = 1; seed <= starts; seed++) {
      // The die starts at a random place and face, from Math.random.
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
      const simulation = new CupSimulation(RAPIER, boxForViewport(390, 844), { pool: [kind] })
      vi.restoreAllMocks()
      const currentFace = () => readFace(simulation.physics.dieShape(0), simulation.physics.dieRotation(0)).face.value
      const startFace = currentFace()
      let face = startFace
      replay(simulation, trace, HORIZONTAL_SHAKE_END_MS, () => {
        const next = currentFace()
        if (next !== face) faceChanges++
        face = next
      })
      if (face === startFace) keptFace++
      simulation.dispose()
    }
    expect(keptFace).toBeLessThan(starts / 3)
    expect(faceChanges / starts).toBeGreaterThan(1.5)
  })
})
