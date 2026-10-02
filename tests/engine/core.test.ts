import { describe, expect, it } from 'vitest'
import { MotionAnalyser } from '../../app/engine/core/motionAnalyser'
import { nextState } from '../../app/engine/core/stateMachine'
import { D6_FACES } from '../../app/engine/dice/d6'
import { readTopFace } from '../../app/engine/dice/faces'
import { REST_ACCELERATION, toScreenFrame } from '../../app/engine/input/motionSource'
import type { Quat, Vec3 } from '../../app/engine/math'

const quiet = { shaking: false, restingFaceUp: false, diceAtRest: false }

describe('nextState', () => {
  it('walks idle → shaking → settling → result', () => {
    expect(nextState('idle', { ...quiet, shaking: true })).toBe('shaking')
    expect(nextState('shaking', { ...quiet, restingFaceUp: true })).toBe('settling')
    expect(nextState('settling', { ...quiet, restingFaceUp: true, diceAtRest: true })).toBe('result')
  })

  it('does not report a result for dice that are at rest before any shake', () => {
    expect(nextState('idle', { ...quiet, restingFaceUp: true, diceAtRest: true })).toBe('idle')
  })

  it('keeps shaking until the device is put down, even if the dice pause', () => {
    expect(nextState('shaking', { ...quiet, diceAtRest: true })).toBe('shaking')
  })

  it('restarts the roll when shaken from settling or result', () => {
    expect(nextState('settling', { ...quiet, shaking: true })).toBe('shaking')
    expect(nextState('result', { ...quiet, shaking: true })).toBe('shaking')
  })
})

/** Feeds `seconds` of 60 Hz samples and returns the end time. */
function feed(analyser: MotionAnalyser, startMs: number, seconds: number, sample: (t: number) => Vec3): number {
  const frames = Math.round(seconds * 60)
  for (let i = 1; i <= frames; i++) analyser.update(sample(i / 60), startMs + i * 1000 / 60)
  return startMs + seconds * 1000
}

const shake = (t: number): Vec3 => ({
  x: 25 * Math.sin(2 * Math.PI * 4 * t),
  y: 9.8 + 30 * Math.sin(2 * Math.PI * 5 * t),
  z: 10 * Math.cos(2 * Math.PI * 3 * t),
})

describe('MotionAnalyser', () => {
  it('treats a device lying screen-up as resting, not shaking', () => {
    const analyser = new MotionAnalyser()
    feed(analyser, 0, 1, () => REST_ACCELERATION)
    expect(analyser.shaking).toBe(false)
    expect(analyser.restingFaceUp).toBe(true)
  })

  it('detects a shake, including through the zero crossings of the motion', () => {
    const analyser = new MotionAnalyser()
    let time = feed(analyser, 0, 0.5, () => REST_ACCELERATION)
    for (let i = 0; i < 60; i++) {
      time = feed(analyser, time, 1 / 60, () => shake(i / 60))
      if (i > 10) expect(analyser.shaking).toBe(true)
    }
    expect(analyser.restingFaceUp).toBe(false)
  })

  it('reports resting only after the device has been still for a moment', () => {
    const analyser = new MotionAnalyser()
    let time = feed(analyser, 0, 1, shake)
    time = feed(analyser, time, 0.1, () => REST_ACCELERATION)
    expect(analyser.restingFaceUp).toBe(false)
    feed(analyser, time, 1.5, () => REST_ACCELERATION)
    expect(analyser.shaking).toBe(false)
    expect(analyser.restingFaceUp).toBe(true)
  })

  it('does not count a device lying screen-down as put down', () => {
    const analyser = new MotionAnalyser()
    feed(analyser, 0, 2, () => ({ x: 0, y: 0, z: -9.81 }))
    expect(analyser.restingFaceUp).toBe(false)
  })

  it('ignores the gentle motion of picking the device up', () => {
    const analyser = new MotionAnalyser()
    feed(analyser, 0, 1, t => ({ x: 2 * Math.sin(3 * t), y: 3 * t, z: 9.81 - 3 * t }))
    expect(analyser.shaking).toBe(false)
  })
})

/** Quaternion for a rotation of `degrees` about a unit axis. */
function axisAngle(axis: Vec3, degrees: number): Quat {
  const half = degrees * Math.PI / 360
  const s = Math.sin(half)
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) }
}

describe('readTopFace', () => {
  it('reads the +z face of an unrotated die', () => {
    expect(readTopFace(D6_FACES, { x: 0, y: 0, z: 0, w: 1 })).toBe(3)
  })

  it('reads each face when it is turned towards the viewer', () => {
    // Rotating about y by -90° brings the +x face (1) to +z; by +90° the -x face (6).
    expect(readTopFace(D6_FACES, axisAngle({ x: 0, y: 1, z: 0 }, -90))).toBe(1)
    expect(readTopFace(D6_FACES, axisAngle({ x: 0, y: 1, z: 0 }, 90))).toBe(6)
    // Rotating about x by +90° brings the +y face (2) to +z; by -90° the -y face (5).
    expect(readTopFace(D6_FACES, axisAngle({ x: 1, y: 0, z: 0 }, 90))).toBe(2)
    expect(readTopFace(D6_FACES, axisAngle({ x: 1, y: 0, z: 0 }, -90))).toBe(5)
    expect(readTopFace(D6_FACES, axisAngle({ x: 1, y: 0, z: 0 }, 180))).toBe(4)
  })

  it('is unaffected by a spin about the vertical axis or a slight tilt', () => {
    expect(readTopFace(D6_FACES, axisAngle({ x: 0, y: 0, z: 1 }, 37))).toBe(3)
    expect(readTopFace(D6_FACES, axisAngle({ x: 1, y: 0, z: 0 }, 20))).toBe(3)
  })

  it('has opposite faces that sum to 7', () => {
    for (const face of D6_FACES) {
      const opposite = D6_FACES.find(other => other.normal.x === -face.normal.x
        && other.normal.y === -face.normal.y && other.normal.z === -face.normal.z)!
      expect(face.value + opposite.value).toBe(7)
    }
  })
})

describe('toScreenFrame', () => {
  const close = (actual: Vec3, expected: Vec3) => {
    expect(actual.x).toBeCloseTo(expected.x)
    expect(actual.y).toBeCloseTo(expected.y)
    expect(actual.z).toBeCloseTo(expected.z)
  }

  it('leaves a portrait reading unchanged', () => {
    close(toScreenFrame({ x: 1, y: 2, z: 3 }, 0), { x: 1, y: 2, z: 3 })
  })

  it('maps the device\'s right edge to the top of the screen at 90°', () => {
    close(toScreenFrame({ x: 1, y: 0, z: 0 }, 90), { x: 0, y: 1, z: 0 })
    close(toScreenFrame({ x: 0, y: 1, z: 0 }, 90), { x: -1, y: 0, z: 0 })
  })

  it('maps the device\'s left edge to the top of the screen at 270°', () => {
    close(toScreenFrame({ x: -1, y: 0, z: 0 }, 270), { x: 0, y: 1, z: 0 })
  })
})
