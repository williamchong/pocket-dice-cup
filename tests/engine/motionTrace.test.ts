import { describe, expect, it } from 'vitest'
import { TraceRecorder } from '../../app/engine/input/motionTrace'

describe('TraceRecorder', () => {
  it('times samples from the first one and rounds the readings', () => {
    const recorder = new TraceRecorder()
    recorder.push({ x: 0.123, y: -4.5678, z: 9.80665 }, 1000.04)
    recorder.push({ x: 1, y: 2, z: 3 }, 1016.71)
    const trace = recorder.toTrace('iPhone', 'pickup', new Date('2026-10-05T00:00:00Z'))
    expect(trace).toEqual({
      device: 'iPhone',
      recordedAt: '2026-10-05T00:00:00.000Z',
      note: 'pickup',
      samples: [[0, 0.12, -4.57, 9.81], [16.7, 1, 2, 3]],
    })
  })

  it('keeps only the last 30 seconds', () => {
    const recorder = new TraceRecorder()
    for (let time = 0; time <= 40_000; time += 1000) recorder.push({ x: 0, y: 0, z: time }, time)
    const { samples } = recorder.toTrace('', '')
    expect(samples).toHaveLength(31)
    expect(samples[0]).toEqual([0, 0, 0, 10_000])
  })

  it('gives an empty trace before any reading', () => {
    expect(new TraceRecorder().toTrace('', '').samples).toEqual([])
  })
})
