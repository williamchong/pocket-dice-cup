import { readFileSync } from 'node:fs'
import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { boxForViewport } from '../../app/engine/box'
import { MotionAnalyser } from '../../app/engine/core/motionAnalyser'
import type { MotionTrace } from '../../app/engine/input/motionTrace'
import { CupSimulation } from '../../app/engine/simulation'

// Sensor readings recorded on an iPhone with ?debug and "Copy trace". Each one
// starts with the phone lying screen-up on a table and ends with the tap on
// the copy button.

beforeAll(() => RAPIER.init())

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

const SHAKES = ['shake-horizontal', 'shake-vertical', 'shake-face-down']
/** When the phone in shake-face-down is turned screen-up to reach the copy button. */
const FACE_DOWN_TURNED_UP_MS = 7600

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
})
